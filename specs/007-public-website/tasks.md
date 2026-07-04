# Tasks: Public Website (Browse)

**Feature**: `007-public-website` | **Plan**: [plan.md](plan.md) | **Spec**: [spec.md](spec.md)

**Stack**: TypeScript / Next.js (App Router, React Server Components) + PostgreSQL 16, Drizzle, Zod,
pino, Vitest. Builds on feature 002 (`events`/`series`/`listEvents`), feature 003
(`PERFORMER_RULES.publicDisplay`, performer bio/photo), feature 008 (`groupEventBookingsForDisplay`).
No new runtime dependency (the map is a URL builder, not an SDK).

**Scope**: Browse-only. Online sales (US2 / PayPal) are **deferred** — no purchase flow is built. The
only user story implemented is US1.

**Test-First is NON-NEGOTIABLE** (constitution Principle I): the public read model, performer-display
mapping, and venue CRUD/assignment are integration-tested against real `zak1_test` (no DB mocking);
the `venueMapUrl` builder is a pure unit test. Public RSC pages are thin renderers over the tested
read model (UI not auto-tested, accepted project-wide).

**Critical correctness surface**: the public read model must expose only public-safe fields (no pay,
contacts, attendance) and Sound Tech (`hidden`) must never appear.

**Conventions**: `[P]` = parallelizable (different files, no incomplete deps). Story label `[US1]`.
Paths repo-relative.

---

## Phase 1: Setup

- [X] T001 [P] Zod schemas in `src/server/validation/venues.ts`: `venueCreateSchema` (name, address
  required; latitude/longitude optional numbers), `venuePatchSchema` (all optional), `assignVenueSchema`
  (`venueId: uuid nullable`)

---

## Phase 2: Foundational (blocking prerequisites)

- [X] T002 Author migration `0014_venues.sql` in `src/server/db/migrations/`: `venues` (id, name NOT
  NULL, address NOT NULL, latitude double precision NULL, longitude double precision NULL, created_at,
  updated_at); `ALTER TABLE events ADD COLUMN venue_id uuid REFERENCES venues(id) ON DELETE SET NULL`
- [X] T003 [P] Drizzle schema `src/server/db/schema/venues.ts` (`venues` table + `VenueRow` type); add
  `venueId` column to `events` in `src/server/db/schema/events.ts`; export venues from
  `src/server/db/schema/index.ts`
- [X] T004 [P] Add `VENUE_NOT_FOUND` (404) to the `ApiErrorCode` union + `errors` object in
  `src/server/lib/apiError.ts`; add `venue.created`, `venue.updated` to the `AuditEvent` kind union in
  `src/server/lib/audit.ts`
- [X] T005 Apply migration `0014` to the dev DB; extend `resetDb` in
  `tests/integration/helpers/db.ts` to TRUNCATE `venues` (events already listed)

**Checkpoint**: venue schema, error/audit codes in place. US1 builds on this.

---

## Phase 3: User Story 1 — Browse dances and performers publicly (Priority: P1) 🎯 MVP

**Goal**: A public site lists upcoming dances (date, activity, venue), shows a venue map, and displays
public performers/bands per the display rules (Sound Tech hidden, "Open Band" for unpaid, full bio for
Caller/Lead Musician/Musician, name+note for Instructor, Band blocks for band-booked musicians) — with
no money/contact/attendance ever exposed.

**Independent test**: Seed events with a venue and a mix of performer types + a booked band; the public
read model returns the schedule and event detail with correct display rules and no non-public data.

### Tests first (MUST fail before implementation)

- [X] T006 [P] [US1] Unit test: `venueMapUrl` returns a static-image URL when a maps key env var is set
  and a plain maps link otherwise, preferring coordinates over address when present, in
  `tests/unit/venueMap.test.ts` (FR-009)
- [X] T007 [P] [US1] Integration test: venue CRUD via `POST/GET/PATCH /api/venues` (+ `/api/venues/:id`)
  and `PATCH /api/events/:id { venueId }` assigns a venue; assigning an unknown venue → 404
  `VENUE_NOT_FOUND`, in `tests/integration/venues.test.ts` (FR-002 support)
