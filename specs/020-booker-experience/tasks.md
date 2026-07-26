# Tasks: Booker Experience (P4-1)

**Input**: Design documents from `specs/020-booker-experience/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: INCLUDED — Constitution I. Two kinds, both test-first: **integration/unit** (node, real Postgres)
for the domain/API logic (transitions, search, initials, mailto precedence, prior-event defaults, rent
Option A), and **component** tests (jsdom + React Testing Library, stubbed `fetch`) for the two modals and the
report interactions — the harness added in T004a closes the analyze C1 gap. Browser manual validation remains
a final smoke, not the primary coverage.

**Organization**: By user story. US1/US2 are P1; US3/US4 are P2; US5 is P3. Stories are largely independent
over existing feature-018 APIs — the only shared prerequisite is the Phase-1 migration.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: parallelizable (different files, no dependency on an incomplete task)
- Node 24 first: `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 24 >/dev/null 2>&1`

---

## Phase 1: Setup (migration + schema)

**Purpose**: The one shared prerequisite — the `tentative` enum value and `venues.short_name`. Everything
else builds on committed schema.

- [ ] T001 Snapshot `zak1_dev` (`set -a; . ./.env; set +a; pg_dump -Fc "$DATABASE_URL" -f ~/zak1_pre_0025.dump`) — migration 0025 backfills `short_name`
- [ ] T002 Write `src/server/db/migrations/0025_booker_experience.sql`: `ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'tentative'`; `ALTER TABLE venues ADD COLUMN IF NOT EXISTS short_name text`; **intentional backfill** of `short_name` from name initials (uppercased first letter of each word, `regexp_split_to_table` + `string_agg`), idempotent `WHERE short_name IS NULL` (header flags the backfill, as 0023/0024 did)
- [ ] T003 [P] Extend Drizzle schema: `src/server/db/schema/enums.ts` (add `'tentative'` to `bookingStatusEnum`; `BookingStatus` union follows), `src/server/db/schema/venues.ts` (`shortName: text("short_name")`)
- [ ] T004 Apply `pnpm run db:migrate`; verify every venue has a `short_name`; `pnpm exec tsc --noEmit` clean; existing 510-test suite still green
- [x] T004a **(done — 2026-07-25, ahead of implementation)** Component-test harness (analyze C1): dev deps `@testing-library/react` + `user-event` + `jest-dom` + `jsdom`; `vitest.config.ts` includes `.test.tsx` and adds `tests/setup.dom.ts` (jest-dom matchers + guarded RTL cleanup, no-op in node); `tests/unit/domHarness.smoke.test.tsx` proves render + user-event + jest-dom + stubbed `fetch`. `.test.tsx` files opt into jsdom via `// @vitest-environment jsdom`

**Checkpoint**: Schema in both DBs; component-test harness ready; no behavior change yet.

---

## Phase 2: Foundational

**Purpose**: None beyond Phase 1 — this feature layers over existing services, so each story carries its own
small domain change. (No blocking cross-story work.)

---

## Phase 3: User Story 1 — Read the bookings report at a glance (P1) 🎯 MVP

**Goal**: One row per event with venue short name, stacked musicians, per-performer status letters, empty
role slots, and asc/desc sort (FR-001..FR-006).

**Independent test**: quickstart US1 — venue short name shown, sort toggles, filter by performer, empty slots
present, no sound-tech slot on `community_dance`.

