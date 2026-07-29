# Data Model: Financial-Secretary payments substrate

Extends the feature-019 tables; no new tables.

## `performer_payments` (a check) — added columns

| Field | Change | Meaning |
|---|---|---|
| `voided_at timestamptz` | **NEW**, nullable | set when the check is voided; NULL = live |
| `void_reason text` | **NEW**, nullable | why (wrong amount, no-show, …) |
| `replaces_payment_id uuid` | **NEW**, nullable, self-FK → performer_payments(id) | the voided check this one reissues |
| `event_id` | unchanged | **recorded-at** event = the check-written date (FR-011) |
| `payee_performer_id` | unchanged | who the check is written to (may differ from settled performers) |
| `amount_cents` | unchanged | the check **total**; MUST equal the sum of its live line amounts |
| `check_number`, `override_reason` | unchanged | sole check store (021); `override_reason` = discrepancy note |

## `payment_bookings` (an allocation line) — added column

| Field | Change | Meaning |
|---|---|---|
| `amount_cents integer` | **NEW**, NOT NULL (backfilled) | the portion of the check applied to this booking |
| `(payment_id, booking_id)` | unchanged PK | one line per (check, booking); `booking_id` already NOT NULL |

A booking may belong to a **different event** than the payment (cross-event); the link no longer requires
same-event (R2).

## Derived: settlement

- **Settled amount of a booking** = `Σ payment_bookings.amount_cents` over lines whose payment has
  `voided_at IS NULL`. A booking with none is **unpaid**.
- **A check balances** iff `performer_payments.amount_cents = Σ` its live line `amount_cents` (SC-002).
- **Delete guardrail (FR-013 / analyze H1)**: an event cannot be deleted while any of its bookings has a
  **live** payment line — *including a check recorded at another event* — so cross-event settlement can't
  orphan a paid line. **Reconciliation (analyze M1)** excludes voided payments and sums live per-line amounts
  by the **booking's** event, not by the event a payment was recorded at.

## Migration `0027_payment_allocation_and_voids.sql`

```sql
-- Feature 023: per-line allocation + voids.
-- STEP 1: add columns (amount_cents nullable first, for the backfill).
ALTER TABLE payment_bookings ADD COLUMN IF NOT EXISTS amount_cents integer;
ALTER TABLE performer_payments
  ADD COLUMN IF NOT EXISTS voided_at timestamptz,
  ADD COLUMN IF NOT EXISTS void_reason text,
  ADD COLUMN IF NOT EXISTS replaces_payment_id uuid REFERENCES performer_payments(id);
-- STEP 2: backfill amount_cents (R6) — one-link payment → payment total; multi-link → split by
--   linked bookings' pay_cents, remainder to the first line so lines sum to the total.
-- STEP 3: enforce NOT NULL once backfilled.
ALTER TABLE payment_bookings ALTER COLUMN amount_cents SET NOT NULL;
```

**Invariants after migration**
- Every `payment_bookings` row has an `amount_cents`; for each payment, `Σ line amount_cents = amount_cents`
  (SC-002).
- No behavior change for existing single-line payments (line amount = the payment total).

## Report re-keying (no schema; query changes)

- **Treasurer (per-event)**: group by `performer_payments.event_id`; **drop** the `bookings.event_id = eventId`
  link filter; emit **per-line** rows (performer, booking, `amount_cents`, account); voided checks in a
  distinct section.
- **Organizer (per-event)**: performer cost = `Σ` live `payment_bookings.amount_cents` where
  `booking.event_id = eventId`; unpaid bookings → separate outstanding-expected figure (R5).
