# Tasks: Event Short Label, Start Time, and Public Description

**Feature**: `013-event-label-start-time` | **Plan**: [plan.md](plan.md) | **Spec**: [spec.md](spec.md)

**Stack**: TypeScript / Next.js (App Router) + PostgreSQL 16, Drizzle, Zod, pino, Vitest; Node 24 + pnpm.
Additive retrofit of feature 002 (events model + admin) and feature 007 (public schedule/detail + read
model). One migration `0018_event_label_time_description.sql` (0017 is latest).

**Test-First is NON-NEGOTIABLE** (constitution Principle I): integration tests run against real
`zak1_test` (no mocking); the wall-clock formatter has a zone-independent unit test. No existing behavior
changes without a test.

**Conventions**: `[P]` = parallelizable (different files, no incomplete deps). Story labels `[US1]`,
`[US2]`, `[US3]`. Paths repo-relative.

---

## Phase 1: Setup

_No setup tasks — additive change to an existing project. Work begins at Foundational._

---

## Phase 2: Foundational (blocking prerequisites)

The columns, validation, create/patch wiring, read-model fields, and the formatter are shared by all
three stories.

- [X] T001 Author migration `0018_event_label_time_description.sql` in `src/server/db/migrations/`:
  `ALTER TABLE events ADD COLUMN IF NOT EXISTS label text; ADD COLUMN IF NOT EXISTS start_time time; ADD
  COLUMN IF NOT EXISTS description text;` (all nullable, no backfill — per [data-model.md](data-model.md))
- [X] T002 [P] Update `src/server/db/schema/events.ts` — add `label` (text, nullable), `startTime`
  (`time("start_time")`, nullable), `description` (text, nullable) to the `events` table
- [X] T003 [P] New `src/server/domain/public/wallClock.ts` — pure `formatWallClock(t: string | null):
  string | null` that turns `"19:30:00"`/`"19:30"` into `"7:30 PM"` operating on the string only (no
  `Date`, no UTC/offset math); returns `null` for `null`
- [X] T004 [P] Validation: `src/server/validation/door.ts` `eventCreateSchema` gains `label`
  (`z.string().trim().min(1).optional()`), `startTime` (`z.string().regex(/^\d{2}:\d{2}$/).optional()`),
  `description` (`z.string().trim().min(1).optional()`); `src/server/validation/venues.ts` event PATCH
  schema (`assignVenueSchema`) gains the same three, each `.nullable().optional()` (value sets, null clears)
- [X] T005 Event create + patch: `src/server/domain/events/eventService.ts` `createEvent` inserts
  `label`/`start_time`/`description`; add `updateEventDetails(db, id, {label?, startTime?, description?})`;
  `src/app/api/events/[id]/route.ts` PATCH applies them alongside `venueId`/`rentCents`. Depends on
  T002 + T004.
- [X] T006 Update `src/server/domain/public/publicSchedule.ts` — `PublicScheduleItem` gains `label` +
  `startTime` (formatted via `formatWallClock`); `PublicEventDetail` gains `label` + `startTime` +
  `description`; select the new columns in `getPublicSchedule` and `getPublicEventDetail`. Depends on
  T002 + T003.
- [X] T007 Apply migration `0018` to dev + test DBs (`resetDb` needs no change — no new table)

**Checkpoint**: the three fields persist on create/patch and flow through the public read model; existing
events (all-null) are unchanged.

---

## Phase 3: User Story 1 — Distinguish same-day group events with a label (Priority: P1) 🎯 MVP

**Goal**: A short label tells two same-day, same-group events apart in every listing.

**Independent test**: Two events in one group on one date with labels "Afternoon"/"Evening" are both
shown with their labels in the public schedule, the events admin, and the door picker.

### Tests first (MUST fail before implementation)

- [X] T008 [P] [US1] Integration test — creating two events in one group on one date with labels
  "Afternoon"/"Evening" persists them and `getPublicSchedule` returns both with their labels; patching a
  label renames it; an event with no label yields `null`, in `tests/integration/eventLabel.test.ts`
  (FR-001, FR-002, SC-001)

### Implementation

- [X] T009 [US1] Events admin `src/app/(admin)/events/page.tsx` — a label input in the create form and
  the label shown in the event list; door event picker `src/app/(door)/checkin/page.tsx` shows the label
  alongside the date
- [X] T010 [US1] Public schedule `src/app/(public)/whats-on/page.tsx` — render each event's label

