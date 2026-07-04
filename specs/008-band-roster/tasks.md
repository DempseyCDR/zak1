# Tasks: Reusable Band Roster

**Feature**: `008-band-roster` | **Plan**: [plan.md](plan.md) | **Spec**: [spec.md](spec.md)

**Stack**: TypeScript / Next.js (App Router) + PostgreSQL 16, Drizzle, Zod, pino, Vitest. Builds on
feature 003 (`performers`, `bookings`, `createBooking`, `PERFORMER_RULES`) and feature 009 (the
series-scoped `musician` rate — already shipped; no rate work here). No new external dependency.

**Test-First is NON-NEGOTIABLE** (constitution Principle I): band CRUD, book-as-unit (skip rule +
rate default), and the grouping read model are integration-tested against real `zak1_test` (no DB
mocking); roster/one-lead validation is unit-tested where it's pure.

**Scope note**: Feature 007 (public site) doesn't exist yet, so US3 delivers a tested **grouping read
model** (`groupEventBookingsForDisplay`), not a public page — the page lands with 007. FR-012/FR-013
(series `musician` rate; Lead == Musician) are already satisfied by feature 009 — US2 includes a
regression check, not a re-implementation. UI-only outcomes (SC-006/SC-007's pre-fill convenience)
are manually verified via quickstart (T027), since this project does not auto-test UI.

**Conventions**: `[P]` = parallelizable (different files, no incomplete deps). Story labels `[US1]`,
`[US2]`, `[US3]`. Paths repo-relative.

---

## Phase 1: Setup

- [X] T001 [P] Zod schemas in `src/server/validation/bands.ts`: `bandCreateSchema` (name, optional
  bio/photoUrl, `members: {performerId uuid, isLead boolean}[]` with a refine enforcing exactly one
  `isLead === true` and ≥1 member), `bandPatchSchema` (all optional; if `members` present, same
  one-lead/≥1 refine), `bookBandSchema` (`bandId uuid`, optional `memberPay: {performerId, amount≥0}[]`)

---

## Phase 2: Foundational (blocking prerequisites)

- [X] T002 Author migration `0013_bands.sql` in `src/server/db/migrations/`: `bands` (id, name NOT
  NULL, bio, photo_url, archived_at timestamptz NULL, created_at, updated_at); `band_members` (id,
  band_id FK→bands CASCADE NOT NULL, performer_id FK→performers RESTRICT NOT NULL — RESTRICT is
  defensive; no performer-delete path exists today — is_lead boolean NOT NULL default false,
  created_at) with UNIQUE (band_id, performer_id); `ALTER TABLE bookings ADD COLUMN band_id uuid
  REFERENCES bands(id)`; index (event_id, band_id) on bookings
- [X] T003 [P] Drizzle schema `src/server/db/schema/bands.ts` (`bands`, `bandMembers` tables +
  `BandRow`/`BandMemberRow` types); add `bandId` column to `bookings` in
  `src/server/db/schema/bookings.ts`; export bands from `src/server/db/schema/index.ts`
- [X] T004 [P] Add `BAND_NOT_FOUND` (404) to the `ApiErrorCode` union and `errors` object in
  `src/server/lib/apiError.ts`; add `band.created`, `band.updated`, `band.deleted`, `band.booked` to
  the `AuditEvent` kind union in `src/server/lib/audit.ts`
- [X] T005 Widen `createBooking` in `src/server/domain/bookings/bookingService.ts` to accept `DbOrTx`
  (currently `Db`) so the book-as-unit loop can call it inside one transaction; no behavior change
  (verify existing booking tests still pass)
- [X] T006 Apply migration `0013` to the dev DB; extend `resetDb` in
  `tests/integration/helpers/db.ts` to TRUNCATE `bands, band_members` (bookings already listed)

**Checkpoint**: schema, error/audit codes, and the `DbOrTx` seam are in place — both P1 stories build
on this.

---

## Phase 3: User Story 1 — Define and maintain a reusable Band roster (Priority: P1) 🎯 MVP

**Goal**: An organizer can create, view, edit (name/bio/photo/roster, reassign lead), and
soft-delete a Band; a band's bio/photo is independent of any member's.

**Independent test**: Create a band with a lead + two musicians; reopen it, add/remove a member,
reassign the lead; confirm exactly one lead is always enforced and edits persist.

### Tests first (MUST fail before implementation)

- [X] T007 [P] [US1] Unit test: one-lead/≥1-member roster validation (a roster with zero or two leads
  is rejected; a valid one passes) in `tests/unit/bands.roster.test.ts` (FR-001)
- [X] T008 [P] [US1] Integration test: `POST /api/bands` creates a band + roster and it appears in
  `GET /api/bands`; `GET /api/bands/:id` returns the roster with the lead flagged; unknown performer →
  404, zero/two leads → 422, in `tests/integration/bands.crud.test.ts` (FR-001/FR-010)
- [X] T009 [P] [US1] Integration test: `PATCH /api/bands/:id` edits name/bio/photo and replaces the
  roster (including reassigning the lead); confirm one-lead invariant holds and a member's own
  `performers.bio`/`photoUrl` are untouched by band edits (and vice versa); **also confirm a roster
  replace leaves any pre-existing band-linked bookings' `band_id` intact** (the CASCADE is scoped to
  `band_members`, not `bookings` — FR-002 no-retroactive-change), in
  `tests/integration/bands.edit.test.ts` (FR-002/FR-009/SC-005)
