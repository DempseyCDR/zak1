# Contract: `POST /api/bookings/[id]/donate` — donate a fee at settlement (new)

FR-007 / FR-008. A narrow settlement action letting the FS flip a booking to **donated** without holding
`booking.write`.

## Auth

- **Requires `performer_payment.write`** (the FS/Treasurer capability), **scoped** — the server asserts the
  actor's payment scope for the booking's **event** (same assertion used by `createPerformerPayment`). NOT
  `booking.write`.

## Request

- Path: `id` = booking id. Body: none (or `{}`).

## Behavior

- Sets the booking `is_donated = true`, `pay_cents = 0`, `requires_check = false` (direct `bookings` update;
  status unchanged; no band-lead cascade).
- **Refuses** (validation error, no mutation) when the booking:
  - has a **live (non-voided) payment line** → message directs the FS to void the check first;
  - is **already donated** (idempotent no-op or explicit "already donated").
- Emits audit `booking.donated` with the booking + event id.

## Response

- `200` with the updated booking view (donated, `requires_check = false`).
- `403` if the actor lacks payment scope for the event.
- `409`/validation error if a guard fails (live payment / already donated).

## Reconciliation effect

Expected for the event drops by the former `pay_cents`; the row renders as **free** and leaves the
outstanding gap (SC-003). No change to `reconcilePayments` itself.
