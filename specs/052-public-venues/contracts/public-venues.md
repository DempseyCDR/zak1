# Contract: public venues & directions

The interfaces this feature exposes: the public `/directions` page, the gated venue on event pages, and the two
new admin fields. The public reads are server components (no new API); the admin uses the existing venue routes.

## Public directions page (`/directions`)

Rendered from `listPublicVenues`:

- Lists **every public venue with an address** — each showing the venue **name** (`<h2>`), the **address**, a
  **tappable map link**, and its **directions/transit/parking** note (omitted when empty).
- **Never** lists a non-public, address-less, or placeholder venue.
- One `<h1>`; mobile-first (~375px, no horizontal scroll); AA; reachable from the site nav (a "Directions"
  entry in `PUBLIC_NAV`).

## Event page venue block (gated)

`getPublicEventDetail`'s `venue` comes from `publicVenueView`:

- **Public venue** → name + address + map link + directions.
- **Non-public venue** → **name only** (address/map/directions are null and MUST NOT render).
- No venue → no venue block (unchanged).

`PublicVenue = { name; address: string | null; mapUrl: string | null; directions: string | null }` — the
nullable fields are the gate; renderers show each only when non-null.

## Admin (existing venues editor, `venue.write`)

- The venue editor gains an **is-public** toggle and a **directions** field; saved via the existing
  `PATCH /api/venues/[id]` (extended `venuePatchSchema`).
- The server **rejects** (422) marking a venue public without an address (FR-007). No new capability; venue
  edits already audit (`venue.updated`).

## Scope boundary

Two additive venue fields + the gating + the directions page + the admin fields only. **No** new mapping/
geocoding, **no** virtual/video venues (B45), **no** new capability, **no** change to venue use in bookings/
rent, **no** rewrite of the R5 event `VenueBlock` (a follow-up once R5 + R8 both land — R5 reserved the slot).
Migration is additive (`0035`).
