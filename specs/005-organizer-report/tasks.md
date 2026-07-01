# Tasks: Organizer Report & Analytics

**Feature**: `005-organizer-report` | **Plan**: [plan.md](plan.md) | **Spec**: [spec.md](spec.md)

**Stack**: TypeScript / Next.js (App Router) + PostgreSQL 16, Drizzle, Zod, pino, Vitest. Extends the
existing project; reuses features 002 (door records, gate sales, attendance), 003 (bookings/performers),
004 (gate breakdown) and shared `money`/`logger`/`audit`/`withLogging`/`parseBody`. Money is integer
cents. The report is a computed read-model (no result tables).

**Test-First is NON-NEGOTIABLE** (constitution Principle I): test tasks are written first and MUST
fail before implementation. Pure calcs (Dance Net, paying dancers, quarterly, rolling window) are unit
tests; report assembly is integration-tested against the real `zak1_test` database — no DB mocking.

**Conventions**: `[P]` = parallelizable (different files, no incomplete deps). Story labels `[US1]`,
`[US2]`, `[US3]`. Paths repo-relative.

---

## Phase 1: Setup

- [ ] T001 [P] Zod schemas for expense-parameter and misc-expense inputs in `src/server/validation/organizer.ts`

---

## Phase 2: Foundational (blocking prerequisites)

- [ ] T002 Author migration `0009_organizer.sql` (`series_expense_kind` enum, series_expense_parameters, misc_expenses; add `attendance_count` to events) in `src/server/db/migrations/`
- [ ] T003 [P] Drizzle schema for `series_expense_parameters` (+ enum) in `src/server/db/schema/seriesExpenseParameters.ts`
- [ ] T004 [P] Drizzle schema for `misc_expenses` in `src/server/db/schema/miscExpenses.ts`; add `attendanceCount` to `events` schema; export all from `src/server/db/schema/index.ts`
- [ ] T005 Apply migration to dev DB and extend `resetDb` to truncate the new tables in `tests/integration/helpers/db.ts`
- [ ] T006 Extract shared gate breakdown (admission cash/card, merchandise, FYI category totals) from feature 004's `reportService` into `src/server/domain/gate/eventMoney.ts`; refactor `reportService` to consume it (keep 004 tests green)
- [ ] T007 Persist per-event attendance count: increment `events.attendance_count` on each check-in in `src/server/domain/attendance/attendanceService.ts` (purge leaves the counter intact) (FR-014)
- [ ] T008 Expense-parameter service (append effective-dated rent/ongoing row; resolve by series+kind+date; write audit) in `src/server/domain/organizer/expenseParameterService.ts`
- [ ] T009 [P] Route handlers `POST/GET /api/expense-parameters` in `src/app/api/expense-parameters/route.ts`
- [ ] T010 [P] Misc-expense service (create/list per event; total) in `src/server/domain/organizer/miscExpenseService.ts`
- [ ] T011 [P] Route handlers `POST/GET /api/events/[id]/misc-expenses` in `src/app/api/events/[id]/misc-expenses/route.ts`
- [ ] T012 [P] Seed sample rent + ongoing parameters in `src/server/db/seed.ts`

**Checkpoint**: shared gate breakdown available; expense parameters + misc expenses + persisted count in place.

---

## Phase 3: User Story 1 — Per-dance financial results (Priority: P1)

**Goal**: Per-series per-dance rows with Dance Net, paying dancers, Avg Ticket, Break-Even, FYI
columns, and color signal; the TNC report includes its Community Dance events.

**Independent test**: For a series with several completed events, the report returns per-dance rows
with Dance Net exact to the cent, correct paying-dancers/Avg-Ticket, Break-Even only when negative, and
counts that survive the 90-day purge.

### Tests first (MUST fail before implementation)

- [ ] T013 [P] [US1] Unit test: Dance Net = admission + merchandise − rent − performer total − ongoing − misc (cents), in `tests/unit/organizer.danceNet.test.ts` (FR-003)
- [ ] T014 [P] [US1] Unit test: paying dancers = attendance − distinct performers − 1 (floored); Avg Ticket = admission ÷ dancers; Break-Even only when Dance Net < 0, in `tests/unit/organizer.metrics.test.ts` (FR-005/006/013)
- [ ] T015 [P] [US1] Integration test: `GET /api/organizer/:seriesKey/report` returns per-dance rows with the full column set + Dance Net sign; TNC report includes Community Dance events, in `tests/integration/organizer.rows.test.ts` (FR-001/002/004/009)
- [ ] T016 [P] [US1] Integration test: per-event dancer count survives the 90-day attendance purge (persisted `events.attendance_count`), in `tests/integration/organizer.count-persist.test.ts` (FR-014)

### Implementation

