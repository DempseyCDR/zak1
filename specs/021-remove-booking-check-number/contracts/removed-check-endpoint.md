# Contract changes: Remove `bookings.check_number`

This feature **removes** interface surface; it adds none.

## Removed — `PATCH /api/bookings/[id]/check`

The endpoint that recorded a check number against a booking is **deleted**, along with its request schema
`checkNumberPatchSchema` (`{ checkNumber: string|null }`).

- **Callers**: only the door/gate page. Its call and the check-number input are removed with it.
- **Replacement**: recording a check moves to `performer_payments` in the separate FS-payments feature (Area
  B). Not provided by this feature (pre-rollout; temporary gap accepted).
- **Route inventory**: regenerates automatically (`routeInventory.ts`); `auth.routeInventory.test.ts`
  re-derives — no manual edit.

## Changed — Booking payloads no longer carry a check number

Any response that serialized a `bookings` row (e.g. bookings-for-event, the booking modal's data) **no longer
includes `checkNumber`**. Consumers that displayed it must source a check number from the payment record
instead, or drop it. Public/confirmed-only payloads never exposed it and are unchanged.

## Unchanged

- **Treasurer report** — already reads `performer_payments.check_number`; identical output before/after.
- **`GET /api/events/[id]/attendance`**, gate money entry, and all non-check booking fields
  (incl. `requires_check`) — unchanged.

## Behavioral contract — event deletion

`DELETE` of an event with a recorded performer-payment check is still refused. The blocking condition now
derives from `performer_payments` (existing Blocker 3); the surfaced reason is "a recorded performer payment"
rather than "a paid booking (check number)". Protection is preserved (FR-002).
