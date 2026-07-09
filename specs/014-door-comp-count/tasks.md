# Tasks: Door Comp Count Feeding Paying Dancers

**Feature**: `014-door-comp-count` | **Plan**: [plan.md](plan.md) | **Spec**: [spec.md](spec.md)

**Stack**: TypeScript / Next.js (App Router) + PostgreSQL 16, Drizzle, Zod, pino, Vitest; Node 24 + pnpm.
Additive retrofit of feature 002 (door record + gate-money entry) and feature 005 (organizer report). One
migration `0019_door_comp_count.sql` (0018 is latest).

**Test-First is NON-NEGOTIABLE** (constitution Principle I): the `payingDancers` change is driven by a
failing unit test; the end-to-end report behavior by a failing integration test against real `zak1_test`
(no mocking). No existing behavior changes without a test.

**Conventions**: `[P]` = parallelizable (different files, no incomplete deps). Story labels `[US1]`,
`[US2]`. Paths repo-relative.

---

## Phase 1: Setup

_No setup tasks — additive change to an existing project. Work begins at Foundational._

---

## Phase 2: Foundational (blocking prerequisites)

The column, validation, service threading, and read-model field let comps be **stored and surfaced**.
The report does not change yet (the `payingDancers` formula is deliberately still untouched here), so
existing figures are provably unaffected until US1.

- [X] T001 Author migration `0019_door_comp_count.sql` in `src/server/db/migrations/`:
  `ALTER TABLE door_records ADD COLUMN IF NOT EXISTS comp_count integer NOT NULL DEFAULT 0;` (additive, no
  backfill — per [data-model.md](data-model.md))
- [X] T002 [P] Update `src/server/db/schema/door.ts` — add `compCount: integer("comp_count").notNull().default(0)`
  to the `doorRecords` table (alongside `giftCardRedemptionCount`)
- [X] T003 [P] Validation: `src/server/validation/door.ts` `doorRecordPatchSchema` gains
  `compCount: z.number().int().min(0).optional()`
- [X] T004 `src/server/domain/door/doorRecordService.ts` — add `compCount: number` to `DoorRecordView`
  and `toView` (`row.compCount`); in `updateDoorRecord` set `compCount: input.compCount ?? current.compCount`.
  Depends on T002 + T003.
- [X] T005 [P] `src/server/domain/gate/eventMoney.ts` — add `compCount: number` to the `EventGate` type,
  return `0` in `zero()`, and return `door.compCount` from `computeEventGate` (the door row is already
  loaded — no extra query). Depends on T002.
- [X] T006 Apply migration `0019` to dev + test DBs (`pnpm run db:migrate`; `resetDb` needs no change — no
  new table). Depends on T001.

**Checkpoint**: comps persist on the door record via PATCH and flow into `EventGate`; the organizer report
still produces identical figures (formula unchanged), proving no accidental regression.

---

## Phase 3: User Story 1 — Record comps so paying-dancer count and Avg Ticket are accurate (Priority: P1) 🎯 MVP

**Goal**: Recording a comp count lowers the event's paying-dancer count and raises Avg Ticket.

**Independent test**: Record a comp count of 3 on an event; the organizer report's paying-dancer count for
that event drops by 3 and Avg Ticket rises accordingly.

### Tests first (MUST fail before implementation)

- [X] T007 [P] [US1] Unit test — extend `tests/unit/organizer.metrics.test.ts`: `payingDancers(30, 4, 0) === 25`
  (unchanged), `payingDancers(30, 4, 3) === 22` (comps subtract), `payingDancers(5, 4, 10) === 0` (floored)
  (FR-003, SC-001, SC-004)
- [X] T008 [P] [US1] Integration test — new `tests/integration/doorCompCount.test.ts`: create an event with
  a known attendance + door record, assemble the report for a baseline; PATCH `/api/door-records/{id}` with
  `compCount: 3` → report `dancers` drops by 3 and `avgTicket` rises (real `zak1_test`) (FR-001, FR-002,
  FR-003, FR-004, SC-001)

### Implementation