- [ ] T017 [US1] Dance-result calculators (danceNet, payingDancers, avgTicket, breakEven) in `src/server/domain/organizer/danceResult.ts`
- [ ] T018 [US1] Report assembler — per-dance rows (reads events/door/gate/bookings/params/misc/count via eventMoney); include a per-performer breakdown `{ name, type, amount }[]` reusing feature 003's booking view (FR-007) in `src/server/domain/organizer/reportService.ts`
- [ ] T019 [P] [US1] Route handler `GET /api/organizer/[seriesKey]/report` in `src/app/api/organizer/[seriesKey]/report/route.ts`
- [ ] T020 [US1] Organizer report UI — per-dance rows table (black/red Dance Net, Break-Even, FYI columns) with a Performer Total drill-down showing each performer's name/type/amount from the row's `performers` array (FR-007) in `src/app/(admin)/organizer/[seriesKey]/page.tsx`

**Checkpoint**: US1 independently testable — accurate per-dance rows.

---

## Phase 4: User Story 2 — Quarterly summaries (Priority: P2)

**Goal**: Per-series Q1–Q4 + YTD + Last Year with averaged metrics and FYI quarter totals.

**Independent test**: Across events spanning quarters, each quarter's count + averages + FYI totals
compute correctly and YTD/Last-Year appear.

### Tests first (MUST fail before implementation)

- [ ] T021 [P] [US2] Unit test: quarterly aggregation (calendar quarters; count + averages + FYI totals; YTD + Last Year), in `tests/unit/organizer.quarterly.test.ts` (FR-010)
- [ ] T022 [P] [US2] Integration test: report includes Q1–Q4, YTD, Last Year with averaged metrics, in `tests/integration/organizer.quarterly.test.ts` (FR-010/SC-002)

### Implementation

- [ ] T023 [US2] Quarterly aggregation in `src/server/domain/organizer/quarterly.ts`; wire into the report assembler
- [ ] T024 [US2] Organizer report UI — quarterly summary table in `src/app/(admin)/organizer/[seriesKey]/page.tsx`

**Checkpoint**: US2 independently testable — quarterly summary correct.

---

## Phase 5: User Story 3 — Rolling trend charts (Priority: P2)

**Goal**: Two-panel rolling trend charts (Dance Net + attendance) with a 4-event rolling average,
color coding, and hover detail — shown only for 12 ≤ weeks ≤ 53.

**Independent test**: With 12–53 weeks of data the trend has both panels + rolling average; with <12
weeks it is null.

### Tests first (MUST fail before implementation)

- [ ] T025 [P] [US3] Unit test: rolling window selection (12..53 cap; null <12), 4-event rolling average, Dance Net point signs, in `tests/unit/organizer.trend.test.ts` (FR-011/012)
- [ ] T026 [P] [US3] Integration test: report `trend` is null <12 weeks and populated (both panels) at ≥12 weeks; **perf: assert a full-year (≥53-week) series report builds in <2 s** (SC-003), in `tests/integration/organizer.trend.test.ts` (FR-011/SC-003)

### Implementation

- [ ] T027 [US3] Trend builder (window selection + rolling average + hover payload) in `src/server/domain/organizer/trend.ts`; wire into the report assembler
- [ ] T028 [US3] Organizer report UI — Dance Net + attendance trend charts (SVG, colors, hover/tap) in `src/app/(admin)/organizer/[seriesKey]/page.tsx`

**Checkpoint**: US3 independently testable — trend charts render within the 12–53 week window.

---

## Phase 6: Polish & Cross-Cutting

- [ ] T029 [US2] Expense-parameter admin UI (set rent/ongoing per series + effective date) in `src/app/(admin)/expense-parameters/page.tsx`
- [ ] T030 [P] Update the dev route index `src/app/dev/routes/page.tsx` with the new routes (organizer report, expense-parameters, misc-expenses; UI /organizer, /expense-parameters) per the temporary convention
- [ ] T031 [P] Verify all [quickstart.md](quickstart.md) scenarios end-to-end
- [ ] T032 [P] Constitution compliance pass: strict types, integer-cents money, real-Postgres tests, no undocumented `any`/`as`; confirm 004 tests still green after the eventMoney extraction
- [ ] T033 [P] Update README with organizer/expense-parameters routes

---

## Dependencies & Execution Order

- **Setup (T001)** → **Foundational (T002–T012)** → user stories.
- **US1 (P1)** depends on Foundational (eventMoney, expense params, misc expenses, attendance count, bookings) → **MVP**.
- **US2 (P2)** aggregates US1's per-dance rows; build after US1.
- **US3 (P2)** builds trends from US1's per-event series; independent of US2; build after US1.
- Within a story: tests first (must fail) → calculators/services → route → UI.

## Parallel Opportunities

- Foundational: schema files T003/T004, routes T009/T011, seed T012 in parallel; T006 (eventMoney) and T007 (attendance counter) are independent.
- Each story's `[P]` unit + integration test tasks can be authored together before implementation.

## Implementation Strategy

1. **MVP = US1** (per-dance rows with Dance Net) on top of Foundational — the organizer's core tool.
2. Add **US2** (quarterly summaries).
3. Add **US3** (rolling trend charts).
4. Polish + expense-parameter UI + dev-route index + constitution pass.

## Format validation

All tasks use `- [ ] T### [P?] [US#?] description + file path`. Setup/Foundational/Polish carry no
story label; US phases carry `[US1]/[US2]/[US3]`. 33 tasks total.
