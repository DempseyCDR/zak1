# Implementation Plan: Check-in Overhaul

**Branch**: `main` (repo convention: one atomic commit per feature, no branch) | **Date**: 2026-07-17 |
**Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/017-checkin-overhaul/spec.md`

## Summary

Overhaul the Door Attendant's `/checkin` workflow (Phase 3 package P3-3), bundling five backlog items in the
internal order **B34 → B33; B29 before B36**. The work is small in surface because almost all substrate
already exists: structured `first_name`/`last_name`/`display_name_override` (feature 012), `deriveContactNames`
already accepts an override, `door_records.comp_count`/`gift_card_redemption_count` (feature 002/014), event
groups, and the Door Attendant role with its `/gate` exclusion (feature 016). The feature closes **capture
gaps**, adds **three persisted columns**, one **role-scoped door-record write**, and enriches one read
endpoint plus the `/checkin` UI.

The one decision that shapes the data model (resolved in `/speckit-clarify`): the open-band group comp is
recorded **at each event on redemption** — no cross-event counter or entitlement ledger. Because the
organizer report reads **persisted counters** (`events.attendance_count`, `door_records.comp_count`) that
survive the 90-day attendance purge, every new quantity that feeds paying-dancer math must land in a
persisted counter, not be derived from purge-eligible attendance rows.

Approach per item:

- **B34** — add `lastName` (required in UI) + `displayNameOverride` to the check-in path (`attendanceSchema`
  `newContact` variant → `recordAttendance` → already-capable `deriveContactNames`), plus UI fields.
- **B33** — enrich `listEventAttendance` to return structured `firstName`/`lastName` + a `sort` param
  (`first`|`last`), and add a roster panel to `/checkin`.
- **B35** — add `attendance.children_count`; `recordAttendance` increments `events.attendance_count` by
  `1 + childrenCount`. Paying-dancer math is **unchanged**: children ride inside `attendance_count` and are
  neither performers nor comps, so they are counted as paying automatically.
- **B29** — a new **`attendance.write`-scoped** service + endpoint that ensures the door record and sets
  `comp_count` + `gift_card_redemption_count` (Door Attendant, in `/checkin`, never `/gate`). `/gate` keeps
  its `gate.write` PATCH of the same fields (FR-015 FS override).
- **B36** — add `attendance.is_open_band` (per-row, for roster + marking, purge-eligible) **and** a persisted
  `door_records.open_band_count` (survives purge, feeds the report). Open-band check-in at a
  `community_dance` event increments `attendance_count` (+1, counts as attending) and `open_band_count` (+1,
  comp). The report derives `effectiveComps = comp_count + open_band_count`.

## Technical Context

**Language/Version**: TypeScript 5.7 (strictest flags) · Node 24 (pnpm)

**Primary Dependencies**: Next.js 15.1.3 (App Router, RSC) · React 19 · Drizzle ORM · Zod · Vitest

**Storage**: PostgreSQL 16. New migration `0022_checkin_overhaul.sql` — **additive only** (three new
columns, all `NOT NULL DEFAULT`, no drops), unlike 016's destructive 0021.

**Testing**: Vitest against real local Postgres (`zak1_test`); no DB mocking (constitution). New integration
tests for the enriched attendance service/endpoint, the family/open-band math, the scoped comp/gift write,
and the paying-dancer derivation; unit tests for `deriveContactNames` override at the door and the
`effectiveComps` sum.

**Target Platform**: Web app (single-tenant), same runtime as features 001–016.

**Project Type**: Web application (Next.js App Router — server routes + RSC/client pages in one tree).

**Performance Goals**: Interactive door use; check-in and roster operations complete well under a second on a
club-sized directory (~1.3k contacts, tens of attendees per event). No new hot paths.

**Constraints**: Door Attendant MUST never reach `/gate` or a money figure (feature-016 boundary preserved).
All money remains integer cents. Persisted counters must stay correct across the 90-day attendance purge.

**Scale/Scope**: Five backlog items; ~1 migration, ~3 schema columns, ~2 domain services touched, ~2
endpoints (1 enriched, 1 new), 1 page (`/checkin`) substantially reworked, `/gate` unchanged except it now
also shows `open_band_count`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| **I. Test-First (NON-NEGOTIABLE)** | PASS (planned) | Every new behaviour lands test-first: attendance service enrichment, family/open-band counters, scoped comp/gift write, paying-dancer derivation, roster sort. Red → green → refactor. |
| **II. Simplicity / YAGNI** | PASS | The B36 clarification explicitly rejects the cross-event comp ledger. New columns are the minimum: `children_count`, `is_open_band` (roster marker), `open_band_count` (persisted report input). No abstraction added; helpers only where logic repeats. |
| **III. Type Safety** | PASS | Zod at every boundary (`attendanceSchema` extended; new count schema). Drizzle inferred types; no `any`. Server/client share contracts. |
| **IV. Observability** | PASS | New count writes audit via the existing `door_record_audit` + `writeAudit`/`recordAudit` pattern; refusals audited by `withAuth`. Structured logging via `withLogging` is inherited. |
| **Testing standard** | PASS | Real local Postgres; no mocking. No third-party boundary involved in this feature. |

**Separation-of-authority gate (feature 016):** the new comp/gift capture is deliberately an
`attendance.write` capability, NOT `gate.write` — the catalog comment in `capabilities.ts` already
anticipates "a door record's money vs. its comp counts" being written by different roles. This preserves
the Door Attendant's `/gate` exclusion (FR-018/FR-023) while letting them materialize counts the FS later
confirms. **No violation; no Complexity Tracking entry required.**

## Project Structure

### Documentation (this feature)

```text
specs/017-checkin-overhaul/
├── plan.md              # This file
├── research.md          # Phase 0 output — design decisions (esp. B36 counter model)
├── data-model.md        # Phase 1 output — schema deltas + derivations
├── quickstart.md        # Phase 1 output — end-to-end validation guide
├── contracts/           # Phase 1 output — API contract deltas
│   ├── attendance-checkin.md
│   ├── event-attendance-roster.md
│   └── checkin-counts.md
├── checklists/
│   └── requirements.md  # spec quality checklist (from /speckit-specify + /clarify)
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
src/
  app/
    (door)/checkin/page.tsx            # REWORK: last-name + display-name fields; children count;
                                       #   open-band flag (community_dance only); comp/gift capture;
                                       #   checked-in roster panel with first/last sort
    (door)/gate/page.tsx               # MINOR: show open_band_count alongside comp/gift for FS confirm;
                                       #   FS comp/gift edit path unchanged (gate.write)
    api/events/[id]/attendance/route.ts        # GET: add ?sort=first|last; POST: pass-through unchanged
    api/events/[id]/checkin-counts/route.ts    # NEW: POST, requires attendance.write (B29)
  server/
    validation/attendance.ts           # EXTEND: lastName required-in-UI, displayNameOverride,
                                        #   childrenCount, isOpenBand; NEW checkinCountsSchema
    domain/attendance/attendanceService.ts     # recordAttendance: override, childrenCount,
                                                #   isOpenBand→attendance_count/open_band_count;
                                                #   listEventAttendance: structured names + sort
    domain/door/doorRecordService.ts    # NEW recordCheckinCounts(attendance.write scope); toView +
                                        #   open_band_count; report input effectiveComps
    domain/organizer/danceResult.ts     # payingDancers: comps arg = effectiveComps (sum at call site)
    domain/organizer/reportService.ts   # pass comp_count + open_band_count
    domain/gate/eventMoney.ts           # carry open_band_count into the money view
    db/schema/attendance.ts             # +children_count, +is_open_band
    db/schema/door.ts                   # +open_band_count
    db/migrations/0022_checkin_overhaul.sql    # NEW additive migration
tests/
  integration/                          # attendance enrichment, family/open-band math, scoped write,
                                        #   report derivation, roster sort, /gate exclusion preserved
  unit/                                 # deriveContactNames override at door; effectiveComps sum
```

**Structure Decision**: Single Next.js App Router tree (the established layout for features 001–016).
Server domain services under `src/server/domain/**`, Zod schemas under `src/server/validation/**`, route
handlers under `src/app/api/**`, protected pages under `src/app/(door)/**`. No new top-level structure.

## Complexity Tracking

> No Constitution Check violations. The one design choice that could look like added complexity — the new
> persisted `door_records.open_band_count` beside the existing `comp_count` — is the *simpler* option, not a
> speculative one: it keeps the FS's `comp_count` confirmation semantics intact, avoids an absolute-vs-delta
> write conflict on a shared column, and survives the 90-day attendance purge. Deriving open-band comps from
> `attendance.is_open_band` rows at report time was rejected precisely because those rows purge. No
> justification table required.
