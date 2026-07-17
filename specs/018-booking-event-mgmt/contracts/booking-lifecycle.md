# Contract: Booking status lifecycle (B23)

Extends the existing booking write path. Auth: `booking.write` (scoped to the event's series), unchanged.

## `POST /api/events/[id]/bookings` — create (extended)

Response now includes `status`, defaulting to **`proposed`**. No request change. Bookings created by
booking a band as a unit (`bookBand`) also default to `proposed`.

## `PATCH /api/bookings/[id]` — status + re-point (extended `bookingPatchSchema`)

```jsonc
{
  "status": "requested",     // NEW: proposed → requested → confirmed; any non-terminal → declined; declined → proposed
  "performerId": "<uuid>",   // NEW: re-point the slot to another performer → status forced to "proposed"
  "pay": 150,                // existing
  "isDonated": false,        // existing
  "note": "Katy said no"     // existing — holds decline context
}
```

### Behaviour

- **Transition validation** (in-service): forward-only `proposed → requested → confirmed`; a skip (e.g.
  `proposed → confirmed`) is rejected (422). Any of proposed/requested/confirmed `→ declined` is allowed;
  `declined → proposed` revives.
- **Re-point**: supplying a new `performerId` changes the performer on the **same booking row**, resets
  `status` to `proposed`, and **clears `check_number` + resets `requiresCheck`/pay override** — a stale check
  number must never carry from the previous performer to the new one. Structured decline history is not kept
  — only `note` preserves it (accepted).
- Scope enforced by `assertBookingScope` (unchanged); audited via `booking.updated`.

## Response

`200` with the booking row including `status`. Backward-compatible (new field additive).
