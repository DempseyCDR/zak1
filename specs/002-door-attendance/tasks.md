# Tasks: Door Attendance & Gate Capture

**Feature**: `002-door-attendance` | **Plan**: [plan.md](plan.md) | **Spec**: [spec.md](spec.md)

**Stack**: TypeScript / Next.js (App Router) + PostgreSQL 16, Drizzle, Zod, pino, Vitest. Extends the
existing feature-001 project; reuses `contactService.searchContacts`, `logger`, `audit`,
`withLogging`, `parseBody`. Money is integer cents.

**Test-First is NON-NEGOTIABLE** (constitution Principle I): test tasks are written first and MUST
fail before implementation. Integration tests run against the real `zak1_test` database — no DB mocking.

**Conventions**: `[P]` = parallelizable (different files, no incomplete deps). Story labels `[US1]`,
`[US2]`, `[US3]`. Paths repo-relative.

---

## Phase 1: Setup

- [X] T001 [P] Add integer-cents money helpers (parse dollars→cents, format, exact add) in `src/server/lib/money.ts`
- [X] T002 [P] Add enums (`gate_category`, `payment_method`, `event_group_kind`) to `src/server/db/schema/enums.ts`

---

## Phase 2: Foundational (blocking prerequisites)

- [X] T003 Author migration `0004_door.sql` (series, event_groups, events (with `group_id`), door_records, gate_sales, attendance, quarterly_attendance_counts, door_record_audit; add `needs_review`/`source` to contacts) in `src/server/db/migrations/`
- [X] T004 [P] Drizzle schema for `series` + `event_groups` + `events` (with `group_id`) in `src/server/db/schema/events.ts`
- [X] T005 [P] Drizzle schema for `door_records` + `gate_sales` + `door_record_audit` in `src/server/db/schema/door.ts`
- [X] T006 [P] Drizzle schema for `attendance` (FK→event) + `quarterly_attendance_counts` in `src/server/db/schema/attendance.ts`
- [X] T007 [P] Extend `contacts` schema with `needsReview` + `source` in `src/server/db/schema/contacts.ts`; export all new tables from `src/server/db/schema/index.ts`
- [X] T008 Apply migration to dev DB and confirm test harness `resetDb` truncates the new tables in `tests/integration/helpers/db.ts`
- [X] T009 [P] Seed `series` (TNC, ECD, Community Dance) in `src/server/db/seed.ts`
- [X] T010 Events domain service (create event group; create event for series+date with optional group; list by date range) in `src/server/domain/events/eventService.ts`
- [X] T011 [P] Zod schemas for event groups, events, + door-record create in `src/server/validation/door.ts`
- [X] T012 Door-record create service (0-or-1 per event, defaults incl. seed float $15; created when money is collected — always for paid events, for free events only when donations; writes an audit entry on creation per FR-012) in `src/server/domain/door/doorRecordService.ts`
- [X] T013 [P] Route handlers `POST/GET /api/events` and `POST /api/event-groups` in `src/app/api/events/route.ts` and `src/app/api/event-groups/route.ts`
- [X] T013a [P] Integration test: create an event group and an event assigned to it; unknown `groupId` → 404 `EVENT_GROUP_NOT_FOUND`, in `tests/integration/event-groups.test.ts` (FR-013)
- [X] T014 [P] Route handler `POST /api/door-records` in `src/app/api/door-records/route.ts`
- [X] T014a Integration test: two events on the same date each get their own door record; a second door record for the same event → 409 `DOOR_RECORD_EXISTS`, in `tests/integration/door.record-create.test.ts` (FR-009)

**Checkpoint**: events + a door record can be created; both stories can attach to it.

---

## Phase 3: User Story 1 — Check dancers in at the door (Priority: P1)

**Goal**: Volunteer finds dancers by fast fuzzy search and records attendance: existing match, new
contact (flagged for review), or unmatched.

**Independent test**: Search a partial name → ranked candidates < 300 ms; record an existing contact;
create a new contact at the door (flagged `needs_review`); record an unmatched attendance.

### Tests first (MUST fail before implementation)

- [X] T015 [P] [US1] Integration test: `GET /api/attendance/search?q=` returns ranked candidates with emails, p95 < 300 ms, in `tests/integration/door.checkin-search.test.ts` (FR-001/002)
- [X] T016 [P] [US1] Integration test: `POST /api/events/:id/attendance { contactId }` records attendance against the event (no door record needed); duplicate → 409 `ALREADY_CHECKED_IN`, in `tests/integration/door.attendance-match.test.ts` (FR-001a/010)
- [X] T017 [P] [US1] Integration test: `{ newContact }` creates a contact flagged `needs_review` and records it, in `tests/integration/door.attendance-new.test.ts` (FR-003)
- [X] T018 [P] [US1] Integration test: `{ unmatched: true }` records attendance with null contact, in `tests/integration/door.attendance-unmatched.test.ts` (FR-004)
- [X] T018a [P] [US1] Integration test: `GET /api/events/:id/attendance` returns the attendee list (matched names + unmatched placeholders) + count, in `tests/integration/attendance.list.test.ts` (FR-001b)

### Implementation

- [X] T019 [US1] Attendance service (record existing / new-with-review / unmatched against an event; duplicate guard) in `src/server/domain/attendance/attendanceService.ts`
- [X] T020 [P] [US1] Zod schema for the attendance request union in `src/server/validation/attendance.ts`
- [X] T021 [P] [US1] Route handler `GET /api/attendance/search` proxying `contactService.searchContacts` (+ emails) in `src/app/api/attendance/search/route.ts`
- [X] T022 [US1] Route handlers `POST/GET /api/events/:id/attendance` in `src/app/api/events/[id]/attendance/route.ts`
- [X] T023 [US1] Door check-in UI (pick an event, search box, ranked pick list, new-contact + unmatched actions) in `src/app/(door)/checkin/page.tsx`