- [ ] T005 [US1] Failing integration test in `tests/integration/bookingsReport.booker.test.ts`: `sort=desc` reverses event order; each row carries `venueShortName` (falls back to derived initials when null) and `hasSoundTech` (false for `community_dance`); **filtering by performer still works after the sort/venue changes** (FR-006 regression guard — analyze U1)
- [ ] T006 [US1] Extend `assembleBookingsReport` in `src/server/domain/bookings/reportService.ts`: add a `sort: "asc" | "desc"` option (default `asc`, preserving current behavior); join `events.venue_id → venues` and add `venueShortName` to the row (fallback to `venueShortNameDefault(name)` when null); add **`hasSoundTech`** (the series flag) to the row — it MUST be on the row, since `/api/series` returns only `{id,key,name}` and the page can't read the flag otherwise (analyze G1) — T005 green
- [ ] T007 [US1] Parse `sort` in `src/app/api/bookings/report/route.ts` and pass it through
- [ ] T007a [P] [US1] Failing **component** test `tests/component/bookingsReport.test.tsx` (jsdom, stubbed fetch): given a report payload, rows show venue short name and a status letter (incl. **T**) per performer; the sort toggle re-requests with `sort=desc`; **empty role slots** render (caller/sound-tech/"add musician") and the sound-tech slot is absent when `hasSoundTech` is false; a non-Booker render shows no edit affordances
- [ ] T008 [US1] Rework `src/app/(admin)/bookings-report/page.tsx`: render **venue short name**; a **sort direction** toggle; a **status letter** beside each performer (P/R/T/C/D, letter+color via CSS class); **empty role slots** (caller, sound-tech **omitted when `hasSoundTech` is false**, booked musicians + an "add musician" slot); click a performer space → open the booking modal (US2), click an event date/label → open the event modal (US4). Non-Booker sees no edit affordances (read-only) — T007a green
- [ ] T009 [US1] Manual validation (quickstart US1) against `pnpm dev`

**Checkpoint**: The report reads at a glance — shippable as the MVP even before the modals write.

---

## Phase 4: User Story 2 — Manage a booking in a modal (P1)

**Goal**: Create/edit/read-only booking modal with a performer typeahead, pay/notes/status/substitute, one
Save + Cancel, mailto, and the add-performer hand-off (FR-007..FR-013).

**Independent test**: quickstart US2 — create from an empty slot via typeahead; edit + Save/Cancel;
add-performer from a contact; mailto; non-Booker Close-only.

- [ ] T010 [P] [US2] Failing integration test in `tests/integration/performerSearch.test.ts`: `searchPerformers` matches `display_name` ILIKE, ordered by display name; empty query browses ordered by display name
- [ ] T011 [US2] Implement `searchPerformers(db, q, limit)` in `src/server/domain/performers/performerService.ts` (ILIKE, no trigram — ~30 rows); add optional `?q=` to `GET /api/performers` returning the existing `{ items }` summary shape — T010 green
- [ ] T012 [P] [US2] Failing unit test in `tests/unit/mailtoEmail.test.ts`: precedence booking > personal > public_profile; excludes `other` and inactive emails; null when none qualifies
- [ ] T013 [US2] Implement pure `mailtoEmailFor(emails)` in `src/server/domain/contacts/mailtoEmail.ts` — T012 green
- [ ] T013a [P] [US2] Failing **component** test `tests/component/bookingModal.test.tsx` (jsdom, stubbed fetch): the three shells (create with role pre-filled / edit with Save + Cancel / read-only with Close only); Save issues one PATCH with all edited fields and Cancel issues none (no save-on-close); the **typeahead** requests `/api/performers?q=` and selecting fills the payee; the **mailto** link is present with the composed subject when the performer has a usable email and absent otherwise
- [ ] T014 [US2] Booking modal component (client) on `src/app/(admin)/bookings/page.tsx`: three shells — **create** (empty slot, role pre-filled), **edit** (Save + Cancel), **read-only** (Close only for non-`booking.write`); one Save commits pay/notes/status/substitute via `PATCH /api/bookings/:id` (create via `POST /api/events/:id/bookings`); no save-on-close; performer **typeahead** (T011); pay defaults to the rate parameter on create and is overridable; a **mailto** link (`mailto:<mailtoEmailFor>?subject=Rochester Dance <friendly date>`), absent when no usable email — T013a green
- [ ] T015 [US2] Event-selector entry: opening `/bookings` directly shows the selector first; arriving from the report passes the event and skips it
- [ ] T016 [US2] Add-performer hand-off (no new backend): when the typeahead finds nothing, a step searches an **existing contact** (`GET /api/contacts?q=`) → `POST /api/performers` with `contactId` + `displayName` (from the contact) + `performerType` (from the slot) → return to the booking modal with the new performer selected; the booking is not saved until Sean saves
- [ ] T017 [US2] Manual validation (quickstart US2)

