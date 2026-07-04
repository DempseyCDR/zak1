# Quickstart & Validation: Public Website (Browse)

End-to-end validation guide. Implementation details live in `tasks.md`. Builds on features 002
(events/series), 003 (performer public-display rules + bio/photo), and 008 (band grouping). Online
sales are out of scope (deferred).

## Prerequisites

- Features 001–008 applied; Postgres running
- `pnpm install`; `.env` with `DATABASE_URL` / `TEST_DATABASE_URL` (optional: a static-maps API key
  env var — without it, the map renders as a maps link)

## Setup

```bash
pnpm db:migrate     # applies 0014_venues.sql (venues + events.venue_id)
pnpm db:seed        # optional; seeds a sample venue and assigns it to the sample event
```

## Run

```bash
pnpm dev
# /whats-on                 — public schedule: upcoming dances (date, activity, venue)
# /whats-on/<eventId>       — public event detail: venue + map + public performers/bands
# /venues                   — admin: create venues, assign a venue to an event
```

## Validation scenarios

Map to acceptance scenarios in [spec.md](spec.md); contracts in [contracts/api.md](contracts/api.md).

1. **Public schedule lists upcoming dances** (US1): `getPublicSchedule` returns upcoming events with
   date, activity (series name), and venue name; past events are excluded (FR-001).
2. **Venue + map on event detail** (US1): create a venue, assign it to an event; `getPublicEventDetail`
   returns the venue with a non-null `mapUrl`; an event with no venue returns `venue: null` and no map
   (FR-002/FR-009).
3. **Map URL builder** (unit): `venueMapUrl` produces a static-image URL when a key is configured and a
   maps link otherwise; prefers coordinates over address when present (FR-009).
4. **Per-performer public display rules** (US1, FR-003/SC-005): on an event with one of each type,
   `getPublicEventDetail` shows Caller/Lead Musician/Musician with name+bio+photo, "Open Band" for an
   open-band musician (no name), Instructor with name+note, and **no Sound Tech at all** (hidden).
5. **Band block display** (US1, FR-003; 008 integration): book a band as a unit onto an event, plus one
   ad-hoc musician; `getPublicEventDetail` returns one band block (band name/bio/photo) and the ad-hoc
   musician individually.
6. **Public-safety** (constraint): confirm neither public view exposes pay amounts, contact info, or
   attendance — the view types carry only public fields (SC-005 spirit; guards against leakage).
7. **Free events listed without a purchase flow** (FR-010): all public events are display-only; there
   is no purchase UI anywhere on the public site (payments deferred).
8. **Venue admin** (FR-002 support): `POST /api/venues`, `PATCH /api/events/:id { venueId }`; assigning
   an unknown venue → 404 `VENUE_NOT_FOUND`.

## Test commands

```bash
pnpm test:unit          # venueMapUrl builder (pure)
pnpm test:integration   # public schedule/detail read model, performer display rules, venue CRUD + assignment — real Postgres
pnpm typecheck && pnpm lint
```

Expected: all green; Sound Tech never appears publicly; band-linked bookings collapse into band blocks;
no money/contact/attendance in any public view; events without a venue list without a map.
