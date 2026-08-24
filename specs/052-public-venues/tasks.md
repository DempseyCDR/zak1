# Tasks: Public venues & directions (P7-R8)

**Feature dir**: `specs/052-public-venues/` · **Branch**: `052-public-venues` (off `main`)
**Input**: plan.md, research.md, data-model.md, contracts/public-venues.md, quickstart.md, spec.md

**Constitution**: Test-First (NON-NEGOTIABLE) — the test task in each area precedes its implementation task.
**Additive migration `0035`** (0034 is 051's, in flight — different tables). **No new capability** (`venue.write`
already gates venue edits). ⚠️ The **privacy gate** — `public = is_public AND has an address`, non-public →
name-only — is applied at one shared point that every public read consumes.

## Phase 1: Setup

No setup: no new dependency, no new capability, no config. (`.markdownlint` `tmp/**` ignore is re-applied on
this branch; `venues` is already in the test `resetDb()` TRUNCATE list.)

## Phase 2: Foundational (blocking prerequisites — the fields + the gate)

- [X] T001 Migration `src/server/db/migrations/0035_venue_public_directions.sql`: `ALTER TABLE venues ADD
  COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false`, `ADD COLUMN IF NOT EXISTS directions text`.
  Additive. Snapshot `zak1_dev` first, then `pnpm run db:migrate`.
- [X] T002 Drizzle schema `src/server/db/schema/venues.ts`: add `isPublic` (`boolean`, notNull, default false)
  and `directions` (`text`, nullable).
- [X] T003 [P] Unit test `tests/unit/venueValidation.test.ts`: `venueCreateSchema`/`venuePatchSchema` accept
  `isPublic` (boolean) and `directions` (string/null). (Test-first — fails until T004.)
- [X] T004 Validation `src/server/validation/venues.ts`: add `isPublic: z.boolean().optional()` and
  `directions: z.string().trim().nullable().optional()` to `venueCreateSchema` and `venuePatchSchema`.
- [X] T005 Integration test `tests/integration/publicVenues.test.ts` (real Postgres) — **the privacy gate**:
  seed a **public** venue (address + directions) and a **non-public** venue; assert `listPublicVenues` returns
  only the public one (with `directions`) and never the non-public/address-less one; seed an event at the
  non-public venue and assert `getPublicEventDetail`'s venue is **name-only** (no address/map/directions), and
  at a public venue assert the full block incl. `directions`; assert `venueService` **rejects** setting
  `is_public = true` on a venue with an empty address (insert one directly to bypass create validation).
  (Test-first — fails until T006/T007/T008.)
- [X] T006 Implement `src/server/domain/venues/venueService.ts`: `createVenue`/`patchVenue` handle `isPublic` +
  `directions`; **reject** (422 `errors.validation`) any change that would leave the venue `is_public = true`
  with an empty/whitespace **effective address** (`incoming.address ?? existing.address`).
- [X] T007 Implement `src/server/domain/public/publicVenues.ts`: `publicVenueView(v)` → the full public shape
  `{ name, address, mapUrl, directions }` when `v.isPublic` **and** `v.address` is non-empty, else **name-only**
  `{ name, address: null, mapUrl: null, directions: null }`; and `listPublicVenues(db)` → every venue passing
  the predicate, ordered by name.
- [X] T008 Gate `getPublicEventDetail` in `src/server/domain/public/publicSchedule.ts`: set its `venue` from
  `publicVenueView`; reshape `PublicVenue` to `{ name; address: string | null; mapUrl: string | null;
  directions: string | null }`.

## Phase 3: User Story 1 — A visitor finds a public venue's location/directions (Priority: P1)

**Goal**: the `/directions` page lists public venues with name/address/map/directions; a public venue on an
event page shows the full block.
**Independent test**: with a public venue, `/directions` shows it (name/address/map/directions), one H1, no
scroll; its event page shows the full venue block.

