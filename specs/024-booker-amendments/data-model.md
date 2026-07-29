# Data Model: Booker amendments

**No persistent schema change, no migration.** This feature is a set of **operations** over existing entities;
it introduces no new table or column.

## Entities used (unchanged)

- **`bookings`** — the slot (status, performer, `band_id`, `performer_type`, pay). Amended at runtime by the
  cascade (status), re-point (performer + reset), substitute (decline + new booking), and clear (removal).
- **`bands` / `band_members`** — roster + `is_lead`; source for `repointBand` (incoming roster) and for
  identifying the lead whose status cascades (via the booking's `performer_type = 'lead_musician'`).
- **`performer_payments` / `payment_bookings`** (feature 023) — read-only here, via the **discriminator**.

## Derived rule — the written-check discriminator

`bookingHasLivePayment(bookingId)` = `EXISTS` a `payment_bookings` line for the booking whose
`performer_payments.voided_at IS NULL`. Governs:

| Operation | Unpaid (or only voided) | Settled by a LIVE check |
|---|---|---|
| Re-point (`patchBooking` performerId change) | allowed → reset slot to `proposed`, standard rate | **refused** |
| Clear (`deleteBooking`) | allowed → remove the booking | **refused** |
| `substitutePerformer` | re-point the slot | keep original `declined` (no-show) + `createBooking` for the sub |
| `repointBand` (per outgoing member) | remove the booking | keep as `declined` (no-show) |

## State transitions

- **Lead cascade**: a lead's status `S_old → S_new` sets each sibling booking (same event+band) currently at
  `S_old` to `S_new`. Legal by construction (siblings share the lead's from-state; the `bookingStatus`
  transition table is unchanged). Diverged siblings (any status ≠ `S_old`) are untouched.
- **Substitute (paid)** / **band re-point (paid member)**: the outgoing booking goes to `declined` (a kept
  no-show); the incoming performer/band is booked **fresh** at `proposed`.

## Invariants preserved

- A booking settled by a live check is **never** re-pointed, cleared, or removed — so a `payment_bookings`
  line is never orphaned and 023's "check total = Σ live line amounts" holds (ties to 023's SC-002 / the
  event-delete guardrail).
