# Implementation Plan: Event Short Label, Start Time, and Public Description

**Branch**: `013-event-label-start-time` | **Date**: 2026-07-08 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/013-event-label-start-time/spec.md`

## Summary

Add three optional, display-only fields to `events` (Phase 2 item P2-4): a short **label** (free text, to
tell same-day event-group members apart), a **start time** (a venue-local wall-clock `time`, no
time-zone handling), and a long-text **description** (public detail blurb). Surface label + start time on
the public schedule and event detail, the events admin, and the door event picker; show the description
on the public event detail. Purely additive — three nullable columns, no new tables, no backfill; an
event with none set displays exactly as today. Start time is a zoneless SQL `time` formatted for display
by a small pure wall-clock formatter (no `Date`/time-zone math), satisfying "shown exactly as entered."

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 24 (Active LTS), strict mode; pnpm.

**Primary Dependencies**: Next.js (App Router, RSC), Drizzle ORM, Zod, pino. Retrofits feature 002
(events model + admin, event create/patch) and feature 007 (public schedule/detail pages + the
`domain/public/publicSchedule.ts` read model). No new external dependency.

**Storage**: PostgreSQL 16. `events` gains `label` (text, NULL), `start_time` (`time` without time zone,
NULL), `description` (text, NULL). One migration `0018_event_label_time_description.sql` (0017 is latest).

**Testing**: Vitest against real `zak1_test` (no mocking). Integration tests: create/patch persist the
three fields; the public read model returns label + start time on schedule/detail and description on
detail; a unit test for the wall-clock start-time formatter (zone-independent).

**Target Platform**: Linux/Node server. Surfaces: events admin (create/edit + list), public schedule +
event detail (feature 007), door event picker.

**Performance Goals**: None beyond today; single-club scale (additive columns, no new query cost).

**Constraints**: Start time MUST display as the local wall-clock time the admin entered, never adjusted
for the viewer (FR-004/SC-002) — so it is stored zoneless and formatted without `Date`/UTC. All three
fields optional; an event with none set is unchanged (FR-008/SC-004).

**Scale/Scope**: Single tenant. 3 nullable columns + 1 migration; edits to event create/patch validation
+ service + route, the public read model + two public pages, the events admin page, and the door event
picker; a small `formatWallClock` util + tests.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Test-First (NON-NEGOTIABLE)**: PASS — integration tests (real Postgres) cover create/patch of the
  three fields and the public read model exposing them; a unit test pins the wall-clock formatter as
  zone-independent (e.g., renders "7:30 PM" regardless of `TZ`). No existing behavior changes without a
  test.
- **II. Simplicity / YAGNI**: PASS — three nullable columns, all optional and additive; no new tables,
  no backfill. Start time is a zoneless SQL `time` (no time-zone model, no venue zone field, no end
  time), which is the minimal representation for "local wall-clock." Formatting is one small pure
  function.
- **III. Type Safety**: PASS — nullable columns typed accordingly; Zod validates the three inputs
  (start time as an `HH:MM` string) at the API boundary; the formatter returns a typed display string;
  no undocumented `any`/`as`.
- **IV. Observability**: PASS — no logging/audit change; event create/patch keep their existing paths.

**Initial gate: PASS. No violations — Complexity Tracking left empty.**

## Project Structure

### Documentation (this feature)

```text
specs/013-event-label-start-time/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── api-deltas.md
├── checklists/
│   └── requirements.md  # from /speckit-specify
└── tasks.md             # /speckit-tasks (not created here)
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── (admin)/events/page.tsx           # create/edit: label, start time, description; list shows label + time
│   ├── (door)/checkin/page.tsx           # event picker shows the label (distinguish same-day group events)
│   └── (public)/whats-on/
│       ├── page.tsx                      # schedule list shows label + start time
│       └── [eventId]/page.tsx            # detail shows label + start time + description
├── server/
│   ├── db/
│   │   ├── schema/events.ts              # + label (text), start_time (time), description (text) — all nullable
│   │   └── migrations/0018_event_label_time_description.sql   # NEW — add the three nullable columns
│   ├── domain/
│   │   ├── events/eventService.ts        # createEvent + a patch path set label/start_time/description
│   │   └── public/
│   │       ├── publicSchedule.ts         # read model: PublicScheduleItem + label/startTime; PublicEventDetail + description
│   │       └── wallClock.ts              # NEW — pure formatWallClock("19:30:00") → "7:30 PM" (no Date/TZ)
│   └── validation/
│       ├── door.ts                       # eventCreateSchema + label/startTime/description
│       └── venues.ts                     # event PATCH schema (assignVenueSchema) + label/startTime/description
├── app/api/events/[id]/route.ts          # PATCH applies label/start_time/description (alongside venueId/rentCents)
└── (app/dev/routes/page.tsx unchanged — no routes added or removed)
```

**Structure Decision**: Continue the single Next.js project. The three fields live on `events` (a
natural home; no new entity). Start-time display goes through one pure `formatWallClock` helper so the
"no time-zone conversion" rule is enforced and unit-tested in exactly one place, and both the public read
model and any admin display reuse it. The event PATCH schema (already extended by 007/011 for
venue/rent) gains the three edit fields rather than introducing a second event-patch endpoint.

## Complexity Tracking

> No constitution violations — section intentionally empty.