**Checkpoint**: Sean can fill and adjust bookings from the report.

---

## Phase 5: User Story 3 — Tentative status (P2)

**Goal**: `tentative` in the lifecycle (requested→tentative→confirmed/declined, skippable), internal-only
(FR-014..FR-016). Small; can be pulled forward — it makes US1's **T** letter real.

**Independent test**: quickstart US3 — requested→tentative→confirmed; requested→confirmed direct; tentative
never public.

- [ ] T018 [P] [US3] Failing unit test extending `tests/unit/bookingStatus.test.ts`: `requested→tentative`, `tentative→confirmed`, `tentative→declined` allowed; `requested→confirmed` still allowed (skip); `proposed→tentative`, `confirmed→tentative` refused
- [ ] T019 [US3] Add `tentative` to the `ALLOWED` map in `src/server/domain/bookings/bookingStatus.ts` (`requested → [tentative, confirmed, declined]`, `tentative → [confirmed, declined]`) — T018 green
- [ ] T020 [US3] Failing integration test in `tests/integration/tentative.public.test.ts`: a booking set `tentative` is **absent** from the public display (`bands/publicDisplay.ts` confirmed-only filter) — proves FR-015 with no code change; **plus a regression guard (FR-016 — analyze U1): substituting the performer on a `tentative` (or `confirmed`) booking resets it to `proposed` and clears the check number**
- [ ] T021 [US3] Confirm the report/UI status-letter map includes **T** (from T008); no public-path change needed — T020 green
- [ ] T022 [US3] Manual validation (quickstart US3)

**Checkpoint**: "Maybe" is recordable and visibly distinct; never leaks public.

---

## Phase 6: User Story 4 — Manage event attributes in a modal (P2)

**Goal**: Event modal over existing fields, with prior-event create defaults and the dynamic-rent display
(FR-017..FR-020).

**Independent test**: quickstart US4 — modal shows fields; new event pre-fills venue+start from prior;
rent shows resolved default, re-defaults on venue change, Option A store semantics.

- [ ] T023 [P] [US4] Failing integration test in `tests/integration/priorEventDefaults.test.ts`: returns the venue + start time of the **latest event in the series with date < the given date**; nulls when there is no prior event
- [ ] T024 [US4] Implement `priorEventDefaults(db, seriesId, beforeDate)` in `src/server/domain/events/eventService.ts` — T023 green
- [ ] T025 [P] [US4] Failing integration test in `tests/integration/eventRent.optionA.test.ts`: PATCH with the value equal to the resolved default leaves `events.rent_cents` **NULL** (no override); a different value stores the override; changing the venue changes the resolved default
- [ ] T026 [US4] Provide the modal a read that **resolves rent for a chosen `(series, venue, date)`** (reuse `rentService.resolveEventRentCents` with a synthetic input `{rentCents:null, venueId, seriesId, eventDate}`; expose via a `GET` query param or small endpoint) so it can show and re-default rent before saving; ensure Option A semantics on save (equal-to-default → `rentCents: null`) — T025 green
- [ ] T026a [P] [US4] Failing **component** test `tests/component/eventModal.test.tsx` (jsdom, stubbed fetch): shows date/start/venue/rent/label/description; on create, venue + start time pre-fill from the prior-event stub; the rent field shows the resolved default (never blank) and **re-defaults when the venue changes**; Save sends `rentCents: null` when the value equals the shown default and the typed value otherwise; read-only render shows Close only
- [ ] T027 [US4] Event modal component (client): show/edit date/start/venue/rent/label/description via `PATCH /api/events/:id`; on **create**, pre-fill venue + start time from `priorEventDefaults`; rent field shows the resolved default and **re-defaults when the venue changes**; read-only shell (Close only) for non-`event.write` — T026a green
- [ ] T028 [US4] Manual validation (quickstart US4)

