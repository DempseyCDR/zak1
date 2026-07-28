---
description: "Task list for feature 021 — remove bookings.check_number"
---

# Tasks: Remove `bookings.check_number` — single home for check numbers

**Input**: Design documents from `specs/021-remove-booking-check-number/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/
**Tests**: INCLUDED — the constitution (v1.3.0, Principle I) mandates test-first.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1 / US2 / US3 (from spec.md)
- Exact file paths included.

## Atomicity note

This is a corrective feature: all three P1 stories land in **one atomic commit** (constitution solo-maintainer
mode). The stories are **validation lenses**, not independently shippable slices — TypeScript will not compile
until every `check_number` reference is removed together. Phases are ordered by **dependency**: the migration's
reconciliation (US3) MUST precede the column drop (US1), and the guardrail (US2) rides along. There is no
partial-MVP; the "MVP" is the whole feature.

---

## Phase 1: Setup

- [ ] T001 Create the migration file `src/server/db/migrations/0026_drop_bookings_check_number.sql` with a header comment explaining the correction (performer_payments is the sole check store; reconcile before drop).
- [ ] T002 Snapshot safety: capture `~/zak1_pre_0026.dump` from `zak1_dev` before applying (source `.env` first), per the project's pre-backfill convention.

---

## Phase 2: User Story 3 — No check-number history is lost (P1) 🥇 must precede the drop

**Goal**: Every check number recorded before the change remains retrievable via `performer_payments`.

**Independent Test**: Seed a booking check number absent from `performer_payments` (the post-0024 gate case),
run the reconciliation, confirm it is retrievable via `performer_payments`; treasurer report unchanged.

- [ ] T003 [US3] In `0026`, author STEP 1 — the idempotent reconciliation backfill: for each `bookings` row with `check_number IS NOT NULL` and NO linked `payment_bookings`, insert a `performer_payments` row (`event_id`, `payee_performer_id = performer_id`, `amount_cents = pay_cents`, `check_number`) and its `payment_bookings` link (per-row loop, `NOT EXISTS` guard, mirroring 0024).
- [ ] T004 [US3] In `0026`, author STEP 1a — a conflict guard that `RAISE`s if any booking's LINKED payment has a **different** non-null `check_number`; and STEP 1b — fill a linked payment's NULL `check_number` from the booking (research R1).
- [ ] T005 [US3] Reconciliation verification on `zak1_dev` (quickstart), with a concrete before/after assertion: BEFORE applying, record `A = SELECT count(*) FROM bookings WHERE check_number IS NOT NULL` and capture that set of check numbers; apply `pnpm run db:migrate`; AFTER, assert **every** one of those check numbers is retrievable via `performer_payments.check_number` (the count present in `performer_payments` is ≥ A and none of the captured values is missing). If the migration `RAISE`s on a conflict (research R1), resolve before proceeding. The pre-migration snapshot (T002) is the rollback. (The one-time backfill is not Vitest-testable post-drop — the column is gone from the test schema — mirroring how 0024/0025 backfills are validated.)
- [ ] T006 [P] [US3] Confirm treasurer parity is covered: `tests/integration/treasurer.paymentsCutover.test.ts` and `tests/integration/treasurer.performer-payments.test.ts` stay green (they read `performer_payments.check_number`, the kept store); adjust only if a setup seeds `bookings.check_number` (convert to a `performer_payments` seed).

**Checkpoint**: reconciliation authored and verified; safe to drop the column.

---

## Phase 3: User Story 1 — One home for a check number (P1)

**Goal**: The booking record carries no check number anywhere; a check number lives only on the payment record.

**Independent Test**: `tsc` clean with no `checkNumber` reference on bookings; the `/check` endpoint is gone;
no booking payload/type exposes a check number.

### Tests (write/update first)

- [ ] T007 [P] [US1] Update `tests/integration/booking.status.test.ts` — in the re-point test, remove the `checkNumber: "1234"` seeding and the `checkNumber` toBeNull assertion; keep asserting status → `proposed` and the performer swap.
- [ ] T008 [P] [US1] Update `tests/integration/tentative.public.test.ts` — remove the `bookings.checkNumber = "9001"` seeding and the `checkNumber` null assertion (the "public leak" concern disappears with the field).

### Implementation

- [ ] T009 [US1] In `0026`, author STEP 2 — `ALTER TABLE bookings DROP COLUMN check_number;` (after STEP 1). Apply with `pnpm run db:migrate`.
- [ ] T010 [US1] Remove the `check_number` column from `src/server/db/schema/bookings.ts` (KEEP `requires_check`).
- [ ] T011 [P] [US1] Delete the route file `src/app/api/bookings/[id]/check/route.ts` (the only writer of `bookings.check_number`).
- [ ] T012 [P] [US1] Remove `checkNumberPatchSchema` and `CheckNumberPatchInput` from `src/server/validation/treasurer.ts`.
- [ ] T013 [P] [US1] Remove `checkNumber: null` from the re-point branch in `src/server/domain/bookings/bookingService.ts` (nothing to clear now).
- [ ] T014 [US1] Remove the check-number input, its `checkInputs`/`needChecks` prefill state, and the `PATCH /api/bookings/[id]/check` call from `src/app/(door)/gate/page.tsx` (gate check-entry is rebuilt on `performer_payments` in the FS-payments feature — R3).

**Checkpoint**: `pnpm exec tsc --noEmit` clean — no stale `checkNumber` reference remains.

---

## Phase 4: User Story 2 — Delete guardrail still protects paid events (P1)

**Goal**: An event with a recorded performer-payment check remains undeletable, now via `performer_payments`.

**Independent Test**: Deleting an event with a `performer_payments` row is refused ("a recorded performer
payment"); an event with none is not blocked by this guard.

### Tests (write/update first)

- [ ] T015 [US2] Update `tests/integration/event.delete.test.ts` — convert the "paid booking (check number)" case: seed a `performer_payments` row via the already-imported `createPerformerPayment` instead of `bookings.checkNumber`, and assert deletion is refused with detail "a recorded performer payment" (Blocker 3). Keep/confirm the no-payment case is not blocked by this guard.

### Implementation

- [ ] T016 [US2] Remove Blocker 2 (`isNotNull(bookings.check_number)` — "a paid booking (check number)") from `deleteEvent` in `src/server/domain/events/eventService.ts`; keep Blocker 3 (`performer_payments`). Drop any now-unused `bookings`/`isNotNull`/`and` imports.

**Checkpoint**: event-deletion protection preserved through `performer_payments` alone.

---

## Phase 5: Polish & Cross-Cutting

- [ ] T017 [P] Sweep for residual references: `grep -rniE "check_number|checkNumber" src` — confirm the only survivors are `performer_payments`/`payment` (the kept store); optionally drop the harmless `checkNumber` term from the public leak-guard regexes in `tests/integration/public.confirmed.test.ts` and `tests/integration/publicEventDetail.test.ts`.
- [ ] T018 Full gate (the reviewer, solo-maintainer mode): `pnpm exec tsc --noEmit`; `pnpm exec eslint <changed files>`; `pnpm exec prettier --check <changed files>`; `pnpm test` (route inventory `auth.routeInventory.test.ts` auto-updates for the removed `/check` route); `pnpm build`. All green.
- [ ] T019 Update `zak1_Phase4_Requirements_v1.md` §7 to mark the "drop `bookings.check_number`" feature as specified/implemented (021), and note migration is `0026`.

---

## Dependencies & execution order

- **T001–T002** (Setup) → everything.
- **US3 (T003–T004)** reconciliation SQL **must be authored before US1 T009** (the `DROP COLUMN`) in the same migration file.
- **US1 T009** (apply migration) before running any test task (the test DB must have the column dropped).
- **US1 T010–T014** (remove all references) must all land before **T018** `tsc` passes — TypeScript enforces completeness.
- **US2 T016** independent of US1's UI/route removals but shares the same commit; **T015** before **T016** (test-first).
- **Polish (T017–T019)** last.

### Parallelizable

- Within US1 tests: **T007, T008** [P] (different files).
- Within US1 impl: **T011, T012, T013** [P] (different files); T010 and T014 touch schema/UI respectively and are independent too, but T009→migration ordering gates when tests can run.
- **T006** [P] (verification, independent).

## Implementation strategy

Ship as **one atomic commit** (`Feature 021: remove bookings.check_number …`) once T018 is fully green.
Recommended authoring order: US3 reconciliation SQL → US1 `DROP COLUMN` + apply → remove all code references
(US1) + guardrail (US2) → update tests → full gate → commit. No incremental/partial delivery: the stories are
verification lenses on a single corrective change.

## Summary

- **Total tasks**: 19 (Setup 2 · US3 4 · US1 8 · US2 2 · Polish 3)
- **Test tasks**: T006, T007, T008, T015 (+ the manual US3 verification T005)
- **Parallel opportunities**: T007/T008; T011/T012/T013; T006
- **MVP scope**: N/A — atomic corrective feature; all three P1 stories ship together.