- [X] T008 [P] [US1] Integration test: `getPublicSchedule` returns upcoming events (on/after the
  cutoff, ascending) with date, activity (series name), and venue name (null when unassigned); past
  events excluded; **a free event (`chargesAdmission = false`) still appears in the schedule** (FR-010
  — no purchase flow exists, so free events list like any other). To keep the test deterministic, the
  schedule cutoff MUST be a parameter the test passes a fixed reference date to (mirroring feature
  002's `listEvents(from)`), not the wall clock, in `tests/integration/publicSchedule.test.ts`
  (FR-001/FR-010)
- [X] T009 [P] [US1] Integration test: `getPublicEventDetail` applies the public-display rules — a
  Caller/Lead Musician/Musician shows name+bio+photo, an open-band musician shows "Open Band" (no
  name), an Instructor shows name+note, and a **Sound Tech is absent entirely**; a booked band renders
  as one band block while an ad-hoc musician on the same event renders individually; assert no
  pay/contact/attendance fields appear anywhere in the returned view, in
  `tests/integration/publicEventDetail.test.ts` (FR-002/FR-003/SC-005 + public-safety)

### Implementation

- [X] T010 [P] [US1] `venueMap.ts` in `src/server/domain/public/`: pure `venueMapUrl(venue)` — static
  image URL when a maps key env var is configured, else a maps link; prefer coords over address
- [X] T011 [US1] `venueService.ts` in `src/server/domain/venues/`: `createVenue`, `listVenues`,
  `getVenue`, `patchVenue` (with `venue.created`/`venue.updated` audits), `assignVenueToEvent(db,
  eventId, venueId)` (404s on unknown event/venue)
- [X] T012 [US1] `performerDisplay.ts` in `src/server/domain/public/`: map an event's non-band bookings
  to public performer entries via `PERFORMER_RULES[type].publicDisplay` (`full_bio` → name+bio+photo
  from `performers`; `open_band_label` → `{kind:"open_band"}`; `hidden` → dropped; `name_note` →
  name+note); band blocks come from feature 008's `groupEventBookingsForDisplay`
- [X] T013 [US1] `publicSchedule.ts` in `src/server/domain/public/`: `getPublicSchedule(db, from?)`
  (the `from` cutoff defaults to today but is an injectable parameter for deterministic tests, mirroring
  feature 002's `listEvents(from)`; returns events on/after `from`, ascending — including free
  `chargesAdmission = false` events, FR-010) and `getPublicEventDetail(db, eventId)`; both return
  explicit public-safe view types, composing `performerDisplay` + band grouping + `venueMapUrl` +
  series activity + venue
- [X] T014 [US1] Route handlers `GET/POST /api/venues` in `src/app/api/venues/route.ts` and
  `GET/PATCH /api/venues/[id]` in `src/app/api/venues/[id]/route.ts`
- [X] T015 [US1] Route handler `PATCH /api/events/[id]` (accept `{ venueId }`, call
  `assignVenueToEvent`) in `src/app/api/events/[id]/route.ts` (new file — events had no PATCH)
- [X] T016 [US1] Public route group: `src/app/(public)/layout.tsx` (public shell) + `whats-on/page.tsx`
  (schedule RSC calling `getPublicSchedule`) + `whats-on/[eventId]/page.tsx` (event detail RSC calling
  `getPublicEventDetail`, rendering venue+map+performers/bands)
- [X] T017 [US1] Admin `src/app/(admin)/venues/page.tsx`: create/list venues + assign a venue to an
  event (event picker → `PATCH /api/events/:id`)

**Checkpoint**: US1 independently testable — the public browse site renders the schedule, venue maps,
and public performer/band display; nothing non-public leaks.

---

## Phase 4: Polish & Cross-Cutting

- [X] T018 [P] Update the dev route index `src/app/dev/routes/page.tsx` with the new routes (UI
  `/whats-on`, `/whats-on/[eventId]`, `/venues`; API `/api/venues`, `/api/venues/[id]`, `PATCH
  /api/events/[id]`) per the temporary convention (CLAUDE.md)
- [X] T019 [P] Seed a sample venue and assign it to the sample event in `src/server/db/seed.ts` (add
  `venues` to its TRUNCATE list)
- [X] T020 [P] Verify all [quickstart.md](quickstart.md) scenarios end-to-end, including the public
  pages in the browser (schedule, event detail with map + performer/band display)
- [X] T021 [P] Constitution compliance pass: strict types, no undocumented `any`/`as`, `withLogging` on
  the new admin routes, real-Postgres integration tests throughout; **re-verify the public read model
  exposes no pay/contact/attendance fields and never emits a Sound Tech**

---

## Dependencies & Execution Order

- **Setup (T001)** → **Foundational (T002–T005)** → US1.
- Within Foundational: T002 (migration) → T003 (schema); T004 independent; T005 depends on T002.
- Within US1: tests first (T006–T009, must fail) → implementation. `venueMapUrl` (T010) has no deps
  beyond Setup. `venueService` (T011) depends on the schema (T003). `performerDisplay` (T012) depends
  on feature 008's grouping (already shipped) + the schema. `publicSchedule` (T013) depends on T010 +
  T012. Routes (T014/T015) depend on T011. Public pages (T016) depend on T013. Admin page (T017)
  depends on T014/T015.
- Polish after US1.

## Parallel Opportunities

- Foundational: T003 and T004 are different files, parallel after T002.
- US1 tests T006–T009 are independent files, writable in parallel before implementation.
- US1 impl: T010 (`venueMap`), T011 (`venueService`), and T012 (`performerDisplay`) touch different
  files and can proceed in parallel once Foundational lands; T013 joins T010+T012; routes/pages follow.

## Implementation Strategy

1. **This whole feature is the MVP** — a single P1 story (browse). Foundational + US1 delivers it.
2. The correctness focus is the public read model: display-rule mapping (Sound Tech hidden) and the
   public-safe projection (no money/contacts/attendance).
3. Polish: dev-route index, seed venue, browser verification, constitution/public-safety pass.

## Format validation

All tasks use `- [ ] T### [P?] [US1?] description + file path`. Setup/Foundational/Polish carry no
story label; the single user-story phase carries `[US1]`. 21 tasks total.