**Checkpoint**: Event upkeep from the report; Sean never faces a blank rent.

---

## Phase 7: User Story 5 — Venue short name (P3)

**Goal**: Editable, initials-defaulted, non-unique short name surfaced in the report (FR-024). Enhances
US1's display (US1 already falls back to derived initials, so US1 does not block on this).

**Independent test**: quickstart US5 — unset venue shows initials; edit reflects in the report.

- [ ] T029 [P] [US5] Failing unit test in `tests/unit/venueShortName.test.ts`: `venueShortNameDefault` → "German House"→"GH", "First Unitarian Church"→"FUC", "The Harmony"→"TH", ""→""
- [ ] T030 [US5] Implement `venueShortNameDefault(name)` in `src/server/domain/venues/venueService.ts`; default `short_name` from it in `createVenue` when omitted; accept `shortName` in `patchVenue`; add `shortName` to `src/server/validation/venues.ts` (trimmed, max length) — T029 green
- [ ] T031 [US5] Failing integration test in `tests/integration/venueShortName.test.ts`: create without `shortName` defaults from initials; PATCH edits it; a create with an explicit `shortName` keeps it
- [ ] T032 [US5] Add the short-name field to `src/app/(admin)/venues/page.tsx` (view + edit)
- [ ] T033 [US5] Manual validation (quickstart US5)

**Checkpoint**: Venues read compactly in the report.

---

## Phase 8: Polish & Cross-Cutting

- [ ] T034 Full gates: `pnpm test` (510 baseline + new green), `pnpm exec tsc --noEmit`, `pnpm run lint`, `pnpm exec prettier --check .`, `pnpm build`
- [ ] T035 [P] Verify `/dev/routes` (Super-user) reflects the extended routes (`/api/performers?q=`, `/api/bookings/report?sort=`)
- [ ] T036 [P] Update `docs/use-cases.md` (Booker §5.1 / matrix): tentative status, venue short name; note the performer typeahead as the first B39 picker in `specs/BACKLOG.md`
- [ ] T037 [P] Add feature-020 terms to `docs/zak1_Help_Glossary.md` (tentative status, venue short name, performer search / B39 picker, prior-event defaults)
- [ ] T038 Walk [quickstart.md](quickstart.md) end-to-end across all five stories

---

## Dependencies

```text
Phase 1 (Setup) ──> US1 (report)   ──> US2 (booking modal)  [modal launches from the report]
                ├─> US3 (tentative) [makes US1's T real; tiny — pull forward if desired]
                ├─> US4 (event modal)
                └─> US5 (venue short name) [enhances US1's display; US1 falls back to initials]
Phase 8 after all stories.
```

- US1 is the MVP and independent (falls back to derived initials before US5; renders P/R/C/D before US3).
- US2's modal launches from US1's report; US3 supplies the `tentative` status option US2 sets and the T
  letter US1 shows — but each is independently testable.
- US4 and US5 are independent of US2/US3 and of each other.

## Parallel Execution Examples

- After Phase 1: US1's T005 ∥ US3's T018 ∥ US5's T029 (different files).
- Within US2: T010 (search test) ∥ T012 (mailto test); implementations follow.
- Within US4: T023 (prior-event) ∥ T025 (rent Option A).
- Phase 8: T035, T036, T037 in parallel.

## Implementation Strategy

**MVP = Phase 1 + US1** (T001–T009): the at-a-glance report is the highest-value slice and stands alone.
Then US2 (the write surface), then **US3 pulled forward** (2 lines + tests, and it lights up US1's T
letter), then US4 and US5. One atomic commit per project convention; ask before pushing.
