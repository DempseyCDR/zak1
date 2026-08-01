# Implementation Plan: Shared filterable event selector (P5-R1)

**Branch**: `028-shared-event-selector` (solo-maintainer mode, constitution v1.3.0 — one atomic commit to
`main`) | **Date**: 2026-08-01 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/028-shared-event-selector/spec.md`

## Summary

Extract the smart event selector feature 025 gave the check-in page into **one shared client component**
(`EventSelector`) and use it on all four single-event surfaces — check-in, gate, payments, treasurer. It
defaults to the most recent event on or before today, lists events newest-first, labels each `date · HH:MM ·
label` so same-day events are distinguishable, and adds **filtering by series and date range**. Per the
clarification, the selected event is **in-page state — no deep links / per-event URLs** (YAGNI). The component
owns the event/series fetch, the filters, and the default computation, and reports the chosen event via
`onSelect`; each page keeps its own follow-on behavior (gate opens the door record, payments loads bookings,
etc.). Because the event is no longer URL-encoded, the **treasurer report moves from its `/treasurer/[eventId]`
param route to a single `/treasurer` page** with the selector (fixing the currently-broken `/treasurer/latest`
nav link). **No API change, no schema change, no migration** — reuses the descending `/api/events` and
`/api/series`, filtering client-side.

## Technical Context

**Language/Version**: TypeScript 5.7 (strictest) · Node 24 · pnpm

**Primary Dependencies**: Next.js 16.2.10 (App Router, RSC) · React 19.2. **No new runtime dependency.** No new
server domain code — reuses `listEvents` (already descending, 025) via `/api/events` and `listSeries` via
`/api/series`.

**Storage**: PostgreSQL 16 — **untouched**. No schema change, no migration.

**Testing**: Component (jsdom, 020 harness) — the `EventSelector` (default most-recent-≤-today / soonest
upcoming; descending order; `date · HH:MM · label` options; series + date-range filters narrow the list;
`onSelect` fires on picking an event, **not** on adjusting a filter; empty state) plus per-surface wiring
(check-in keeps 025's behavior; gate opens the door record on select; payments loads on select; the new
`/treasurer` page renders the selector + the report for the selected event and reloads on switch).

**Target Platform**: Web, single tenant, staff event-scoped surfaces.

**Project Type**: Next.js App Router monolith; all four surfaces are client pages.

**Performance Goals**: Admin-scale (scores of events); the selector fetches the event list once and filters
client-side. Trivial.

**Constraints**: In-page state only — the event is **not** URL-encoded (clarification); the selector is
**presentation-only** for side effects (it reports the event; the page acts). The default fires **once on
open**; adjusting a filter narrows the list but never auto-commits a selection (FR-005). Check-in's existing
default/sort/label behavior must not regress (preserve the `aria-label="Event"` + option format the 025 test
asserts). Existing suite stays green.

**Scale/Scope**: 1 new shared component; 4 surfaces refactored onto it (check-in, gate, payments swap their
inline selector; treasurer restructured from a param route to a single page); 1 nav-link fix. No server change.

## Constitution Check

*GATE: Must pass before Phase 0. Re-check after Phase 1.* Constitution v1.3.0 (principles I–IV).

| Principle | Verdict |
|---|---|
| **I. Test-First** | **PASS** — the shared `EventSelector` gets a jsdom component test (default, order, labels, filters, confirm-not-on-filter, empty) before it is built; each surface's wiring (gate door-record on select, payments load, treasurer report + switch, check-in unchanged) is covered by component tests. |
| **II. YAGNI** | **PASS** — one shared component; native `<select>`s + client-side filtering (no server pagination, no typeahead); **no deep links / URLs** (dropped as YAGNI); reuses the existing `/api/events` + `/api/series`. No new endpoint, table, or migration. |
| **III. Type Safety** | **PASS** — the component's props (`value`, `onSelect`, event/series shapes) are typed; no `any`; no new boundary (consumes existing typed API responses). |
| **IV. Observability** | **PASS** — a presentation refactor; no new logging surface, no security-relevant mutation. |

**Development Workflow**: solo-maintainer mode — one atomic commit to `main`, full local gate as the reviewer.
Complies.

### Post-Design Re-Check

Re-evaluated after Phase 1: **still PASS.** No API/schema/migration; the only structural change is the
treasurer route (param → single page), contained and covered by a test; the check-in contract is preserved so
its 025 test keeps passing.

## Project Structure

### Documentation (this feature)

```text
specs/028-shared-event-selector/
├── plan.md              # This file
├── research.md          # R1..R5 (decisions)
├── data-model.md        # no persistent change — the in-page "selected event" + selector inputs/filters
├── quickstart.md        # per-story validation + the treasurer route change
├── contracts/
│   └── event-selector.md # the EventSelector component contract (props/behavior) + APIs it consumes
├── checklists/requirements.md  # complete (from /speckit-specify, clarified)
└── tasks.md             # /speckit-tasks (NOT created here)
```

### Source Code (repository root)

```text
src/app/
├── EventSelector.tsx (new)             shared client selector — fetches /api/events (+ /api/series),
│                                       default most-recent-≤-today, desc order, date·HH:MM·label options,
│                                       series + date-range filters; props { value, onSelect }
├── (door)/checkin/page.tsx             replace inline toHHMM/eventLabel/default + <select> with <EventSelector>
├── (door)/gate/page.tsx                replace <select> with <EventSelector>; onSelect = openDoorRecord (D2)
├── (admin)/payments/page.tsx           replace <select> with <EventSelector>; onSelect = loadEvent
├── (admin)/treasurer/page.tsx (new)    <EventSelector> + the report, keyed on in-page state
├── (admin)/treasurer/[eventId]/page.tsx  REMOVED (report body moves to /treasurer/page.tsx; no deep link)
└── ... nav: src/server/auth/nav.ts     /treasurer/latest → /treasurer (fixes the broken entry, FR-010)
tests/component/
├── eventSelector.test.tsx (new)        the shared component behavior
├── checkin.selector.test.tsx           kept green (preserve the Event aria-label + option contract)
├── gate.eventSelector.test.tsx (new)   gate wires onSelect → door record
└── treasurer.page.test.tsx (new)       /treasurer renders selector + report; switching reloads
```

**Structure Decision**: No structural change to the domain/server — a UI refactor plus one route change
(treasurer param → single page, required by the no-deep-link decision). The event-selection logic centralizes
in one shared client component; each surface keeps its own side effect in its `onSelect` handler.

## Complexity Tracking

> No constitution deviation, no API/schema/migration. Two noted ripples, both contained: (1) the treasurer
> **route restructure** (`/treasurer/[eventId]` → `/treasurer`), needed because the event is now in-page state
> not a URL — the report body relocates and the nav link is fixed; (2) the **check-in contract** (the `Event`
> select's aria-label + option format) is preserved so feature 025's `checkin.selector.test.tsx` stays green
> without edits. Neither adds a new abstraction.
