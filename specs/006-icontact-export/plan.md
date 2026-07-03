# Implementation Plan: Email List Export (iContact)

**Branch**: `006-icontact-export` | **Date**: 2026-07-02 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/006-icontact-export/spec.md`

## Summary

An admin-facing, on-demand CSV export for the 7 iContact mailing lists (contra, english, openband,
specialevents, janeaustenball, performer, member). Five are opt-in consent-topic lists; two
(performer, member) are derived audiences computed from existing feature 001/003 data. Every row
carries email + first/last name (split from `displayName`); member.csv additionally carries
`membership_status`. A separate, event-scoped **contact-tracing export** (not one of the 7 lists)
lets an admin pick an event — from a dropdown that excludes events whose attendance has already been
purged — and download a CSV of that event's recorded attendees (feature 002) who have a
`contact_tracing`-consented email, with a `date` column; a selectable event with zero recorded
attendees produces a count message instead of a file. Nothing about any generated CSV is persisted —
only lightweight audit metadata (who/when/list-or-event/row count) is, in a new
`mailing_list_exports` table, and only when a CSV is actually produced. No scheduling, no
delivery-provider API integration (CSV download only) in this phase; an incremental
(changed-since-last-export) mode is deferred (BACKLOG B17).

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js LTS (24.x), strict mode (existing project)

**Primary Dependencies**: Next.js (App Router), Drizzle ORM, Zod, pino; reuses feature 001
(`contacts`, `contact_emails`, `list_member`/membership classification), feature 002 (`attendance`,
`events`, `listEventAttendance`), and feature 003 (`performers`). No new external dependency — CSV
serialization is hand-rolled (research Decision 1).

**Storage**: PostgreSQL 16. New: `mailing_list_exports` (audit-only; who/when/list-or-event/row
count, with a nullable `event_id` for contact-tracing rows) + `mailing_list_id` enum (7 list values +
`contact_tracing` for audit purposes). No changes to existing tables.

**Testing**: Vitest; CSV escaping and `displayName` → first/last-name split as unit tests (pure
functions); per-list qualification queries, the contact-tracing event-scoped query, and the export
audit as integration tests against real `zak1_test` (no DB mocking).

**Target Platform**: Linux server (Node); one admin-facing page (7 lists + download links).

**Performance Goals**: No explicit SC in spec; single-club scale (hundreds of contacts/emails) means
on-demand generation is well under a second — not a design constraint here.

**Constraints**: CSV filenames MUST exactly match FR-001's 7 stems; the contact-tracing export's rows
and member.csv's membership "through" year MUST NOT be persisted (FR-006/FR-006a/FR-007/SC-003); "Do
Not Contact" MUST suppress every list and the contact-tracing export (FR-002a).

**Scale/Scope**: Single tenant, 7 fixed lists, on-demand only (no scheduled regeneration, per
clarify), no external API sync (CSV download only, per spec Assumptions).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Test-First (NON-NEGOTIABLE)**: PASS — CSV escaping and the name-split heuristic are pure
  functions, unit-tested first; per-list row queries and the export-audit write are integration-tested
  against real Postgres (no mocking).
- **II. Simplicity / YAGNI**: PASS — no new CSV library; one qualification query shape per list *kind*
  (topic vs. derived), not seven bespoke queries; "member" qualification reuses the existing
  `list_member` flag rather than recomputing membership status; the contact-tracing export reuses
  feature 002's existing `attendance`/`listEventAttendance` data and its `GET /api/events?from=` filter
  (no new endpoint for the purge-aware dropdown) rather than duplicating either; one small audit table
  (with one nullable `event_id` column) covers both the 7 lists and contact tracing, matching the
  existing `rate_parameter_audit` precedent instead of a heavier design; incremental export is
  deferred (BACKLOG B17) rather than built speculatively now.
- **III. Type Safety**: PASS — strict TS; `listId` path param validated against a Zod enum before use;
  no undocumented `any`/`as`.
- **IV. Observability**: PASS — structured logging via `withLogging` on both routes; `mailing_list_exports`
  gives a durable, queryable audit trail beyond the pino log (FR-009, clarify decision), mirroring how
  `rate_parameter_audit` already gives rate changes the same durability.

**Initial gate: PASS. No violations — Complexity Tracking left empty.**

## Project Structure

### Documentation (this feature)

```text
specs/006-icontact-export/
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
│   ├── (admin)/exports/                  # admin page: 7 lists + last-exported info + download links,
│   │                                     #   plus a contact-tracing section (event dropdown + download)
│   └── api/
│       └── exports/
│           ├── route.ts                  # GET: 7-list metadata + last export per list
│           ├── [listId]/route.ts         # GET: generate + stream one list's CSV; records audit row
│           └── contact-tracing/route.ts  # GET ?eventId=: generate + stream that event's tracing CSV
├── server/
│   ├── db/
│   │   ├── schema/                       # mailingListExports.ts (+ mailing_list_id enum, incl. contact_tracing)
│   │   └── migrations/                   # 0011_icontact_export.sql
│   └── domain/
│       └── exports/
│           ├── mailingLists.ts           # static registry: 7 lists → kind/consent topic/extra column
│           ├── csv.ts                    # toCsvField / rowsToCsv (escaping, header row)
│           ├── exportService.ts          # buildListRows(db, listId), recordExportRun, listExportsWithHistory
│           └── contactTracingService.ts  # buildContactTracingRows(db, eventId) — joins feature 002's attendance
└── (reuses contacts/contactEmails/schema+services from 001, attendance/events from 002, performers from 003)
```

**Structure Decision**: Continue the single Next.js project; no new package/service boundary. A new
`domain/exports/` module reads existing 001/002/003 tables directly (no changes to those schemas) and
adds exactly one new table for audit history. The two query shapes for the 7 lists (topic-list vs.
derived-list qualification, research Decision 2) live behind one `buildListRows(db, listId)` entry
point so the route handler and admin page don't need to know which kind a given list is. The
contact-tracing export is kept as its own function/route (`contactTracingService.ts`,
`contact-tracing/route.ts`) rather than forced into the 7-list shape, since it's parameterized by event
rather than being a fixed, unparameterized list (research Decision 7).

## Complexity Tracking

> No constitution violations — section intentionally empty.
