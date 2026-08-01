# Implementation Plan: Bookings report defaults to descending date (P5-R2)

**Branch**: `029-bookings-report-desc-default` (solo-maintainer mode, constitution v1.3.0 — one atomic commit
to `main`) | **Date**: 2026-08-01 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/029-bookings-report-desc-default/spec.md`

## Summary

Flip the bookings report's default event-date sort from **ascending** (set by feature 020 US1) to
**descending** (newest-relevant-first), so the report leads with the nearest/upcoming and most recent events
— matching the direction the shared event selector uses on every other date-ordered surface
(025/028). The toggle already exists and keeps switching both ways; only the starting direction changes.
Three coordinated spots make the default consistent: the report page's initial sort state, the report
service's default order when no `sort` is given, and the report route's parsing of an absent `sort` query
param. **No schema, no migration, no data-model change, no new persisted preference.**

## Technical Context

**Language/Version**: TypeScript 5.7 (strictest) · Node 24 · pnpm

**Primary Dependencies**: Next.js 16.2.10 (App Router, RSC) · React 19.2 · Drizzle ORM. **No new dependency.**

**Storage**: PostgreSQL 16 — **untouched**. No schema change, no migration. The ordering is applied in the
existing `assembleBookingsReport` query (`orderBy` on `events.event_date`).

**Testing**: Vitest — an integration test on `assembleBookingsReport` (the no-`sort` default now returns
descending; an explicit `sort: "asc"` still returns ascending) and a jsdom component test on the report page
(the initial request carries `sort=desc`; one toggle flips to `sort=asc`, a second returns to `desc`).

**Target Platform**: Web, single tenant, staff admin surface (`/bookings-report`).

**Project Type**: Next.js App Router monolith; the report is a client page over a read API.

**Performance Goals**: Unchanged — ordering direction only; same query, same rows.

**Constraints**: Behavior-preserving except the default direction. The sort remains **transient UI state**
(not a saved per-user preference). No other report or surface changes. The existing suite stays green (with
the two ordering-default assertions updated to the new expectation).

**Scale/Scope**: Three one-line default changes (page state, service default, route param default) + a
comment correction; two tests updated to encode the new default; one small component test added.

## Constitution Check

*GATE: Must pass before Phase 0. Re-check after Phase 1.* Constitution v1.3.0 (principles I–IV).

| Principle | Verdict |
|---|---|
| **I. Test-First** | **PASS** — the new default is encoded in tests first: the `assembleBookingsReport(db, {})` integration assertion is changed to expect descending (and a new explicit `sort: "asc"` assertion added), and the report component test is changed to expect an initial `sort=desc` request with the toggle flipping to `asc` — both go red, then the three defaults flip to green. |
| **II. YAGNI** | **PASS** — a default-value flip in the three places that already branch on `sort`. No new abstraction, option, endpoint, table, or persisted preference. |
| **III. Type Safety** | **PASS** — the `sort?: "asc" \| "desc"` union is unchanged; only which branch is the default changes. No new boundary, no `any`. |
| **IV. Observability** | **PASS** — no new logging surface, no security-relevant mutation; a read-only report ordering. |

**Development Workflow**: solo-maintainer mode — one atomic commit to `main`, full local gate as the
reviewer. Complies.

### Post-Design Re-Check

Re-evaluated after Phase 1: **still PASS.** No schema/migration/data-model change; the only observable change
is the default ordering, encoded test-first and contained to the report page, its service default, and its
route default. The API's `sort` contract keeps the same shape — only its default value flips.

## Project Structure

### Documentation (this feature)

```text
specs/029-bookings-report-desc-default/
├── plan.md              # This file
├── research.md          # R1..R3 (decisions)
├── data-model.md        # no persistent change — sort direction is transient UI state
├── quickstart.md        # per-story validation
├── contracts/
│   └── bookings-report-sort.md  # the /api/bookings/report `sort` param + its NEW default
├── checklists/requirements.md   # complete (from /speckit-specify)
└── tasks.md             # /speckit-tasks (NOT created here)
```

### Source Code (repository root)

```text
src/app/
├── (admin)/bookings-report/page.tsx   default sort state: useState("asc") → useState("desc")
├── api/bookings/report/route.ts       absent `sort` param defaults to "desc" (was "asc")
src/server/domain/bookings/
└── reportService.ts                   orderBy default: no `sort` → desc (was asc); fix the field comment
tests/
├── integration/bookingsReport.booker.test.ts  {} default now desc; explicit sort:"asc" still asc
└── component/bookingsReport.test.tsx           initial request sort=desc; toggle → asc → desc
```

**Structure Decision**: No structural change. A three-point default flip on an existing, already-branching
`sort` parameter, kept consistent across the page's initial state, the service default, and the route's
absent-param default so all three agree on descending.

## Complexity Tracking

> No constitution deviation. No schema/migration/data-model/API-shape change. The only nuance is keeping the
> default consistent in three places (page initial state, service default, route absent-param default) so a
> direct un-parameterized report call and the page's first render agree; this is a value change, not a new
> abstraction.
