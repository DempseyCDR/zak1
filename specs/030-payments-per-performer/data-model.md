# Data Model: Payments page per-performer workflow (P5-R3)

**No persistent data-model change.** No table, column, index, or migration is added. All entities and fields
below already exist; this feature reads them a new way and adds two narrow write paths over them.

## Reused entities (unchanged)

- **Booking** (`bookings`): `id`, `event_id`, `performer_id`, `performer_type`, `pay_cents`, `is_donated`,
  `requires_check`, `status`, `note`. The payments page reads `performer_type` (role), `pay_cents` (booked
  amount), `requires_check` (payable vs. free), and `is_donated` (free reason) per row via
  `getBookingsForEvent`.
- **Performer payment** (`performer_payments`): `id`, `event_id`, `payee_performer_id`, `amount_cents`,
  `check_number` (nullable), `override_reason` (the note — used for the FR-014 check-less comment),
  `voided_at`, `void_reason`, `replaces_payment_id`.
- **Payment line** (`payment_bookings`): `payment_id`, `booking_id`, `amount_cents` (per-line applied amount).
- **Event**: selected via the shared 028 selector (in-page state).

## The "per-performer row" (a derived view, not stored)

Each row on the page is a join of **one booking** with its live-payment state. Two inputs drive it: this
event's `payments` (checks **recorded at this event**, from `listPerformerPayments`) and **`settledByBooking`**
— a `booking id → live settled cents` map that is **cross-event aware** (a check recorded at *another* event
still counts against the booking it settles; sourced from `settledCentsByBookingForEvent`, added to the
payments response). Four states (FR-016):

- `requires_check = false` → **free** row (donated / instructor / `$0`): no check field; excluded from
  payments due and the outstanding gap. (Open-band musicians are comped attendees, not bookings — not rows.)
- `requires_check = true`, a live payment line in **this event's** payments → **paid (here)** — editable
  inline (FR-010).
- `requires_check = true`, `settledByBooking[id] > 0` but **no** local payment line → **settled elsewhere**
  (a cross-event check): render as paid/settled, **no** new-check row and **no** inline edit here — the check
  is edited where it was recorded.
- `requires_check = true`, `settledByBooking[id] = 0` → **payable, outstanding**.

## State transition (the only mutation of existing data this feature introduces)

**Booking: payable → donated (donate-at-settlement, FR-007)** — via `donateBookingAtSettlement`:

```text
{ is_donated: false, pay_cents: N>0, requires_check: true }
      │  FS enters 0 + no check number on the row, confirms (payment_payment.write, scoped)
      ▼
{ is_donated: true,  pay_cents: 0,   requires_check: false }
```

- Guard: refused if the booking has a **live payment** (void first) or is **already donated**.
- Direct `bookings` update (not `patchBooking`) → no band-lead status cascade (mirrors 024 H1); status
  unchanged (the appearance stands).
- Effect on reconciliation: expected drops by the former `pay_cents` (SC-003); the row becomes free.

**Add-settlement-performer (FR-011)** — via `addSettlementPerformer`: inserts a new `bookings` row for a
performer on the event (reusing `createBooking`'s derivation of `pay_cents`/`requires_check`), or returns the
existing booking if the performer is already booked (no duplicate). No change to existing rows.

## Validation rules (new, at the two route boundaries)

- **Donate**: `bookingId` is a path param; body empty or `{}`. Server asserts payment scope for the booking's
  event and the live-payment / already-donated guards.
- **Add-settlement-performer**: `{ performerId: uuid, performerType: <enum> }`; server asserts payment scope
  for the event and dedupes on `(event_id, performer_id)`.
- **Per-row payment** (reused `createPerformerPayment`): a single line `[{ bookingId, amount }]`, `payee =
  the row's performer`, `checkNumber` optional; a positive `amount` with no `checkNumber` requires the
  client-supplied confirmation comment stored as `override_reason` (FR-014).

No entity relationships change; no lifecycle beyond the single donate transition above.