- [X] T009 [P] [US1] Create `src/app/(public)/directions/page.tsx` (+ `directions.module.css`): async server
  page — `listPublicVenues(db)` → each venue as `<h2>` name + address + a tappable map link + the directions
  note (omit when empty); one `<h1>`; mobile-first, no horizontal scroll; empty-state when there are none.
- [X] T010 [P] [US1] Add `{ href: "/directions", label: "Directions" }` to `PUBLIC_NAV` in
  `src/app/publicNavItems.ts` (reachable from the nav, FR-006).
- [X] T011 [US1] Update `src/app/(public)/whats-on/[eventId]/page.tsx`: render the venue **name always**, and
  the **address**, **map link**, and **directions** **only when non-null** (i.e. only for a public venue) — so
  the page consumes the gated `PublicVenue` correctly. (Shared with R5/049 — a small merge reconciliation
  later.)

## Phase 4: User Story 2 — A private venue's address is never exposed (Priority: P1)

**Goal**: a non-public venue's address/map/directions appear on zero public surfaces.
**Independent test**: with a non-public venue used on an event, `/directions` does not list it and the event
page shows the venue name only.

- [X] T012 [US2] Verify the privacy gate end-to-end (no new code beyond Foundational): the non-public venue is
  excluded from `listPublicVenues`/`/directions` (T007) and shown **name-only** on the event page (T008/T011);
  address-less/placeholder venues never appear (T007 predicate). Asserted by T005; browser-confirmed in T015.

## Phase 5: User Story 3 — Staff mark a venue public and write directions (Priority: P1)

**Goal**: a `venue.write` editor can toggle a venue public and edit its directions; public-without-address is
rejected.
**Independent test**: mark a venue public + save directions → it appears on `/directions`; unmark → it
disappears; marking an address-less venue public is rejected.

- [X] T013 [US3] Extend the venues admin `src/app/(admin)/venues/page.tsx`: add an **is-public** checkbox and a
  **directions** textarea to the venue editor, saved via the existing `PATCH /api/venues/[id]` (extended
  schema). Surface the server's reject-public-without-address error (FR-007). (The guard itself is T006.)

## Phase 6: Polish & validation

- [X] T014 Gate suite: `pnpm exec vitest run tests/unit/venueValidation.test.ts
  tests/integration/publicVenues.test.ts`, then `pnpm exec tsc --noEmit`, `pnpm run lint`, and
  `pnpm exec prettier --check` on the changed files. Full `pnpm test` green (migration applied).
- [X] T015 Browser verify (quickstart §2–3): mark a hall public + directions in the venues admin → it appears
  on `/directions` (name/address/map/directions), one H1, 375px no-scroll, reachable from the nav (SC-001/004);
  an event at a **non-public** venue shows the venue **name only**, no address/map/directions, and the venue is
  absent from `/directions` (SC-002); marking an address-less venue public is **rejected** (SC-003); unmark →
  gone everywhere.

## Dependencies

- T001 → T002 → (T003 [P] → T004) and (T005 [P] → T006/T007/T008). Foundational blocks all stories.
- **US1** T009/T010 need T007 (list); T011 needs T008 (gated projection). T009/T010 are independent files ([P]).
- **US2** T012 depends only on Foundational (+ T011 for the event-page render).
- **US3** T013 needs T004 (schema) + T006 (service guard). Phase 6 last.

## Parallel opportunities

- T003 (validation test) and T005 (gate integration test) are independent files ([P]).
- T009 (directions page) and T010 (nav) are independent files ([P]) once T007 lands.

## Implementation strategy

**MVP** = Foundational + US1 + US3 — the fields + the gate + the `/directions` page + the admin opt-in, so staff
can mark the core venues public and visitors get directions. **US2** (privacy) is delivered inherently by the
Foundational gate (a non-public venue is never exposed). Security-first ordering: the **gate (T005–T008)** lands
in Foundational before any public surface renders a venue.
