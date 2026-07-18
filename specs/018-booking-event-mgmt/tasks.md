---
description: "Task list for feature 018 — Booking & Event Management (Booker)"
---

# Tasks: Booking & Event Management (Booker)

**Input**: Design documents from `specs/018-booking-event-mgmt/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/](contracts)

**Tests**: REQUIRED (Constitution I, Test-First). Test tasks precede their implementation within each story.

**Organization**: By user story (spec priorities P1–P6), internal order **B23 → B24**; the rest independent.

## ⚠️ Shared-file note (some stories are sequential, not parallel)

- `src/server/validation/venues.ts` + the event PATCH `EVENT_FIELDS` map are edited by **US3** (eventDate,
  status) and **US6** (advertisedPriceCents).
- `src/server/domain/events/eventService.ts` is edited by **US3** (reschedule/cancel/delete) and **US4**
  (recurrence).
- `src/server/domain/public/publicSchedule.ts` is edited by **US1** (confirmed-only), **US3** (cancelled
  marker), and **US6** (advertised price).
- `src/app/(admin)/events/page.tsx` is edited by **US3**, **US4**, **US6**.

So those stories' implementation tasks are **not** file-parallel — do them in priority order. `[P]` applies
mostly to test files and the independent schema files.

---

## Phase 1: Setup

- [x] T001 Confirm baseline green on `main`: `pnpm test`, `pnpm exec tsc --noEmit`, `pnpm run lint` (Node 24).
- [x] T002 (Optional) Snapshot `zak1_dev` before the migration: `pg_dump -Fc "$DATABASE_URL" -f ~/zak1_pre_0023.dump`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The additive schema from [data-model.md](data-model.md) — two enums, four columns, and the
**confirmed backfill**. Blocks US1/US3/US5/US6 (and US2 via US1's status column).

**⚠️ CRITICAL**: Complete before the user stories.

- [x] T003 Create migration `src/server/db/migrations/0023_booking_event_mgmt.sql`: `CREATE TYPE
  booking_status`/`event_status`; add `bookings.status` (default `proposed`), **`UPDATE bookings SET status =
  'confirmed'`** (backfill pre-lifecycle bookings — FR-022), `events.status` (default `scheduled`),
  `events.advertised_price_cents` (nullable int), `venues.landlord_contact_id` (nullable FK → contacts,
  `ON DELETE SET NULL`).
- [x] T004 Add the two `pgEnum`s (`booking_status`, `event_status`) in `src/server/db/schema/enums.ts`.
- [x] T005 [P] Extend `src/server/db/schema/bookings.ts`: add `status` (`booking_status`, default proposed).
- [x] T006 [P] Extend `src/server/db/schema/events.ts`: add `status` (`event_status`, default scheduled) and
  `advertisedPriceCents` (`advertised_price_cents`, nullable int).
- [x] T007 [P] Extend `src/server/db/schema/venues.ts`: add `landlordContactId` (`landlord_contact_id`,
  nullable uuid FK → contacts).
- [x] T008 Apply + verify: `pnpm run db:migrate` (zak1_dev), confirm `zak1_test` auto-migrates; `pnpm exec
  tsc --noEmit` clean with the new columns/enums.

**Checkpoint**: Schema ready — stories can proceed in priority order.

---

## Phase 3: User Story 1 — Per-booking status lifecycle (Priority: P1) 🎯 MVP

**Goal (B23)**: Bookings carry proposed → requested → confirmed / declined; the Booker can advance status and
re-point a slot. The public shows only confirmed bookings (FR-022).

**Independent Test**: Create a booking (proposed), advance to requested→confirmed, mark one declined,
re-point another; confirm the status persists and the public schedule shows only confirmed performers.

### Tests for User Story 1 ⚠️ (write first, confirm they FAIL)

- [x] T009 [P] [US1] New `tests/integration/booking.status.test.ts`: a created booking is `proposed`;
  `PATCH /api/bookings/[id]` advances proposed→requested→confirmed and **rejects a skip** (422); any
  non-terminal → declined; re-point (new `performerId`) resets to `proposed` **and clears a previously-set
  `check_number`**; scope enforced.
- [x] T010 [P] [US1] New unit `tests/unit/booking.transitions.test.ts` for the transition-rule function
  (legal/illegal transitions, re-point → proposed).
- [x] T011 [P] [US1] New `tests/integration/public.confirmed.test.ts`: the public read model shows only
  `confirmed` bookings — a proposed/requested/declined performer does NOT appear on the public event detail;
  performer pay is absent from the public payload.

### Implementation for User Story 1

- [x] T012 [US1] Extend `bookingPatchSchema` in `src/server/validation/performers.ts`: add `status?` and
  `performerId?` (re-point).
- [x] T013 [US1] Update `patchBooking` in `src/server/domain/bookings/bookingService.ts`: validate status
  transitions (a small pure `nextBookingStatus`/`assertTransition` helper) and handle re-point (change
  `performerId` → reset status to `proposed`, and **clear `check_number` + reset `requiresCheck`/pay
  override** so a stale check number never carries to the new performer). `createBooking`/`bookBand` rely on
  the column default (`proposed`) — add a test-covered assertion, no code change needed.
- [x] T014 [US1] Filter the public read model to `status = 'confirmed'` in
  `src/server/domain/public/publicSchedule.ts` and `src/server/domain/bands/publicDisplay.ts` (FR-022).
- [x] T015 [US1] Update `src/app/(admin)/bookings/page.tsx`: per-booking status controls (advance / decline)
  and a re-point action (contact/performer picker, B39 convention).

**Checkpoint**: Booking lifecycle works; public shows only confirmed.

---

## Phase 4: User Story 2 — Cross-event bookings report (Priority: P2)

**Goal (B24)**: A staff read-across-events report (date · caller · band · musicians · sound tech + status),
filterable by caller / band / musician / series / date range.

**Independent Test**: With bookings across several events, filter by an individual musician and by series +
date range; confirm only matching events appear with each booking's status.

### Tests for User Story 2 ⚠️ (write first, confirm they FAIL)

- [x] T016 [P] [US2] New `tests/integration/bookings.report.test.ts`: `GET /api/bookings/report` returns the
  right events for each filter (series, `from`/`to`, caller, band, musician) and combined filters; each row
  carries booking status; **cancelled events appear with `cancelled: true`** (FR-005); the endpoint is
  readable by a `base` staff actor.

### Implementation for User Story 2

- [x] T017 [US2] New `src/server/domain/bookings/reportService.ts` — `assembleBookingsReport(db, filters)`
  spanning events, returning per-event rows with caller/band/musicians/sound-tech + each booking's status +
  a `cancelled` flag (cancelled events included, FR-005).
- [x] T018 [US2] New route `src/app/api/bookings/report/route.ts`: `GET` with `withAuth({ requires: "base" })`,
  parse the filter query params, call the service.
- [x] T019 [US2] New page `src/app/(admin)/bookings-report/page.tsx`: filter controls + results table.

**Checkpoint**: Report returns filtered rows with status.

---

## Phase 5: User Story 3 — Event cancel / delete / reschedule (Priority: P3)

**Goal (B25)**: Reschedule (change date), cancel (retained + public-marked), delete (guarded hard removal).

**Independent Test**: Reschedule an event; cancel one and see it marked cancelled on `/whats-on`; delete an
empty event (204); attempt to delete one with history (409).

### Tests for User Story 3 ⚠️ (write first, confirm they FAIL)

- [x] T020 [P] [US3] New `tests/integration/event.reschedule.test.ts`: the event PATCH with `eventDate` moves
  the event (as a Booker); a **Webmaster** submitting `eventDate` is refused (403 `FIELD_NOT_PERMITTED`).
- [x] T021 [P] [US3] New `tests/integration/event.cancel.test.ts`: `status: cancelled` retains the event and
  it appears marked cancelled on the public schedule; revive restores `scheduled`.
- [x] T022 [P] [US3] New `tests/integration/event.delete.test.ts`: `DELETE` refused (409) when the event has a
  door record, an attendance row, or a booking **with a check number**; `DELETE` succeeds (204) on an event
  that has none of those — **including one that has bookings at a non-zero rate but no check number** (a rate
  alone must NOT block delete).

### Implementation for User Story 3

- [x] T023 [US3] Extend `assignVenueSchema` (`src/server/validation/venues.ts`) with `eventDate?` and
  `status?`, and add them to `EVENT_FIELDS` in `src/app/api/events/[id]/route.ts` — both `event.write`.
- [x] T024 [US3] Update `src/server/domain/events/eventService.ts`: reschedule (set `eventDate`), set event
  status (cancel/revive), and `deleteEvent(db, id, authz)` with the history guardrail (door record,
  attendance row, or a booking with `check_number IS NOT NULL` → `errors`-style 409; a non-zero booked rate
  alone does not block).
- [x] T025 [US3] Add `DELETE` to `src/app/api/events/[id]/route.ts`: `withAuth({ requires: "event.write" })`,
  scope-checked, calls `deleteEvent`.
- [x] T026 [US3] Update `src/server/domain/public/publicSchedule.ts`: include cancelled events with a
  `cancelled` marker (still listed).
- [x] T027 [US3] Update `src/app/(admin)/events/page.tsx`: reschedule (date edit), cancel/revive, and delete
  controls (with the 409 → "cancel instead" message).

**Checkpoint**: Reschedule/cancel/delete all work; cancel visible publicly.

---

## Phase 6: User Story 4 — Recurring event generation (Priority: P4)

**Goal (B26)**: Generate independent events from first date + every-N-weeks + last date, capped at 60.

**Independent Test**: Generate a run; confirm the expected count of independent events; edit/cancel one and
confirm siblings are untouched; empty range → nothing; over-60 → refused.

### Tests for User Story 4 ⚠️ (write first, confirm they FAIL)

- [x] T028 [P] [US4] New `tests/integration/event.recurring.test.ts`: `POST /api/events/recurring` creates the
  expected count of independent events (edit one → others unchanged); empty range creates nothing; a run over
  60 is refused (422); scope enforced (Booker's series only).
- [x] T029 [P] [US4] New unit `tests/unit/recurrence.dates.test.ts` for the date-generation math (every-N-weeks
  stepping, inclusive last date, count).

### Implementation for User Story 4

- [x] T030 [US4] Add `recurringEventsSchema` (`src/server/validation/venues.ts` or an events schema module):
  `seriesKey`, `firstDate`, `lastDate`, `everyNWeeks` (int ≥ 1, default 1), optional `startTime`/`groupId`/
  `chargesAdmission`.
- [x] T031 [US4] Add `generateRecurringEvents` to `src/server/domain/events/eventService.ts`: compute dates,
  refuse count > 60, insert independent events; `assertEventScope(actor, "event.write", { seriesId })`.
- [x] T032 [US4] New route `src/app/api/events/recurring/route.ts`: `POST` with `event.write`.
- [x] T033 [US4] Update `src/app/(admin)/events/page.tsx`: a recurrence generator form.

**Checkpoint**: Recurrence generates independent, capped runs.

---

## Phase 7: User Story 5 — Venue landlord contact (Priority: P5)

**Goal (B22)**: A venue can name/clear an optional landlord contact from the directory.

**Independent Test**: Set a venue's landlord to an existing contact and see it on the venue page; clear it;
delete the contact and confirm the link nulls.

### Tests for User Story 5 ⚠️ (write first, confirm they FAIL)

- [x] T034 [P] [US5] New `tests/integration/venue.landlord.test.ts`: `PATCH /api/venues/[id]` sets and clears
  `landlordContactId`; deleting the landlord contact sets the link to NULL (`ON DELETE SET NULL`).

### Implementation for User Story 5

- [x] T035 [US5] Extend `venuePatchSchema` (`src/server/validation/venues.ts`) with `landlordContactId?`
  (uuid|null) and set it in `patchVenue` (`src/server/domain/venues/venueService.ts`).
- [x] T036 [US5] Update `src/app/(admin)/venues/page.tsx`: a landlord contact picker (B39 convention) showing
  the resolved name.

**Checkpoint**: Venue landlord set/clear works.

---

## Phase 8: User Story 6 — Advertised admission price (Priority: P6)

**Goal (B27)**: A public, display-only advertised price on events, settable by Webmaster or Booker.

**Independent Test**: Set an event's advertised price (as Booker, and as Webmaster); confirm it shows on
`/whats-on` and changes no accounting figure.

### Tests for User Story 6 ⚠️ (write first, confirm they FAIL)

- [x] T037 [P] [US6] New `tests/integration/event.price.test.ts`: setting `advertisedPriceCents` via the event
  PATCH succeeds for a Booker (own series) and the Webmaster; it appears on the public read model; the
  treasurer/organizer figures for the event are unchanged (display-only, FR-018).

### Implementation for User Story 6

- [x] T038 [US6] Extend `assignVenueSchema` with `advertisedPriceCents?` (int ≥ 0 | null) and add it to
  `EVENT_FIELDS` as **`event.public.write`** in `src/app/api/events/[id]/route.ts`.
- [x] T039 [US6] Update `src/server/domain/public/publicSchedule.ts`: expose `advertisedPrice` on the public
  schedule/detail (shown when set).
- [x] T040 [US6] Update `src/app/(admin)/events/page.tsx`: an advertised-price field.

**Checkpoint**: Advertised price displays publicly, no accounting effect.

---

## Phase 9: Polish & Cross-Cutting Concerns

- [x] T041 Run `tests/integration/auth.routeInventory.test.ts` — confirm the new routes (`DELETE
  /api/events/[id]`, `POST /api/events/recurring`, `GET /api/bookings/report`) are auto-discovered with
  declared requirements (self-maintaining; no hand edit).
- [x] T042 [P] Update `specs/BACKLOG.md`: mark **B22, B23, B24, B25, B26, B27** done → feature 018.
- [x] T043 [P] Review `docs/use-cases.md`: reflect the booking status lifecycle, the confirmed-only public
  display, the cancel/delete/reschedule + recurrence Booker actions, the venue landlord, and the shared
  Webmaster/Booker advertised price.
- [x] T044 [P] (Optional) Update `src/server/db/seed.ts` to exercise the new fields for the demo (a
  proposed + a confirmed booking, a cancelled event, a venue landlord, an advertised price).
- [x] T045 Full gate green: `pnpm test`, `pnpm exec tsc --noEmit`, `pnpm run lint`, `pnpm exec prettier
  --check .`.
- [x] T046 Run the [quickstart.md](quickstart.md) walkthrough via `preview_start {name:"dev"}` — verify the
  Booker flows, the Webmaster date-refusal, and the confirmed-only public display; capture a screenshot.
- [x] T047 Author the next project-context snapshot (`zak1_Project_Context_v1.8.md`) recording P3-4 shipped,
  update the auto-memory status file, and commit the feature as one atomic commit on `main` with the
  `Co-Authored-By` trailer (ask before pushing).

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (P1)** → **Foundational (P2)**: schema + backfill; blocks US1/US3/US5/US6 (and US2 via US1).
- **User stories (P3–P8)**: priority order. **US2 depends on US1** (status column + semantics). US3/US4/US6
  share files (see the shared-file note) and run sequentially; US5 is independent.
- **Polish (P9)**: after the desired stories.

### Within each story

- Tests first (RED before GREEN, Constitution I).
- Schema/validation → service → route → UI.
- The public confirmed-only filter (T014) must land with US1 so the public display is correct once statuses
  exist.

### Parallel opportunities

- T005 / T006 / T007 (three different schema files) are `[P]` after T004 (enums).
- Each story's test files are `[P]` with each other.
- Polish T042 / T043 / T044 are `[P]`.
- Cross-story implementation is **not** parallel where files overlap (venues.ts/`EVENT_FIELDS`,
  eventService.ts, publicSchedule.ts, `/events` page).

---

## Parallel Example: schema (Phase 2, after T004)

```bash
Task: "T005 Extend src/server/db/schema/bookings.ts (status)"
Task: "T006 Extend src/server/db/schema/events.ts (status, advertised_price_cents)"
Task: "T007 Extend src/server/db/schema/venues.ts (landlord_contact_id)"
```

## Parallel Example: User Story 3 tests

```bash
Task: "T020 event.reschedule.test.ts (Booker ok, Webmaster refused)"
Task: "T021 event.cancel.test.ts (retained + public marker)"
Task: "T022 event.delete.test.ts (409 guarded / 204 empty)"
```

---

## Implementation Strategy

### MVP (User Story 1)

1. Phase 1 → Phase 2 → Phase 3 (US1/B23), including the confirmed-only public filter.
2. **STOP and validate**: booking lifecycle + public shows only confirmed.

### Incremental delivery (ships as one atomic commit)

Land stories in order US1 → US2 → US3 → US4 → US5 → US6, validating each checkpoint. Because the repo commits
one atomic commit per feature, the "increments" are validation gates, not separate deploys. Finish with
Phase 9 (full gate + quickstart + context/memory + commit).

## Notes

- `[P]` = different files, no dependency on an incomplete task.
- Migration `0023` is additive except the intentional **confirmed backfill** for existing bookings (FR-022).
- The advertised price never feeds accounting (T037 asserts it); the field-level auth on the event PATCH is
  reused (US3/US6 extend `EVENT_FIELDS`, they do not add a new mechanism).