- [X] T010 [P] [US1] Integration test: `DELETE /api/bands/:id` soft-deletes (archived band disappears
  from `GET /api/bands`, its row persists, no performer altered); deleting an already-archived band is
  a no-op 204, in `tests/integration/bands.delete.test.ts` (FR-011)

### Implementation

- [X] T011 [US1] `bandService.ts` in `src/server/domain/bands/`: `createBand`, `getBand`, `listBands`
  (active only), `patchBand` (name/bio/photo + roster replace), `archiveBand` — all transactional,
  enforcing exactly one `is_lead`; write `band.created`/`band.updated`/`band.deleted` audits
- [X] T012 [US1] Route handlers `GET/POST /api/bands` in `src/app/api/bands/route.ts`
- [X] T013 [US1] Route handlers `GET/PATCH/DELETE /api/bands/[id]` in `src/app/api/bands/[id]/route.ts`
- [X] T014 [US1] Admin band directory page `src/app/(admin)/bands/page.tsx`: list active bands;
  create/edit form (name, bio, photoUrl, pick performers, mark one as lead); archive button

**Checkpoint**: US1 independently testable — bands are fully manageable via API + UI.

---

## Phase 4: User Story 2 — Book an entire Band onto an event in one action (Priority: P1)

**Goal**: An organizer books a whole band in one action; one booking per current roster member
(right performer type, correct pay/check via the existing rules), skipping any member already booked
on the event; per-member pay defaults to the series `musician` rate. Per-event booking edits after
booking a band never touch the band's reusable roster.

**Independent test**: Book a 4-person band onto an event → 4 bookings with correct types and the
series musician-rate pay; pre-book one member individually, re-run → that member is skipped.

### Tests first (MUST fail before implementation)

- [X] T015 [P] [US2] Integration test: `POST /api/events/:id/book-band` creates one booking per roster
  member with the lead as `lead_musician` and the rest as `musician`, each with `band_id` set;
  response reports `createdCount`, in `tests/integration/bookBand.test.ts` (FR-003/FR-004/SC-001)
- [X] T016 [P] [US2] Integration test: a member already booked on the event is skipped — response
  `{ createdCount: n-1, skippedCount: 1 }`, no duplicate `(event, performer)` booking row, in
  `tests/integration/bookBand.skip.test.ts` (FR-003c)
