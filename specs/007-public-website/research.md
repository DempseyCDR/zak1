# Phase 0 Research: Public Website (Browse)

Stack fixed by build 1 (TS/Next.js + Postgres). `/speckit-clarify` deferred online payments entirely
and settled a structured Venue entity (both in spec.md `## Clarifications`). The decisions below
record the resulting browse-only design.

## Decision 1 — Payments (US2) are out of scope; browse-only this phase

- **Decision**: Build only the public browse site (US1). No purchase flow, no PayPal, no Online Order
  entity, no online-fee logic — FR-004–008/011, SC-002/003/004 are deferred (clarify).
- **Rationale**: User chose to defer payments; it's "build 1" with no auth, and a live payment system
  (webhooks, reconciliation) is a large, separately-scoped effort. Online advance tickets also depend
  on the deferred group-ticket work (BACKLOG B1).
- **Alternatives considered**: Sandbox PayPal now / full live integration — both rejected by the user
  in favor of full deferral.

## Decision 2 — Venue as a structured entity referenced by a nullable `events.venue_id`

- **Decision**: New `venues` table (id, name, address, lat/lng nullable, timestamps). Add nullable
  `events.venue_id` FK → venues. An event may have no venue (listed without a map).
- **Rationale**: FR-002 needs a reusable source for the venue label and the map; a structured entity
  (vs. free text on the event) avoids re-typing an address per event and matches how BACKLOG B12
  framed it ("add venue... with maps in 007"). Nullable keeps it optional so existing events aren't
  forced to have a venue.
- **Alternatives considered**: Free-text venue on the event (rejected — no reuse, messy map lookups);
  defer venue entirely (rejected by the user).

## Decision 3 — Public read model composes existing data into public-safe views

- **Decision**: A new `domain/public/` module exposes `getPublicSchedule(db)` (upcoming events with
  date, activity = series name, venue label) and `getPublicEventDetail(db, eventId)` (the event +
  venue + map URL + public performer/band display). It returns **explicit public-safe view types**,
  never raw rows — no pay amounts, contacts, attendance, or money ever appear.
- **Rationale**: The public surface must be tightly scoped; building dedicated view projections (not
  passing through DB rows) is the safe, testable way to guarantee only public data is exposed
  (Constitution: Type Safety + the spec's public-safety constraint).
- **Alternatives considered**: Reusing admin read models directly on public pages (rejected — they
  carry money/contact fields that must never reach the public).

## Decision 4 — Per-performer public display reuses `PERFORMER_RULES.publicDisplay`; extends 008's model

- **Decision**: `performerDisplay.ts` maps an event's bookings to public performer entries using
  feature 003's existing `PERFORMER_RULES[type].publicDisplay` (`full_bio` → name + bio + photo;
  `open_band_label` → "Open Band", no name; `hidden` → omitted entirely, e.g. Sound Tech; `name_note`
  → name + short note, e.g. Instructor), pulling performer `bio`/`photoUrl` from feature 003. Band
  blocks come from feature 008's `groupEventBookingsForDisplay`; the individual (non-band) bookings it
  returns as `adHoc` are what this mapper transforms.
- **Rationale**: The display rules are already encoded in `PERFORMER_RULES.publicDisplay` — reuse, not
  re-derive (FR-003/SC-005). Feature 008's read model handles band grouping but returns raw
  `BookingView` (name only, no bio/photo, no display-rule filtering), so 007 layers the per-performer
  presentation on top rather than duplicating grouping.
- **Consequence**: `hidden`-rule bookings (Sound Tech) are dropped before reaching any public output;
  a `hidden` performer must never appear even in metadata.
- **Alternatives considered**: Re-implementing display rules in 007 (rejected — drift risk); extending
  008's model to carry public presentation (rejected — keeps 008 focused on grouping; presentation is
  007's concern).

## Decision 5 — Map is a pure URL builder, no maps SDK or external call in tests

- **Decision**: `venueMapUrl(venue)` builds a map URL from the venue's coordinates (preferred) or
  address. If a static-maps API key is configured (env), it returns a static-map image URL rendered as
  an `<img>`; otherwise it falls back to a plain maps link (`<a>` to a maps search for the address).
  The builder is a pure function (unit-tested); no external HTTP call happens server-side or in tests.
- **Rationale**: FR-009 describes behavior ("a location map is shown"), not a vendor. A pure URL
  builder is testable, needs no key to develop against, and degrades gracefully (link if no key) —
  honoring the spec's "configurable, not vendor-locked" assumption and the constitution's real-infra
  test rule (nothing to mock).
- **Alternatives considered**: A maps SDK / server-side geocoding (rejected — external dependency,
  key required, harder to test, over-scoped for browse).

## Decision 6 — Public pages are React Server Components calling the read model directly

- **Decision**: The `(public)/whats-on` pages are RSCs that call `getPublicSchedule` /
  `getPublicEventDetail` server-side; there is **no public JSON API**. Paths live under `/whats-on`
  (and `/whats-on/[eventId]`) to avoid colliding with the admin's existing `/events`.
- **Rationale**: Server-only rendering keeps the public surface minimal and guarantees non-public
  fields can't leak into a client bundle; the tested unit is the read model, so skipping an API layer
  loses no coverage. Distinct paths avoid the `(admin)/events` route collision (route groups don't add
  a path segment).
- **Alternatives considered**: Public JSON API + client fetch (rejected — extra surface to secure and
  test for no benefit on a read-only browse site).

## Decision 7 — Venue management is admin-only; assigning a venue adds the first event PATCH

- **Decision**: Admins create/list/edit venues (`/venues` page + `/api/venues*`) and assign a venue to
  an event via a new `PATCH /api/events/[id]` accepting `{ venueId }`. No public write surface.
- **Rationale**: Venues must exist for the public map; management belongs with the other admin config.
  Events had no PATCH endpoint; a minimal one scoped to `venueId` is the least-invasive way to attach
  a venue.
- **Alternatives considered**: Setting venue at event creation only (rejected — existing events need
  venues assigned too).

**Output**: research complete; no NEEDS CLARIFICATION remain. Ready for data-model and contracts.
