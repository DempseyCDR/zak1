# Contract: `POST /api/events/[id]/settlement-performer` — add a last-minute performer (new)

FR-011. Lets the FS add a performer who wasn't booked so they can be paid, without holding `booking.write`.

## Auth

- **Requires `performer_payment.write`** (FS/Treasurer), **scoped** — the server asserts the actor's payment
  scope for the **event**. NOT `booking.write`.

## Request

- Path: `id` = event id.
- Body: `{ performerId: uuid, performerType: <performer_type enum> }`.

## Behavior

- Creates a `bookings` row for `performerId` on the event, reusing `createBooking`'s derivation of
  `pay_cents` (from the rate parameter / rule) and `requires_check`.
- **Dedupe**: if that performer already has a booking on the event, returns the **existing** booking (no
  duplicate row).
- Emits audit `booking.settlement_added` (or reuses `booking.created`) with the booking + event id.

## Response

- `201` with the created (or existing) booking view; the payments page renders it as a new per-performer row.
- `403` if the actor lacks payment scope for the event.

## Follow-on

The performer's check is then recorded via the normal per-row path (`POST /api/performer-payments`) — see
[payments-page-rows.md](payments-page-rows.md). This endpoint only creates the booking.
