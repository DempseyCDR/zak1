# Implementation Plan: Door Attendance & Gate Capture

**Branch**: `002-door-attendance` | **Date**: 2026-06-19 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/002-door-attendance/spec.md`

## Summary

The nightly door workflow: a volunteer checks dancers in via fast fuzzy name search (reusing feature
001), creating or flagging contacts as needed, and records the evening's money — seven gate-sale
categories split by cash/card, plus cash reconciliation — from which the system computes the POS fee
(hidden from the volunteer) and the bank deposit. Identifiable attendance is purged after 90 days
while permanent quarterly counts persist. Technical approach extends the existing TypeScript/Next.js +
PostgreSQL app: new `events`/`series`, `door_records`, `gate_sales`, `attendance`, and
`quarterly_attendance_counts` tables; money stored as integer cents; the existing contact search and
audit/logging libraries are reused.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js LTS (24.x), strict mode (existing project)

**Primary Dependencies**: Next.js (App Router), Drizzle ORM, Zod, pino; reuses feature 001's
contact search, logger, audit writer, and `withLogging`/`parseBody` helpers

**Storage**: PostgreSQL 16 (`pg_trgm` already enabled). Monetary values stored as integer cents.

**Testing**: Vitest; integration tests against the real `zak1_test` database (no DB mocking)

**Target Platform**: Linux server (Node); door UI optimized for fast, touch-friendly entry

**Project Type**: Web application (single Next.js project — extends existing `src/` layout)

**Performance Goals**: Fuzzy check-in pick list within 300 ms p95 (reuses 001's trigram index);
gate-record save computes fee + deposit instantly

**Constraints**: Money math MUST be exact (integer cents, never floats); POS fee never shown to the
door volunteer; 90-day purge of identifiable attendance while quarterly counts persist permanently

**Scale/Scope**: ~60 attendees per TNC event, ~18 per ECD; single tenant (CDR)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Test-First (NON-NEGOTIABLE)**: PASS — every story leads with failing integration tests against
  real Postgres (fee/deposit math, gate categories, purge job, check-in flows).
- **II. Simplicity / YAGNI**: PASS — minimal `events`/`series` introduced only as needed to anchor a
  door record; no scheduling/calendar features beyond what door capture requires; reuses 001 search.
- **III. Type Safety**: PASS — strict TS; Zod at API boundaries; money as integer-cents values
  converted at the boundary; no undocumented `any`/`as`.
- **IV. Observability**: PASS — structured logging on all handlers; audit entries for door-record
  creation/edits and the purge job; fee figures logged server-side but never returned to the door UI.

**Initial gate: PASS. No violations — Complexity Tracking left empty.**

## Project Structure

### Documentation (this feature)

```text
specs/002-door-attendance/
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
│   ├── (door)/checkin/          # volunteer check-in UI (fast, touch-friendly)
│   ├── (door)/gate/             # gate-money entry UI
│   └── api/
│       ├── events/              # list/create event instances
│       ├── door-records/        # create/update door record + gate sales
│       └── attendance/          # check-in (match / new / unmatched)
├── server/
│   ├── db/
│   │   ├── schema/              # series, events, doorRecords, gateSales, attendance, quarterlyCounts
│   │   └── migrations/          # 0004_door.sql
│   ├── domain/
│   │   ├── events/              # event/series services
│   │   ├── door/                # door record, gate sales, fee + deposit calculators
│   │   └── attendance/          # check-in + retention/purge
│   └── lib/money.ts             # integer-cents helpers
└── jobs/
    └── attendance-purge.ts      # 90-day purge + quarterly count rollup
```

**Structure Decision**: Continue the single Next.js project from feature 001. Add a `(door)` route
group for the volunteer-facing UI (distinct from `(admin)`), and new domain modules. Reuse 001's
`contactService.searchContacts`, `logger`, `audit`, `withLogging`, and `parseBody` rather than
duplicating them.

## Complexity Tracking

> No constitution violations — section intentionally empty.
