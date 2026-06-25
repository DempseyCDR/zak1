# Tasks: Treasurer Report & QBO Hand-off

**Feature**: `004-treasurer-report` | **Plan**: [plan.md](plan.md) | **Spec**: [spec.md](spec.md)

**Stack**: TypeScript / Next.js (App Router) + PostgreSQL 16, Drizzle, Zod, pino, Vitest. Extends the
existing project; reuses features 002 (door records, gate sales, POS fee, deposit) and 003 (bookings,
performers) plus shared `money`/`logger`/`audit`/`withLogging`/`parseBody`. Money is integer cents.
The report is a computed read-model (no report tables).

**Test-First is NON-NEGOTIABLE** (constitution Principle I): test tasks are written first and MUST
fail before implementation. Integration tests run against the real `zak1_test` database — no DB mocking.

**Conventions**: `[P]` = parallelizable (different files, no incomplete deps). Story labels `[US1]`,
`[US2]`, `[US3]`. Paths repo-relative.

---

## Phase 1: Setup

- [ ] T001 [P] Zod schemas for mapping edits, non-dance-income, and check-number inputs in `src/server/validation/treasurer.ts`

---

## Phase 2: Foundational (blocking prerequisites)

- [ ] T002 Author migration `0006_treasurer.sql` (account_mapping, series_qbo_map, non_dance_income, mapping_audit, treasurer_report_audit; add `check_number` to bookings) in `src/server/db/migrations/`
- [ ] T003 [P] Drizzle schema for `account_mapping` + `series_qbo_map` in `src/server/db/schema/qboMapping.ts`
- [ ] T004 [P] Drizzle schema for `non_dance_income` in `src/server/db/schema/nonDanceIncome.ts`
- [ ] T005 [P] Drizzle schema for `mapping_audit` + `treasurer_report_audit` in `src/server/db/schema/treasurerAudit.ts`; add `checkNumber` to `bookings` schema; export all from `src/server/db/schema/index.ts`
- [ ] T006 Apply migration to dev DB and extend `resetDb` to truncate the new tables in `tests/integration/helpers/db.ts`
- [ ] T007 [P] Seed `account_mapping` (CDR chart of accounts) and `series_qbo_map` (gate customers + classes) in `src/server/db/seed.ts`
- [ ] T008 Mapping resolver (account by line_key; gate customer + class by series) in `src/server/domain/treasurer/mappingService.ts`

**Checkpoint**: mapping config seeded + resolvable; new tables ready.

---

## Phase 3: User Story 1 — Produce a per-event Treasurer Report (Priority: P1)

**Goal**: Assemble the per-event report with Gate Sales Summary, Named-Customer Receipts, Performer
Payments, Deposit, Fees (informational), and a separate Non-Dance Income section; screen-first/printable.

**Independent test**: For a completed event with a door record + bookings, generate the report and
confirm all sections are present and populated; performer payments show check numbers; non-dance income
appears as its own section.

### Tests first (MUST fail before implementation)

- [ ] T009 [P] [US1] Integration test: `GET /api/events/:id/treasurer-report` returns all sections populated from the door record; generating it writes a `treasurer_report_audit` row; 404 `DOOR_RECORD_NOT_FOUND` when none, in `tests/integration/treasurer.report.test.ts` (FR-001/003/012/014)
- [ ] T010 [P] [US1] Integration test: Performer Payments list shows payee/amount/account/class/checkNumber; `PATCH /api/bookings/:id/check` sets the number, in `tests/integration/treasurer.performer-payments.test.ts` (FR-011)
- [ ] T011 [P] [US1] Integration test: `POST /api/events/:id/non-dance-income` then report shows a Non-Dance Income section (acct 4910) excluded from gate totals, in `tests/integration/treasurer.non-dance-income.test.ts` (FR-010)

### Implementation

- [ ] T012 [US1] Report assembler (gate summary w/ POS verification, named-customer, performer payments, deposit, fees, non-dance income) in `src/server/domain/treasurer/reportService.ts`
- [ ] T013 [US1] Non-dance-income service (create/list per event; total) in `src/server/domain/treasurer/nonDanceIncomeService.ts`
- [ ] T014 [P] [US1] Route handler `GET /api/events/[id]/treasurer-report` (writes report-generation audit) in `src/app/api/events/[id]/treasurer-report/route.ts`
- [ ] T015 [P] [US1] Route handlers `POST/GET /api/events/[id]/non-dance-income` in `src/app/api/events/[id]/non-dance-income/route.ts`
- [ ] T016 [P] [US1] Route handler `PATCH /api/bookings/[id]/check` in `src/app/api/bookings/[id]/check/route.ts`
- [ ] T017 [US1] Treasurer report UI (screen-first, printable) in `src/app/(admin)/treasurer/[eventId]/page.tsx`

**Checkpoint**: US1 independently testable — a complete, copy/paste-ready report.

---

## Phase 4: User Story 2 — Map categories to accounts and receipts (Priority: P1)

**Goal**: Each money line maps to the configured account + class; anonymous gate receipt per event
("Contra Gate"/"English Gate"); memberships and advance tickets split to named-customer receipts;
gift cards to liability; mapping editable and audited.

