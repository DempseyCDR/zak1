# Contract: Booking Modal (US2 + US3)

The modal is a client surface over the **existing** booking API. `booking.write` gates writes (Booker /
Super-user, per series); a viewer without it gets the read-only shell.

---

## Existing API reused (no new endpoints)

- `GET /api/events/:id/bookings` — the event's bookings (feature 018).
- `POST /api/events/:id/bookings` — create a booking (`performerId`, `performerType`, `pay?`). Pay defaults
  to the **rate** parameter for the role/series on the event date when omitted (feature 018/009).
- `PATCH /api/bookings/:id` — edit **pay, notes (`note`), status, substitute (`performerId`)** in one call.
  - **Status** validated by `isAllowedBookingTransition` — now including `tentative` (see below).
  - **Substitute** (changing `performerId`) re-points → resets to `proposed`, clears `check_number`
    (unchanged, feature 018).
- `DELETE /api/bookings/:id` — remove a booking.

## Tentative transition (US3, FR-014)

`bookingStatus.ts` `ALLOWED` map gains `tentative`:

```text
requested → tentative | confirmed | declined
tentative → confirmed | declined
```

`requested → confirmed` remains (skippable). Any other move (e.g. `proposed → tentative`,
`confirmed → tentative`) is refused with the existing invalid-transition error. **Tentative is internal** —
the public confirmed-only filter excludes it automatically (no change).

---

## Modal behavior (presentation contract)

| Shell | When | Buttons |
|---|---|---|
| **create** | click an empty role slot | Save, Cancel — role pre-filled from the slot |
| **edit** | click a filled booking | Save, Cancel |
| **read-only** | viewer lacks `booking.write` | **Close only** |

- **Entry**: opening `/bookings` directly shows an **event selector** first; arriving from the report passes
  the event and skips it.
- **One Save** commits all edited fields (pay/notes/status/substitute) via a single PATCH; **Cancel**
  discards; **no save-on-close**.
- **Performer picker**: typeahead (see [performer-search.md](performer-search.md)); works regardless of band
  membership.
- **mailto**: shown only when the performer's contact has a usable email — the first **active** email whose
  `purposes` include, in order, `booking` → `personal` → `public_profile` (excluding `other`). Link is
  `mailto:<addr>?subject=Rochester Dance <friendly event date>`. No usable email → no link. The
  email-precedence pick is a pure function with a unit test.
