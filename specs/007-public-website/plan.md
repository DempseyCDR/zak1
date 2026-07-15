# Implementation Plan: Public Website (Browse)

**Branch**: `007-public-website` | **Date**: 2026-07-03 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/007-public-website/spec.md`

## Summary

The public-facing browse site that replaces the legacy WordPress site: a schedule of upcoming dances
(date, activity, venue), a venue location map, and public performer display — including feature 008's
Band blocks. Online sales (US2 / PayPal) are **deferred** (2026-07-03 clarification), so this feature
is read-only public content with no purchase flow. It introduces one new entity (**Venue**, resolving
BACKLOG B12's venue attribute) referenced by a nullable `events.venue_id`, and a public read model
that composes existing data (events, series, feature 003's `PERFORMER_RULES` public-display rules,
feature 008's band grouping) into public-safe projections — exposing only what's meant to be public
(no pay amounts, contacts, or attendance).

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js LTS (24.x), strict mode (existing project)

**Primary Dependencies**: Next.js (App Router, React Server Components for the public pages), Drizzle
ORM, Zod, pino. Reuses feature 002 (`events`, `series`, `listEvents`), feature 003
(`PERFORMER_RULES.publicDisplay`, performer bio/photo), and feature 008
(`groupEventBookingsForDisplay`). No new runtime dependency; the map is a URL builder, not an SDK.

**Storage**: PostgreSQL 16. New: `venues` (id, name, address, lat/lng nullable, timestamps); add a
nullable `venue_id` FK to `events`. No other schema changes.

**Testing**: Vitest. The public read model (schedule + event detail with performer/band public-display
rules) and venue CRUD / event-venue assignment are integration-tested against real `zak1_test`. The
map-URL builder is a pure unit test. Public pages themselves are React Server Components and are **not**
auto-tested (project-wide accepted pattern, N2) — their logic lives in the tested read model.

**Target Platform**: Linux server (Node). Adds a public route group `(public)` served by the same
Next.js app alongside `(admin)` and `(door)`, plus a small admin venue-management page.

**Performance Goals**: None specified; single-club scale — not a design constraint.

**Constraints**:

- **Public safety**: public endpoints/read model MUST expose only public-safe fields — event
  date/activity/venue and performer *public* display per `PERFORMER_RULES.publicDisplay` (Sound Tech
  hidden, "Open Band" for unpaid, full bio+photo for Caller/Lead Musician/Musician, name+note for
  Instructor). Never pay amounts, contacts, attendance, or money.
- **No route collisions**: admin already owns `/events`; public pages live under distinct paths
  (`/whats-on`, `/whats-on/[eventId]`).
- Band-linked bookings render as one Band block (feature 008); non-band bookings render per the
  per-performer rules (FR-003).

**Scale/Scope**: Single tenant; browse-only; no auth (public read); payments out of scope this phase.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Test-First (NON-NEGOTIABLE)**: PASS — the public read model (the real logic: venue join,
  per-performer public-display mapping, band grouping composition) and venue CRUD are integration-
  tested against real Postgres first; the map-URL builder is unit-tested. Public RSC pages are thin
  renderers over the tested read model (UI not auto-tested, accepted project-wide).
- **II. Simplicity / YAGNI**: PASS — reuses `PERFORMER_RULES.publicDisplay` and feature 008's band
  grouping rather than re-deriving display rules; the map is a pure URL builder (no maps SDK, no
  external call in tests); Venue is one small table; payments are deferred so none of that machinery
  is built.
- **III. Type Safety**: PASS — strict TS; Zod at the venue admin boundary; public read model returns
  explicit public-safe view types (not raw rows); no undocumented `any`/`as`.
- **IV. Observability**: PASS — `withLogging` on the new admin venue/event-venue routes; public pages
  are read-only server renders. No new audit events needed (no writes on the public surface).

**Initial gate: PASS. No violations — Complexity Tracking left empty.**

## Project Structure

### Documentation (this feature)

```text
specs/007-public-website/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
└── tasks.md   # /speckit-tasks (not created here)
```

### Source Code (repository root) — additions to the existing project

```text
src/
├── app/
│   ├── (public)/                          # public route group (shared minimal public layout)
│   │   ├── layout.tsx                     # public shell
│   │   ├── whats-on/page.tsx              # schedule: upcoming dances (date, activity, venue)
│   │   └── whats-on/[eventId]/page.tsx    # event detail: venue + map + public performers/bands
│   ├── (admin)/venues/page.tsx            # admin: create/list venues, assign a venue to an event
│   └── api/
│       ├── venues/route.ts                # GET list + POST create (admin)
│       ├── venues/[id]/route.ts           # GET/PATCH (admin)
│       └── events/[id]/route.ts           # PATCH { venueId } — assign a venue to an event (new)
├── server/
│   ├── db/
│   │   ├── schema/venues.ts               # NEW — venues table; + events.venue_id column
│   │   └── migrations/0014_venues.sql     # NEW — venues + events.venue_id
│   ├── domain/
│   │   ├── public/
│   │   │   ├── publicSchedule.ts          # getPublicSchedule(db), getPublicEventDetail(db, id) — public-safe views
│   │   │   ├── performerDisplay.ts        # map bookings → public performer entries via PERFORMER_RULES.publicDisplay (+ bio/photo)
│   │   │   └── venueMap.ts                # venueMapUrl(venue) — pure URL builder (static image if key set, else maps link)
│   │   └── venues/venueService.ts         # create/list/get/patch venues; assignVenueToEvent
│   └── validation/venues.ts               # Zod: venueCreate/venuePatch, assignVenue
└── (reuses events/series from 002, PERFORMER_RULES + performer bio/photo from 003, band grouping from 008)
```

**Structure Decision**: Continue the single Next.js project; add a `(public)` route group so the
public site shares the app (and its DB access) with admin/door — which is exactly what lets it reuse
feature 008's read model. Public pages are **React Server Components that call the `domain/public`
read functions directly** (no public JSON API layer): the read model is the tested unit, and RSCs
keep the public surface small and server-only, so nothing non-public can leak to a client bundle. A
new `domain/public/` module owns the public-safe composition (schedule, per-performer display mapping,
band grouping, map URL); feature 008's `groupEventBookingsForDisplay` is reused for band blocks and
extended — inside `performerDisplay.ts` — with the per-performer public rules and bio/photo that FR-003
needs but 008's model doesn't carry. Venue management is a small admin page + service; assigning a
venue to an event adds the first `PATCH /api/events/[id]`.

## Complexity Tracking

> No constitution violations — section intentionally empty.