**Checkpoint**: US1 independently testable — full check-in flow.

---

## Phase 4: User Story 2 — Record the door's money (Priority: P1)

**Goal**: Capture seven gate categories × {cash,card} and cash reconciliation; system computes the POS
fee (hidden from the volunteer) and the deposit.

**Independent test**: Enter gate sales + cash/POS fields; verify computed fee and deposit are exact
and the door response omits the fee; payout without a reason is rejected.

### Tests first (MUST fail before implementation)

- [X] T024 [P] [US2] Unit test: POS fee = $0.09×txns + 2.29%×gross and deposit = gross cash − seed float − payout, exact in cents, in `tests/unit/door.calc.test.ts` (FR-007/008)
- [X] T025 [P] [US2] Integration test: `PUT /api/door-records/:id/gate-sales` stores all 7 categories × {cash,card}; unknown category → 422, in `tests/integration/door.gate-sales.test.ts` (FR-005)
- [X] T026 [P] [US2] Integration test: `PATCH /api/door-records/:id` computes fee+deposit and the response OMITS the fee; payout without reason → 422 `CASH_PAYOUT_REASON_REQUIRED`; gift-card redemption count persists, in `tests/integration/door.record-update.test.ts` (FR-006/007/008)
- [X] T026a [P] [US2] Integration test: a free event (`chargesAdmission=false`) records attendance with no door record; once a `donation` gate sale is added a door record is created with no `today_admission`, in `tests/integration/door.free-event.test.ts` (FR-010)
- [X] T026b [P] [US2] Integration test: creating and editing a door record each write an auditable entry (who/what/when) to the audit trail, in `tests/integration/door.audit.test.ts` (FR-012)

### Implementation

- [X] T027 [P] [US2] Pure fee + deposit calculators (cents) in `src/server/domain/door/calc.ts`
- [X] T028 [US2] Extend door-record service: update fields, recompute fee+deposit, upsert gate sales, write an audit entry on edit (FR-012), return fee-omitting view in `src/server/domain/door/doorRecordService.ts`
- [X] T029 [P] [US2] Route handler `PATCH /api/door-records/:id` + `GET /api/door-records/:id` (fee omitted) in `src/app/api/door-records/[id]/route.ts`
- [X] T030 [P] [US2] Route handler `PUT /api/door-records/:id/gate-sales` in `src/app/api/door-records/[id]/gate-sales/route.ts`
- [X] T031 [US2] Gate-money entry UI (7 categories × cash/card, cash fields, live deposit; no fee shown) in `src/app/(door)/gate/page.tsx`

**Checkpoint**: US2 independently testable — gate capture with exact, fee-concealed math.

---

## Phase 5: User Story 3 — Contact-tracing retention (Priority: P3)

**Goal**: Identifiable attendance purged after 90 days; permanent quarterly counts persist.

**Independent test**: Age attendance past 90 days, run purge → rows counted into
`quarterly_attendance_counts` then deleted; counts persist; second run is a no-op.

### Tests first (MUST fail before implementation)

- [X] T032 [P] [US3] Integration test: purge rolls >90-day attendance (matched + unmatched) into quarterly counts by series/year/quarter, deletes those rows, and is idempotent, in `tests/integration/attendance.purge.test.ts` (FR-011)
- [X] T033 [P] [US3] Integration test: attendance within 90 days is retained and not yet counted, in `tests/integration/attendance.retention.test.ts` (FR-011)

### Implementation

- [X] T034 [US3] Retention service: transactional roll-up + purge of >90-day attendance in `src/server/domain/attendance/retentionService.ts`
- [X] T035 [US3] Purge job (cron + CLI entrypoint) in `src/jobs/attendance-purge.ts`

**Checkpoint**: US3 independently testable — retention + permanent aggregates.

---

## Phase 6: Polish & Cross-Cutting

- [X] T036 [P] Extend `src/server/db/seed.ts` with sample events + a door record for manual validation
- [X] T037 [P] Verify all [quickstart.md](quickstart.md) scenarios end-to-end
- [X] T038 [P] Confirm no door-facing response exposes the POS fee and structured logging covers new handlers (Principle IV)
- [X] T039 [P] Constitution compliance pass: strict types, integer-cents money, real-Postgres tests, no undocumented `any`/`as`
- [X] T040 [P] Update README with door/gate routes and the purge job

---

## Dependencies & Execution Order

- **Setup (T001–T002)** → **Foundational (T003–T014)** → user stories.
- **US1 (P1)** and **US2 (P1)** both depend on Foundational (events + door-record create). They are
  otherwise independent and can proceed in parallel; **US1 is the suggested MVP**.
- **US3 (P3)** depends on attendance rows existing (US1) and the quarterly-counts table (Foundational).
- Within a story: tests first (must fail) → services → routes → UI.

## Parallel Opportunities

- Setup: T001, T002 together.
- Foundational: schema files T004–T007 in parallel after T003; routes T013/T014 after their services.
- Each story's `[P]` test tasks can be authored together before implementation.

## Implementation Strategy

1. **MVP = US1** (check-in) on top of Foundational — the core nightly volunteer workflow.
2. Add **US2** (gate money) — completes the financial capture feeding features 004/005.
3. Add **US3** (retention) — privacy/compliance + permanent aggregates for feature 005.
4. Polish + constitution pass.

## Format validation

All tasks use `- [ ] T### [P?] [US#?] description + file path`. Setup/Foundational/Polish carry no
story label; US phases carry `[US1]/[US2]/[US3]`. 45 tasks total.
