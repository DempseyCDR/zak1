# Research: Remove `bookings.check_number`

Decisions resolving the plan's technical unknowns. No open `NEEDS CLARIFICATION`.

## R1 — Migration must reconcile before dropping (losslessness)

**Decision**: Migration `0026` runs an **idempotent reconciliation backfill** *before* `DROP COLUMN`:
for every `bookings` row with `check_number IS NOT NULL` that has **no** linked `performer_payments` row
(via `payment_bookings`), create the mirror payment (`event_id`, `payee_performer_id = performer_id`,
`amount_cents = pay_cents`, `check_number`) and the `payment_bookings` link — the same per-row loop shape as
019's 0024 backfill, but keyed on `check_number IS NOT NULL` instead of `pay_cents > 0`.

**Rationale**: The 0024 backfill only mirrored `pay_cents > 0` bookings, and the gate `/check` route writes
**only** `bookings.check_number` (never `performer_payments`). So a check number entered via the gate **after**
0024 exists solely on the booking. Dropping the column without reconciling would lose it (violating FR-003)
and silently remove the delete-guardrail protection for its event.

**Conflict guard**: For the rare case of a booking whose linked payment already has a **different**
`check_number` (a check edited via the gate after 0024 mirrored the original), the migration includes a
pre-drop guard query that **raises** if any such divergence exists, rather than silently discarding a value.
In the current pre-rollout single-maintainer database this set is expected to be empty; raising surfaces it
for a human decision instead of losing data. (A linked payment with a **NULL** check number is filled from the
booking — no conflict.)

**Alternatives considered**: (a) Drop the column outright, trusting 0024 — rejected: demonstrably loses
post-0024 gate entries. (b) Silently prefer the booking value on conflict — rejected: could overwrite a
deliberately different treasurer value; raising is safer for a corrective migration.

## R2 — Delete guardrail: remove Blocker 2, rely on Blocker 3

**Decision**: In `deleteEvent`, delete **Blocker 2** (`isNotNull(bookings.check_number)`); keep **Blocker 3**
(`performer_payments` for the event, added in 019 as FR-019). No re-home needed.

**Rationale**: After R1, every event that had a booking check number has a `performer_payments` row, so
Blocker 3 covers exactly the set Blocker 2 did. Going forward, checks are recorded on `performer_payments`
(the FS-payments feature), which Blocker 3 already guards. The user-facing `eventHasHistory` reason shifts
from "a paid booking (check number)" to the existing "a recorded performer payment" — same protection.

**Alternatives considered**: Rewrite Blocker 2 to read `performer_payments` — rejected as literally
duplicating Blocker 3.

## R3 — Gate check-entry is removed here, rebuilt in the FS-payments feature

**Decision**: Remove the gate's check-number input/prefill and its `PATCH /api/bookings/[id]/check` call, and
delete the route + `checkNumberPatchSchema`. Do **not** build a `performer_payments` entry surface here.

**Rationale**: Recording a check *belongs* on `performer_payments`; that entry surface is the scope of the
separate FS-payments feature (Phase 4 Area B). Building it here would pull that feature forward and violate the
"one small corrective" framing. The system is **pre-rollout**, so a temporary absence of gate check-entry is
acceptable (spec Assumptions). This feature leaves the app compiling and green with no dead references.

## R4 — Keep `requires_check`; only `check_number` is removed

**Decision**: `bookings.requires_check` (the boolean flag that a performer type is paid by check) **stays**;
only the stored `check_number` value is removed. `bookingRequiresCheck(type, payCents)` and its rules/tests are
untouched.

**Rationale**: "This booking needs a check written" is a booking-level expectation (drives the FS's to-do); it
is not the *number*, which is payment data. The two are independent — `requires_check` remains on the
expectation, `check_number` moves entirely to the payment.

## R5 — Route inventory updates itself

**Decision**: No manual sync when removing the `/check` route.

**Rationale**: The route index is generated from the source tree (`src/server/lib/routeInventory.ts`, shared
with `auth.routeInventory.test.ts`), per CLAUDE.md convention (feature 016). Deleting the route file removes it
from the inventory automatically; the test re-derives.

## R6 — Test changes (surface characterized)

**Decision**: Update the tests that **seed or assert** `bookings.check_number`; leave those that only touch
`performer_payments.check_number` (the kept store).

- `tests/integration/event.delete.test.ts` — the "paid booking (check number)" case (sets
  `bookings.checkNumber`, expects that reason) converts to seeding a **`performer_payments`** row (via the
  already-imported `createPerformerPayment`) and asserting the "a recorded performer payment" reason (Blocker
  3). Add/confirm a case that this is what now blocks.
- `tests/integration/booking.status.test.ts` — the re-point test's check-number seeding + `checkNumber` null
  assertion are removed; it keeps asserting status→`proposed` and the performer swap.
- `tests/integration/tentative.public.test.ts` — remove the `bookings.checkNumber` seeding/assertion (the
  "public doesn't leak a check number" concern disappears with the field).
- `tests/integration/public.confirmed.test.ts`, `publicEventDetail.test.ts` — the regex leak-guards mention
  `checkNumber`; harmless (still won't match) — optionally drop the term. No behavior change.
- `tests/integration/{performerPayments,treasurer.paymentsCutover,treasurer.performer-payments}.test.ts` and
  `tests/unit/performer.rules.test.ts` — reference `performer_payments.checkNumber` / `requires_check`, both
  **kept**; unaffected unless a setup seeds `bookings.check_number` (convert to a payment if so).
- **New**: a migration/preservation test — a booking with a check number not yet in `performer_payments` is,
  after the reconciliation path, retrievable via `performer_payments` (FR-003).

**Rationale**: Distinguishing "seeds the removed field" from "reads the kept field" scopes the churn precisely.