- [X] T009 [US1] `src/server/domain/organizer/danceResult.ts` — `payingDancers(attendanceCount, performerCount, compCount = 0)`
  returns `Math.max(0, attendanceCount - performerCount - 1 - compCount)`; update the doc comment
- [X] T010 [US1] `src/server/domain/organizer/reportService.ts` — pass the event's comps:
  `payingDancers(ev.attendanceCount, performerCount, gate.compCount)` (comes from `computeEventGate`).
  Depends on T005 + T009.
- [X] T011 [US1] Gate UI `src/app/(door)/gate/page.tsx` — add a **Comps** count input to the "Cash & card
  reconciliation" section and include `compCount: Number(comps) || 0` in the door-record PATCH body

**Checkpoint**: US1 independently testable — comps recorded at the door reduce paying dancers and raise Avg
Ticket everywhere the report is shown.

---

## Phase 4: User Story 2 — Gift-card redeemers stay paying; no comps means no change (Priority: P2)

**Goal**: Gift-card redemptions never reduce paying dancers, and an event with no comps reports exactly as
before this feature. No new implementation — this behavior falls out of US1 (defaulted `compCount`, existing
floor and the untouched `gift_card_redemption_count`); this phase locks it with tests.

**Independent test**: An event with a gift-card redemption but no comps has the same paying-dancer count as
baseline; an event with comp count 0 matches pre-feature figures.

### Tests first

- [X] T012 [P] [US2] Integration test — in `tests/integration/doorCompCount.test.ts`: (a) PATCH
  `giftCardRedemptionCount: 2` with no comps → report `dancers` unchanged vs. baseline (FR-005, SC-002);
  (b) an event whose door record has `comp_count = 0` (or no door record) → `dancers`/`avgTicket` equal
  baseline (FR-006, FR-007, SC-003)

**Checkpoint**: US2 independently testable — gift-card redeemers remain paying; zero-comp events show no
regression.

---

## Phase 5: Polish & Cross-Cutting

- [X] T013 [P] Update `src/server/db/seed.ts` — give a sample event's door record a non-zero `comp_count`
  so dev/demo data exercises the field
- [X] T014 [P] Verify all [quickstart.md](quickstart.md) scenarios, including the **no-regression** guard:
  an event reconciled without comps appears in the organizer report exactly as before feature 014
- [X] T015 [P] Constitution compliance pass: strict types with no undocumented `any`/`as`, real-Postgres
  integration tests, `no-console` lint clean on changed files; confirm the dev route index
  (`src/app/dev/routes/page.tsx`) needs no change (no routes added or removed — only a field)

---

## Dependencies & Execution Order

- **Foundational (T001–T006)** before all stories. Within it: T002/T003 are independent `[P]`; T004 depends
  on T002+T003; T005 `[P]` depends on T002 (different file from T004); T006 depends on T001.
- **US1 (P1)**: tests T007 + T008 → impl T009 → T010 (needs T005+T009); T011 is independent UI once T003 exists.
- **US2 (P2)**: test T012 only (no impl — behavior falls out of US1). Depends on US1 being in place.
- **Polish (T013–T015)** after the stories they verify.

## Parallel Opportunities

- Foundational: T002 and T003 in parallel; T005 in parallel with T004 (different files, both after T002).
- US1: T007 (unit) and T008 (integration) authored in parallel; T011 (UI) parallel with T009 (domain).
- Polish: T013/T014/T015 independent.

## Implementation Strategy

1. **Foundational** — store + surface comps (column, validation, service, `EventGate`), report formula
   still untouched to prove no regression.
2. **MVP = Foundational + US1** — the formula change + report wiring + UI that makes comps reduce paying
   dancers and raise Avg Ticket (the core of P2-5).
3. Add **US2** — guardrail tests pinning gift-card-stays-paying and zero-comp no-regression.
4. Polish: seed demo data, full quickstart incl. no-regression, constitution pass.

## Format validation

All tasks use `- [ ] T### [P?] [US#?] description + file path`. Setup/Foundational/Polish carry no story
label; US phases carry `[US1]`/`[US2]`. 15 tasks total.