**Checkpoint**: US1 independently testable — same-day group events distinguishable by label everywhere.

---

## Phase 4: User Story 2 — Show a start time so dancers know when to come (Priority: P1)

**Goal**: The public schedule/detail shows each event's start time as a venue-local wall-clock time,
never shifted for the viewer.

**Independent test**: Set an event's start time to 7:30 PM; the public schedule/detail shows "7:30 PM"
regardless of the viewer's device time zone.

### Tests first

- [X] T011 [P] [US2] Unit test — `formatWallClock("19:30:00") === "7:30 PM"` (and `"14:00"` → "2:00 PM",
  `null` → `null`), asserting identical output under different `TZ` (e.g. run with `TZ=UTC` and
  `TZ=America/Los_Angeles`), in `tests/unit/wallClock.test.ts` (FR-004, SC-002)
- [X] T012 [P] [US2] Integration test — an event with `startTime` returns a formatted "7:30 PM" from the
  public schedule and detail read model; an event with none returns `null`, in
  `tests/integration/eventStartTime.test.ts` (FR-003, SC-002)

### Implementation

- [X] T013 [US2] Events admin `src/app/(admin)/events/page.tsx` — a start-time input (`<input
  type="time">`); public schedule `whats-on/page.tsx` and detail `whats-on/[eventId]/page.tsx` render the
  formatted start time (omit when absent)

**Checkpoint**: US2 independently testable — start time shown exactly as entered, zone-independent.

---

## Phase 5: User Story 3 — Describe a dance on the public event detail (Priority: P2)

**Goal**: An optional long-text description renders on the public event detail.

**Independent test**: Add a description; the public detail shows it; an event without one shows no
description block.

### Tests first

- [X] T014 [P] [US3] Integration test — an event with a description is returned by
  `getPublicEventDetail`; an event without one returns `null`, in
  `tests/integration/eventDescription.test.ts` (FR-005, FR-006, SC-003)

### Implementation

- [X] T015 [US3] Events admin `src/app/(admin)/events/page.tsx` — a description textarea; public detail
  `src/app/(public)/whats-on/[eventId]/page.tsx` renders the description block when present (omit when
  absent)

**Checkpoint**: US3 independently testable — description shown on the public detail.

---

## Phase 6: Polish & Cross-Cutting

- [X] T016 [P] Update `src/server/db/seed.ts` — give the sample event a `start_time`, and seed a same-day
  event-group pair with labels ("Afternoon"/"Evening") + a `description`, so dev data exercises the fields
- [X] T017 [P] Verify all [quickstart.md](quickstart.md) scenarios, including **no-regression**: an event
  created without label/start time/description appears in every listing exactly as before (FR-008/SC-004)
- [X] T018 [P] Constitution compliance pass: strict types with no undocumented `any`/`as`, real-Postgres
  integration tests, `no-console` lint clean on changed files; confirm the dev route index
  (`src/app/dev/routes/page.tsx`) needs no change (no routes added or removed — only fields)

---

## Dependencies & Execution Order

- **Foundational (T001–T007)** before all stories. Within it: T002/T003/T004 are independent `[P]`; T005
  depends on T002+T004; T006 depends on T002+T003; T007 depends on T001.
- **US1 (P1)**: test T008 → impl T009, T010.
- **US2 (P1)**: tests T011 (unit) + T012 → impl T013.
- **US3 (P2)**: test T014 → impl T015.
- **Polish (T016–T018)** after the stories it verifies.

## Parallel Opportunities

- Foundational: T002, T003, T004 in parallel (different files); T005/T006/T007 per the deps above.
- After Foundational, the three stories are independent — US1 (T008–T010), US2 (T011–T013), US3
  (T014–T015) touch mostly different files (all three edit the events admin page, so those specific
  edits serialize; the public pages differ).
- Polish T016/T017/T018 are independent.

## Implementation Strategy

1. **Foundational** — columns + validation + create/patch + read model + the `formatWallClock` helper.
2. **MVP = Foundational + US1** — the label that makes same-day group events distinguishable (the core of
   P2-4).
3. Add **US2** (start time, zone-independent) and **US3** (public description), both additive.
4. Polish: seed demo data, full quickstart incl. no-regression, constitution pass.

## Format validation

All tasks use `- [X] T### [P?] [US#?] description + file path`. Setup/Foundational/Polish carry no story
label; US phases carry `[US1]`/`[US2]`/`[US3]`. 18 tasks total.