**Independent test**: Configure mapping; run a mixed-category event; confirm accounts/classes/customer,
named-customer split, gift-card liability, and that mapping edits are audited.

### Tests first (MUST fail before implementation)

- [ ] T018 [P] [US2] Integration test: each category lands on its configured account; gate customer is "Contra Gate" (TNC/Community Dance) / "English Gate" (ECD); gift_card → 2201, in `tests/integration/treasurer.mapping.test.ts` (FR-004/006/007, SC-003)
- [ ] T019 [P] [US2] Integration test: membership + advance-ticket lines appear as separate named-customer receipts, never on the gate receipt, in `tests/integration/treasurer.named-customer.test.ts` (FR-005/SC-004)
- [ ] T020 [P] [US2] Integration test: same-evening Community Dance + TNC → two gate receipts, both "Contra Gate", in `tests/integration/treasurer.same-evening.test.ts` (FR-004)
- [ ] T021 [P] [US2] Integration test: editing a mapping writes a mapping audit entry, in `tests/integration/treasurer.mapping-audit.test.ts` (FR-014)

### Implementation

- [ ] T022 [US2] Apply mapping in the assembler (accounts/classes/customer, named-customer split, gift-card→liability, exclude Non-Dance Income from gate totals) in `src/server/domain/treasurer/reportService.ts`
- [ ] T023 [US2] Mapping config service (get all; update account; update series map; write audit) in `src/server/domain/treasurer/mappingService.ts`
- [ ] T024 [P] [US2] Route handlers `GET /api/qbo-mapping`, `PUT /api/qbo-mapping/accounts/[lineKey]`, `PUT /api/qbo-mapping/series/[seriesId]` in `src/app/api/qbo-mapping/`
- [ ] T025 [US2] QBO-mapping admin UI in `src/app/(admin)/qbo-mapping/page.tsx`

**Checkpoint**: US2 independently testable — correct, configurable, audited account/class mapping.

---

## Phase 5: User Story 3 — Calculate and reconcile fees (Priority: P2)

**Goal**: Door and online fees computed per formula; revenue reported at gross; fees informational only.

**Independent test**: Confirm door fee = $0.09×txns + 2.29%×gross (from the door record) and the online
calculator = $0.49×txns + 1.99%×amount; revenue lines are gross; fees shown separately.

### Tests first (MUST fail before implementation)

- [ ] T026 [P] [US3] Unit test: `onlineFeeCents(txns, gross)` = $0.49×txns + 1.99%×gross exact in cents; door fee sourced from the door record, in `tests/unit/treasurer.fees.test.ts` (FR-008/SC-002)
- [ ] T027 [P] [US3] Integration test: report Fees section shows the door fee (from the door record) and revenue is reported at gross (fees not subtracted from revenue), in `tests/integration/treasurer.fees.test.ts` (FR-009)

### Implementation

- [ ] T028 [P] [US3] Online fee calculator `onlineFeeCents(txns, grossCents)` (fixed formula; cards/Venmo only) in `src/server/domain/treasurer/fees.ts` (door fee reused from feature 002 `posFeeCents`)
- [ ] T029 [US3] Fees section in the assembler (door fee from record + online 0 until feature 007; account 5810) in `src/server/domain/treasurer/reportService.ts`

**Checkpoint**: US3 independently testable — fees exact, informational, revenue at gross.

---

## Phase 6: Polish & Cross-Cutting

- [ ] T030 [P] Update the dev route index `src/app/dev/routes/page.tsx` with the new routes (treasurer-report, non-dance-income, qbo-mapping, bookings/check; UI /treasurer, /qbo-mapping) per the temporary convention
- [ ] T031 [P] Verify all [quickstart.md](quickstart.md) scenarios end-to-end
- [ ] T032 [P] Confirm audit on report generation + mapping edits and structured logging on new handlers (Principle IV)
- [ ] T033 [P] Constitution compliance pass: strict types, integer-cents money, real-Postgres tests, no undocumented `any`/`as`
- [ ] T034 [P] Update README with treasurer/qbo-mapping routes and the report

---

## Dependencies & Execution Order

- **Setup (T001)** → **Foundational (T002–T008)** → user stories.
- **US1 (P1)** depends on Foundational (mapping resolver + seed) → **MVP** (produces the report).
- **US2 (P1)** extends the US1 assembler with configurable mapping nuances + config endpoints/UI/audit;
  build after US1.
- **US3 (P2)** adds the online-fee calculator and the fees-at-gross guarantees; independent of US2.
- Within a story: tests first (must fail) → services → routes → UI.

## Parallel Opportunities

- Foundational: schema files T003/T004/T005 and seed T007 in parallel after the migration (T002).
- Each story's `[P]` test tasks can be authored together before implementation.
- Route handlers marked `[P]` are separate files from their services.

## Implementation Strategy

1. **MVP = US1** (produce the per-event report) on top of Foundational — the treasurer's close-out tool.
2. Add **US2** (configurable, audited account/class mapping + named-customer split).
3. Add **US3** (fee calculation + reconciliation, revenue at gross).
4. Polish + dev-route index + constitution pass.

## Format validation

All tasks use `- [ ] T### [P?] [US#?] description + file path`. Setup/Foundational/Polish carry no
story label; US phases carry `[US1]/[US2]/[US3]`. 34 tasks total.
