# Phase 1 Data Model: Public Website (Browse)

Storage: PostgreSQL 16. One new table (`venues`) + a nullable `events.venue_id`. Everything else the
public site shows is a computed, public-safe projection over existing data (events, series, bookings,
performers, bands). No online-sales entities (deferred).

## Entity: Venue

| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| name | text NOT NULL | e.g., "German House" |
| address | text NOT NULL | used for the map + public label |
| latitude | double precision NULL | optional; preferred for the map when present |
| longitude | double precision NULL | optional |
| created_at | timestamptz NOT NULL default now() | |
| updated_at | timestamptz NOT NULL default now() | |

- New entity; resolves the venue attribute deferred in BACKLOG B12.
- Managed by admins; not writable from the public surface.

## Extension to feature 002: `events.venue_id`

| Field | Type | Notes |
|---|---|---|
| venue_id | uuid FK→venues NULL, ON DELETE SET NULL | optional; an event without a venue is listed without a map |

- Nullable so existing events remain valid; SET NULL so deleting a venue doesn't delete events.

## Computed view: PublicScheduleItem (not persisted)

`getPublicSchedule(db)` → upcoming events (event_date ≥ today, ascending):

| Field | Source |
|---|---|
| eventId | `events.id` |
| date | `events.event_date` |
| activity | `series.name` (via `events.series_id`) |
| venueName | `venues.name` (or null if no venue) |

- Public-safe: no money, attendance, or contact fields.

## Computed view: PublicEventDetail (not persisted)

`getPublicEventDetail(db, eventId)` → one event's public page data:

| Field | Source |
|---|---|
| date, activity | as above |
| venue | `{ name, address, mapUrl }` from the venue (via `venueMapUrl`), or null |
| bandBlocks | feature 008 `groupEventBookingsForDisplay` → `{ name, bio, photoUrl }[]` (one per booked band) |
| performers | non-band bookings mapped by `PERFORMER_RULES.publicDisplay` (below) |

### Public performer mapping (`performerDisplay.ts`)

Each non-band booking on the event maps by its type's `PERFORMER_RULES[type].publicDisplay`:

| publicDisplay rule | Types | Public output |
|---|---|---|
| `full_bio` | caller, lead_musician, musician | `{ name, bio, photoUrl }` (performer's own bio/photo) |
| `open_band_label` | open_band_musician | `{ label: "Open Band" }` — no name |
| `hidden` | sound_tech | **omitted entirely** — never appears in any public output |
| `name_note` | instructor | `{ name, note }` |

- Band-linked bookings are excluded here (they render as band blocks via feature 008); only `adHoc`
  (null-band) bookings are mapped. A musician booked ad-hoc (not via a band) still shows individually
  with full bio.

## Derived helper: venueMapUrl(venue)

Pure function (unit-tested): coordinates → static/dynamic map URL when present, else an address-based
maps URL. Static-map image URL only when a maps API key is configured (env); otherwise a plain maps
link. No external call.

## Relationships

- Venue 1—N Event (via nullable `events.venue_id`)
- Public views read: Event → Series (activity), Event → Venue (map), Event → Bookings → Performers/
  Bands (public display). All read-only projections.

## Derived / non-persisted

- Both public views are computed per request from existing rows; nothing about the public site is
  persisted beyond the `venues` table + `events.venue_id`. No online-order/payment data (deferred).
