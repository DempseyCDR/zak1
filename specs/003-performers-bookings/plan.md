# Implementation Plan: Performers & Bookings

**Branch**: `003-performers-bookings` | **Date**: 2026-06-19 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/003-performers-bookings/spec.md`

## Summary

Model the people who perform at events and how they're booked and paid. Five performer types
(Caller, Lead Musician, Open Band Musician, Sound Tech, Instructor) each carry fixed paid/check/
public-display rules. Bookings attach a performer to an event in a role with a pay amount (possibly
$0/donated) defaulted from effective-dated rate parameters and overridable per booking. The system
prevents Sound Tech on Community Dance, never pays/checks Instructors, computes a combined per-event
performer total with drill-down, and tracks per-performer appearance history and YTD earnings
(excluding donations). Extends the existing TS/Next.js + Postgres app; money in integer cents; reuses
feature 002's `events`/`series` (Community Dance via `series.has_sound_tech = false`) and the shared
logger/audit/validation helpers.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js LTS (24.x), strict mode (existing project)

**Primary Dependencies**: Next.js (App Router), Drizzle ORM, Zod, pino; reuses feature 002 events,
feature 001 contacts, and shared `withLogging`/`parseBody`/`money`/`audit`

**Storage**: PostgreSQL 16. Pay amounts as integer cents. Effective-dated rate lookup by event date.

**Testing**: Vitest; integration tests against the real `zak1_test` database (no DB mocking)

**Target Platform**: Linux server (Node); organizer-facing admin UI

**Project Type**: Web application (single Next.js project — extends existing `src/` layout)

**Performance Goals**: Standard CRUD/admin responsiveness (<1 s); no special throughput needs

**Constraints**: Pay math exact (integer cents); booking rules enforced server-side (check/paid/public/
sound-tech-on-community-dance/instructor-free); rate-parameter changes audited

**Scale/Scope**: ~1,200 historical performers; a handful of bookings per event; single tenant (CDR)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Test-First (NON-NEGOTIABLE)**: PASS — each story leads with failing tests (type rules,
  effective-dated rate selection + override, $0 donation handling, performer total, audit).
- **II. Simplicity / YAGNI**: PASS — performer-type rules expressed as a small static rule table, not
  a class hierarchy; reuses 002 events; no cross-club directory (deferred).
- **III. Type Safety**: PASS — strict TS; Zod at boundaries; performer type & rate kind as enums;
  integer-cents money; no undocumented `any`/`as`.
- **IV. Observability**: PASS — structured logging on handlers; audit entries for rate-parameter
  changes (FR-011) and booking create/edit.

**Initial gate: PASS. No violations — Complexity Tracking left empty.**

## Project Structure

### Documentation (this feature)

```text
specs/003-performers-bookings/
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
│   ├── (admin)/performers/      # performer directory + bio/photo management
│   ├── (admin)/bookings/        # book performers onto an event
│   └── api/
│       ├── performers/          # CRUD
│       ├── rate-parameters/     # effective-dated rates (caller, sound_tech)
│       └── events/[id]/bookings # create/list bookings for an event; performer total
├── server/
│   ├── db/
│   │   ├── schema/              # performers, bookings, rateParameters, rateParameterAudit
│   │   └── migrations/          # 0005_performers.sql
│   └── domain/
│       ├── performers/          # performer service + type rule table
│       └── bookings/            # booking service, rate resolution, performer total, history/YTD
└── (reuses src/server/lib/money.ts, logger.ts, audit.ts)
```

**Structure Decision**: Continue the single Next.js project. Performer-type behavior lives in a static
rule table (`performerRules.ts`) consulted by the booking service — simplest expression of the
paid/check/public matrix. Bookings reference feature 002 `events`; the Sound-Tech-on-Community-Dance
rule reads `series.has_sound_tech`.

## Complexity Tracking

> No constitution violations — section intentionally empty.