- [X] T017 [P] [US2] Integration test: with a series `musician` rate set (feature 009), every
  band-member booking defaults to that rate; with no rate set, defaults to 0; an explicit `memberPay`
  entry overrides for that member — proving the flow inherits 003/009 rate behavior, in
  `tests/integration/bookBand.rate.test.ts` (FR-003a/FR-006, server-side regression for FR-012/FR-013;
  SC-007's UI pre-fill is manually verified per T027)
- [X] T018 [P] [US2] Integration test: editing a band's roster after booking it does not change that
  event's already-created bookings (members/pay unchanged), in
  `tests/integration/bookBand.historicalIntegrity.test.ts` (SC-004)
- [X] T019 [P] [US2] Integration test: after booking a band onto an event, removing one of the created
  bookings and adding a different individual booking for that event (via the existing feature-003
  booking endpoints) leaves the Band's `band_members` roster unchanged, in
  `tests/integration/bookBand.rosterUntouched.test.ts` (FR-005, US2 scenario 2)

### Implementation

- [X] T020 [US2] `bookBand.ts` in `src/server/domain/bands/`: load current roster, filter out members
  with an existing `(eventId, performerId)` booking, call `createBooking` (per member, correct type,
  `band_id`, `memberPay` override if given) inside one transaction; write a `band.booked` audit;
  return `{ createdCount, skippedCount, bookings }`
- [X] T021 [US2] Route handler `POST /api/events/[id]/book-band` in
  `src/app/api/events/[id]/book-band/route.ts`
- [X] T022 [US2] Add a "Book a band" action to `src/app/(admin)/bookings/page.tsx`: pick an active
  band, per-member pay inputs with the propose-the-first-amount convenience (FR-003b) / rate pre-fill
  (FR-003a) computed client-side, submit to book-band, then refresh the bookings list

**Checkpoint**: US2 independently testable — a band books onto an event as a unit. **MVP = US1 + US2.**

---

## Phase 5: User Story 3 — Public grouping read model (Priority: P2, read model only)

**Goal**: A read helper that groups an event's bookings into band blocks (current band identity) plus
ad-hoc bookings, ready for feature 007 to render. No public page in this feature.

**Independent test**: Book a band and add an ad-hoc musician on the same event; the helper returns one
band block (name/bio/photo, not members) plus one ad-hoc entry; two bands → two blocks.

### Tests first (MUST fail before implementation)

- [X] T023 [P] [US3] Integration test: `groupEventBookingsForDisplay(db, eventId)` returns one block
  per distinct `band_id` (current band name/bio/photo, no member list), ad-hoc bookings separately;
  two different bands on one event → two blocks; band-block identity reflects the band's *current*
  name/photo after an edit (live read), in `tests/integration/bandPublicDisplay.test.ts`
  (FR-007/FR-008, US3 scenarios 1/3/4/5, live-identity clarify)

### Implementation

- [X] T024 [US3] `publicDisplay.ts` in `src/server/domain/bands/`: `groupEventBookingsForDisplay(db,
  eventId)` → `{ bandBlocks: {bandId, name, bio, photoUrl}[], adHoc: BookingView[] }`, reading the
  current `bands` row per distinct `band_id` on the event

**Checkpoint**: US3 read model independently testable; feature 007 can consume it when built.

---

## Phase 6: Polish & Cross-Cutting

- [X] T025 [P] Update the dev route index `src/app/dev/routes/page.tsx` with the new routes (UI
  `/bands`; API `/api/bands`, `/api/bands/[id]`, `/api/events/[id]/book-band`) per the temporary
  convention (CLAUDE.md)
- [X] T026 [P] Seed a couple of sample bands from the seeded performers in `src/server/db/seed.ts`
  (and add `bands, band_members` to its TRUNCATE list)
- [X] T027 [P] Verify all [quickstart.md](quickstart.md) scenarios end-to-end, including the UI-only
  pre-fill conveniences (SC-006/SC-007) which have no automated test
- [X] T028 [P] Constitution compliance pass: strict types, no undocumented `any`/`as`, `withLogging`
  on all new routes, real-Postgres integration tests throughout; confirm existing feature 003 booking
  tests still pass after the `createBooking` `DbOrTx` widening (T005)

---

## Dependencies & Execution Order

- **Setup (T001)** → **Foundational (T002–T006)** → user stories.
- **US1 (P1)** and **US2 (P1)** both depend on Foundational. US2's service (T020) additionally depends
  on **US1's `bandService`/schema** (it reads a band's roster) and on **T005** (`DbOrTx` widening);
  US2's UI task (T022) extends the existing bookings page and depends on T021.
- **US3 (P2)** depends on Foundational + the `bookings.band_id` link being populated, since the
  grouping reads band-linked bookings; its test can seed band-linked bookings directly, so it needs
  the schema (T003) and `bandService` (T011) but is otherwise independent of US2's route/UI.
- Within Foundational: T002 (migration) → T003 (schema) → T005 (booking widening, once T003 lands);
  T004 is independent; T006 depends on T002.
- Within each story: tests first (must fail) → service → route → UI.

## Parallel Opportunities

- Foundational: T003 and T004 are different files and can proceed in parallel after T002.
- US1's test tasks T007–T010 are independent files, writable in parallel before implementation.
- US2's test tasks T015–T019 are independent files, writable in parallel.
- Once Foundational + US1's `bandService` land, US2 and US3's read model can be developed in parallel
  (different files), except US2's UI (T022) which extends the shared bookings page.

## Implementation Strategy

1. **MVP = US1 + US2** on top of Foundational — bands are manageable and bookable as a unit.
2. Add **US3** read model — unblocks feature 007's public band display later.
3. Polish: dev-route index, seed data, quickstart verification, constitution pass.

## Format validation

All tasks use `- [ ] T### [P?] [US#?] description + file path`. Setup/Foundational/Polish carry no
story label; US phases carry `[US1]/[US2]/[US3]`. 28 tasks total.
