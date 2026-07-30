# Implementation Plan: Door-attendant check-in experience — roster corrections + selection & entry polish

**Branch**: `025-door-checkin-experience` (solo-maintainer mode, constitution v1.3.0 — one atomic commit to
`main`) | **Date**: 2026-07-30 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/025-door-checkin-experience/spec.md`

## Summary

Phase 4 Area C. A polish layer over feature 017 (check-in) and 016 (role-aware nav), plus the one genuinely
new capability: **per-record roster correction**. Attendance is take-only today (POST/GET); this feature adds
a per-record **edit / delete / move** path so the Door Attendant (Meg, `attendance.write`) can fix a roster
after the fact — delete a not-present record, change a children count, reassign an unmatched admission to a
contact, toggle open-band, nudge the aggregate comp/gift tallies, and move a dancer to a **same-group sibling
event** — while the denormalized `events.attendance_count` (and `door_records.open_band_count`) stay exact.
Around it, four polish slices: a **default + descending sort + richer label** on the event selector, an
**inline single-row** check-in that also carries children on the anonymous path, the **staff nav on the home
page**, and removing the **vestigial "open door record" button**. **No schema change, no migration** — the
`attendance` table already carries `children_count`, `is_open_band`, and a nullable `contact_id`, and
`events.attendance_count` is already maintained; this feature is new domain operations + routes + UI over the
existing shape. B41 (401→`/login`) already shipped as 022 and is out of scope.

## Technical Context

**Language/Version**: TypeScript 5.7 (strictest) · Node 24 · pnpm

**Primary Dependencies**: Next.js 16.2.10 (App Router, RSC) · React 19.2 · Drizzle · Zod. **No new runtime
dependency.**

**Storage**: PostgreSQL 16. **No migration** — no schema change. Uses existing `attendance`
(`children_count`, `is_open_band`, `contact_id`), `events` (`attendance_count`, `group_id`, `start_time`),
`event_groups`, and `door_records` (`comp_count`, `gift_card_redemption_count`, `open_band_count`).

**Testing**: Integration (node, real Postgres) — attendance delete/patch/move/reassign/open-band toggle and
the comp/gift ±1, each asserting the `events.attendance_count` (and `door_records` count) invariant; the
same-group move guardrail (refuse a non-sibling); group-siblings; `listEvents` ordering; the unmatched-path
children fix. Component (jsdom, 020 harness) — the check-in roster correction modal, the inline single-row
check-in (children on the anonymous path + focus-to-search), the selector default/sort/label, and the home
staff nav.

**Target Platform**: Web, single tenant, staff door surfaces (`/checkin`, home).

**Project Type**: Next.js App Router monolith; domain under `src/server/`, UI under `src/app/`.

**Performance Goals**: Door-scale — a roster is tens of rows; every operation is a handful of indexed
statements. Trivial.

**Constraints**: The denormalized head count MUST never drift (`events.attendance_count` stays equal to present
admissions plus their children after any correction). A move MUST be **server-validated** to a real same-group
sibling
(never trust the client). comp/gift/open-band counts floor at zero. Accounting stays **counts-only /
un-attributed** (decision B) — no per-person comp/gift storage. The FS's aggregate gate override still wins
for money. Existing suite stays green.

**Scale/Scope**: ~2 new event-service helpers (ordering, group-siblings), ~4 new attendance-domain
operations (delete, patch = children/reassign/open-band, move) + 1 door-count adjust, ~3 thin routes, a
validation change (children on the unmatched path), and UI on `/checkin` + the home page. No migration.

## Constitution Check

*GATE: Must pass before Phase 0. Re-check after Phase 1.* Constitution v1.3.0 (principles I–IV).

| Principle | Verdict |
|---|---|
| **I. Test-First** | **PASS** — each correction lands test-first against real Postgres: delete/children-edit/reassign/open-band/move + comp-gift ±1, each asserting the head-count (and door-count) invariant; the non-sibling move refusal; the unmatched-children fix; selector ordering. Modal + inline-row + home-nav get jsdom component tests. |
| **II. YAGNI** | **PASS** — reuses the existing `attendance` columns and the already-denormalized `events.attendance_count`; **no migration**, no new table. The only new primitives are per-record attendance mutations, a group-siblings read, and a door-count ±1. The "check into both grouped events at once" nice-to-have is explicitly deferred. |
| **III. Type Safety** | **PASS** — new inputs (attendance patch `{ childrenCount?, contactId?, isOpenBand?, eventId? }`, the door-count adjust `{ count, delta }`) are Zod-validated at the boundary; the move target is server-validated against the real sibling set. No `any`. |
| **IV. Observability** | **PASS** — every correction (delete, children edit, reassign, open-band toggle, move, comp/gift adjust) goes through `writeAudit`, so a roster change is traceable (FR-020) even though the plain check-in path historically did not audit. |

**Development Workflow**: solo-maintainer mode — one atomic commit to `main`, the full local gate suite as the
reviewer. Complies.

### Post-Design Re-Check

Re-evaluated after Phase 1: **still PASS.** No new table/migration; the head-count invariant is enforced in
one place per operation and covered by tests; the move guardrail mirrors the 024 "server-validate, never
trust the client" pattern; comp/gift stay counts-only (decision B).

## Project Structure

### Documentation (this feature)

```text
specs/025-door-checkin-experience/
├── plan.md              # This file
├── research.md          # R1..R7 (decisions)
├── data-model.md        # no persistent change — the attendance mutation operations + invariants
├── quickstart.md        # per-story validation
├── contracts/
│   └── attendance-corrections.md   # PATCH/DELETE attendance, group-siblings, door-count adjust
├── checklists/requirements.md      # complete (from /speckit-specify)
└── tasks.md             # /speckit-tasks (NOT created here)
```

### Source Code (repository root)

```text
src/
├── server/
│   ├── domain/
│   │   ├── attendance/attendanceService.ts   +deleteAttendance / patchAttendance (children, reassign,
│   │   │                                       open-band) / moveAttendance(toEventId); keep events.attendance_count
│   │   │                                       + door_records.open_band_count exact; audited
│   │   ├── events/eventService.ts            listEvents gains descending order (date, start_time);
│   │   │                                       +getGroupSiblings(eventId) (same non-null group_id)
│   │   └── door/doorRecordService.ts          +adjustDoorCount(eventId, 'comp'|'gift', +1|-1) (floor 0), audited
│   ├── validation/attendance.ts               childrenCount allowed on the `unmatched` path (FR-015);
│   │                                           +attendancePatchSchema, +doorCountAdjustSchema
│   └── app/api/
│       ├── attendance/[id]/route.ts (new)      PATCH { childrenCount?, contactId?, isOpenBand?, eventId? } · DELETE
│       ├── events/[id]/group-siblings/route.ts (new)  GET → sibling events (move targets)
│       └── events/[id]/door-count/route.ts (new)      POST { count, delta } (comp/gift ±1)
└── app/
    ├── page.tsx                               render the role-aware staff <Nav/> when signed in (getCurrentStaff)
    └── (door)/checkin/page.tsx                default recent event + descending sort + rich label; inline
                                               comp/children/confirm per row (incl. children on unmatched) +
                                               focus-to-search; roster row → correction modal; drop the
                                               "open door record" button
```

**Structure Decision**: No structural change — the established monolith. Work extends the attendance domain
with per-record mutations, adds two event-service reads (ordering + group-siblings) and one door-count adjust,
three thin routes, one validation relaxation, and UI on the check-in page + the home page. No migration.

## Complexity Tracking

> No entries. No constitution deviation, no new table/migration. The feature is per-record attendance
> operations + selection/entry polish layered on the existing 017/016/010 shape.
