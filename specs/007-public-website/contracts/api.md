# API Contracts: Public Website (Browse)

Two surfaces: (1) **admin** JSON endpoints for venue management + venue assignment (Next.js route
handlers, uniform `{ error: { code, message } }`), and (2) the **public** pages, which are React
Server Components calling the `domain/public` read model directly — **no public JSON API** (research
Decision 6). The read model's shapes are documented here since they are the tested contract.

## Admin: venue management

### GET /api/venues

- 200 → `{ items: { id, name, address }[] }`.

### POST /api/venues

Body: `{ name: string, address: string, latitude?: number, longitude?: number }`

- 201 → the created `Venue`. Writes a `venue.created` audit event.
- 422 `VALIDATION_ERROR`.

### GET /api/venues/:id

- 200 → the `Venue`. 404 `VENUE_NOT_FOUND`.

### PATCH /api/venues/:id

Body (all optional): `{ name?, address?, latitude?, longitude? }`

- 200 → the updated `Venue`. 404 `VENUE_NOT_FOUND`. Writes a `venue.updated` audit event.

## Admin: assign a venue to an event

### PATCH /api/events/:id

Body: `{ venueId: string | null }` (new endpoint — events had no PATCH before)

- 200 → the updated event. 404 `EVENT_NOT_FOUND` / `VENUE_NOT_FOUND` (if a non-null venueId is unknown).

## Public read model (server-only; consumed by RSC pages, not exposed as JSON)

### getPublicSchedule(db) → PublicScheduleItem[]

Upcoming events (date ≥ today, ascending): `{ eventId, date, activity, venueName | null }`.
Public-safe — no money/attendance/contacts.

### getPublicEventDetail(db, eventId) → PublicEventDetail | null

`{ date, activity, venue: { name, address, mapUrl } | null, bandBlocks: {name,bio,photoUrl}[],
performers: PublicPerformer[] }`. `null` if the event doesn't exist.

`PublicPerformer` is one of: `{ kind: "full_bio", name, bio, photoUrl }` |
`{ kind: "open_band" }` | `{ kind: "name_note", name, note }`. Sound Tech (`hidden`) bookings are
omitted entirely.

## Enums / error codes

- New error code: `VENUE_NOT_FOUND` (404). Reuses existing `EVENT_NOT_FOUND`, `VALIDATION_ERROR`.
- New audit kinds: `venue.created`, `venue.updated` (no audit on the read-only public surface).

## Notes

- The public pages (`/whats-on`, `/whats-on/[eventId]`) render the read model server-side; they take
  no user input and expose no write path.
- Online purchase endpoints (tickets/memberships) are **not** part of this feature (deferred with US2).
