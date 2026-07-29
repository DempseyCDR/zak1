# Contract: booking operations (cascade, guard, substitute, band re-point)

No server-endpoint shape is removed; two thin routes are added and two existing operations gain a guard.

## Lead status cascade (no new endpoint)

On `PATCH /api/bookings/[id]` that **changes the status** of a booking which is a band **lead**
(`band_id != null` && `performer_type = 'lead_musician'`): sibling bookings (same event + band) at the lead's
**previous** status also move to the new status. Status only. A non-lead status change, or a re-point, does
**not** cascade. Response: the patched lead booking (unchanged shape); the cascade is a side effect. It fires
**only** on a direct `patchBooking` status change — the no-show declines set internally by `substitute` /
`repoint-band` (direct updates) do **not** cascade (so substituting a no-show lead leaves the band intact).

## Re-point / clear guard (existing endpoints)

- `PATCH /api/bookings/[id]` with a **new `performerId`** → **refused** (validation error) when the booking is
  settled by a live check; otherwise re-points (reset to `proposed`, standard rate) as today.
- `DELETE /api/bookings/[id]` → **refused** when the booking is settled by a live check; otherwise removes it.
- The refusal message names the cause ("settled by a live check — void it first, or substitute").

## Substitute — `POST /api/bookings/[id]/substitute { newPerformerId }` (new)

`booking.write`-scoped. Branches on the discriminator:

- **Unpaid** booking → re-points the slot to `newPerformerId` (fresh `proposed`, standard rate).
- **Paid** booking → sets the original to `declined` (a kept no-show) and creates a **new** booking for
  `newPerformerId` (same `performer_type`). Returns the resulting booking(s).

(The wrong check is voided + reissued to the substitute separately, on the gate, by the FS — feature 023.)

## Band re-point — `POST /api/events/[id]/repoint-band { fromBandId, toBandId }` (new)

`booking.write`-scoped. Removes the event's `fromBandId` bookings that are unpaid, keeps any paid ones as
`declined` (no-show), then books `toBandId`'s current roster fresh (`proposed`, standard rates, lead as
`lead_musician`) via the existing band-booking path. Non-band bookings on the event are untouched.

## Unchanged

- The 023 payment substrate, treasurer/organizer reports, and public/confirmed-only display are unaffected —
  this feature only reads 023's live-settlement for the discriminator.
