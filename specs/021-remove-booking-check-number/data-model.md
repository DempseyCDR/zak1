# Data Model: Remove `bookings.check_number`

## Changed entity — Booking

`bookings` (the *expectation*: who is booked at an event and the expected pay).

| Field | Before | After |
|---|---|---|
| `check_number text` | present (redundant check store) | **REMOVED** |
| `requires_check boolean` | present | **kept** — the flag that this booking is paid by check |
| all other columns | present | unchanged |

`BookingRow` (Drizzle `$inferSelect`) loses `checkNumber`; TypeScript flags every stale reference.

## Unchanged entity — Performer payment (sole check store)

`performer_payments` + `payment_bookings` — unchanged by this feature. `performer_payments.check_number`
becomes the **only** place a performer-payment check number lives. The treasurer report already reads it.

## Migration `0026_drop_bookings_check_number.sql`

Additive-then-drop; ordering is essential (reconcile → drop). Shape (final SQL authored in implementation):

```sql
-- Feature 021: remove bookings.check_number. performer_payments is the sole check store (corrects 019).
-- STEP 1 (mandatory, lossless): mirror any residual bookings.check_number into performer_payments.
--   The gate /check route wrote ONLY bookings.check_number; the 0024 backfill covered only pay_cents>0.
--   So a check entered via the gate after 0024 lives solely on the booking — mirror it before dropping.
--   Idempotent via the NOT EXISTS guard on payment_bookings (per-row loop, as in 0024).
-- STEP 1a (conflict guard): RAISE if any booking's LINKED payment has a DIFFERENT non-null check_number
--   (a check edited via the gate after 0024). Expected empty pre-rollout; surfaces rather than loses.
-- STEP 1b: fill a LINKED payment's NULL check_number from the booking (no conflict).
-- STEP 2: ALTER TABLE bookings DROP COLUMN check_number;
```

**Invariants after migration**
- `SELECT count(*) FROM information_schema.columns WHERE table_name='bookings' AND column_name='check_number'`
  → `0` (SC-001).
- Every pre-migration `bookings.check_number` value is retrievable via `performer_payments.check_number`
  (FR-003 / SC-002).
- No row exists where a booking had a check number and its event has **no** `performer_payments` row
  (guarantees `deleteEvent` Blocker 3 covers the former Blocker 2 set — R2).

## Downstream code deletions (no new schema)

- `checkNumberPatchSchema` / `CheckNumberPatchInput` in `validation/treasurer.ts` — deleted with the route.
- `deleteEvent` Blocker 2 — deleted; Blocker 3 (`performer_payments`) is the sole check-related deletion
  guard.
- Re-point branch `checkNumber: null` — deleted (nothing to clear).
