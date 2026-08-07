# Phase 1 Data Model: Substitution Move + Multi-Booking Check Fix

**No database change.** No new entity, column, index, or migration. No Zod/schema change either — D3's correction
rides the existing PATCH contract.

## Entities involved (all existing, unchanged shape)

- **Booking** — `bookings` row (performer, band, status, event). Substitution re-points it (unpaid) or leaves it a
  `declined` no-show and adds a fresh booking (live-paid). **Behavior unchanged (024).**
- **Performer payment** — `performer_payments` (+ `payment_bookings` per-line allocation). D3's correction edits
  only its `check_number`; the allocation (`payment_bookings.amount_cents`) is untouched.

## Authorization change (behavioral, not data)

- **`POST /api/bookings/[id]/substitute`**: layer-1 requirement `booking.write` → `base`. Real gate is layer-2:
  the actor must hold **`booking.write` OR `performer_payment.write`** in the booking's event scope.
- **New helper** `assertEventScopeAny(actor, capabilities[], event)` in `can.ts` (typed; no data).

## Contract shapes (existing — reused, not changed)

- `performerPaymentPatchSchema`: `checkNumber` (string|null, optional), `lines` (array, optional — **replaces** the
  allocation only when present), `overrideReason` (optional). D3's correction sends `{ checkNumber }` **without**
  `lines`.
- `POST /api/performer-payments` (create / multi-apply): `checkNumber` optional, `overrideReason` optional. D3's
  capture change is **client-side** (the popup's save guard); the create contract is unchanged.

## Validation / behavior rules (from FRs)

- **Substitute** authorized by either capability in event scope (FR-003/FR-005); undefined actor bypasses
  (internal). Semantics unchanged (FR-004).
- **Multi capture** (FR-006/FR-007): positive total + no check number ⇒ require a comment before saving; a check
  number is never forced.
- **Multi correction** (FR-008/FR-009): a check-number-only PATCH updates `check_number` and preserves every
  line's amount.

## Invariants

- No payment amount or allocation changes as a side effect (SC-005).
- The treasurer report shows a corrected multi-booking check number instead of a dash (SC-004) — a read of the
  now-populated `check_number`, no report change.
