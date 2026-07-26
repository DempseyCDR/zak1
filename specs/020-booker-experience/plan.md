# Implementation Plan: Booker Experience (P4-1)

**Branch**: `main` (solo-maintainer mode, constitution v1.3.0 — one atomic commit per feature) | **Date**:
2026-07-25 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/020-booker-experience/spec.md`

## Summary

A UX feature for **Sean the Booker**, layered on the feature-018 booking substrate. It is **mostly
front-end** — a richer bookings report and two modals (booking, event) — over APIs that already exist. The
only new persistence is **`venues.short_name`** and a **`tentative`** value on the `booking_status` enum.

The load-bearing insight from reading the code: almost everything Sean needs is already built. Booking
CRUD, status transitions, event PATCH (incl. `event_date`), the rent resolution chain, and rate-based pay
defaults are all present. `createPerformer` **already links an existing contact** when handed a `contactId`,
so the add-performer hand-off is UI-only. The public "confirmed-only" display filters on
`status === "confirmed"`, so `tentative` is excluded automatically — no change there. The real backend work
is four small, well-scoped additions: the `tentative` transition, `venues.short_name` (+ initials default +
backfill), `searchPerformers`, and surfacing venue + a sort direction in the report.

## Technical Context

**Language/Version**: TypeScript 5.7 (strictest) · Node 24 · pnpm

**Primary Dependencies**: Next.js 16.2.10 (App Router, RSC) · React 19.2 · Drizzle · Zod. **No new runtime
dependency.**

**Storage**: PostgreSQL 16. One additive migration **`0025_booker_experience.sql`**: `ALTER TYPE
booking_status ADD VALUE 'tentative'`; `venues.short_name text`; **one intentional backfill** of
`short_name` from venue-name initials.

**Testing**: Two test types on one Vitest runner.

- **Integration/unit (node, real Postgres)** — the domain + API changes: `tentative` transition,
  `searchPerformers`, `venueShortNameDefault`, `mailtoEmailFor`, `priorEventDefaults`, report sort +
  `venueShortName` + `hasSoundTech`, rent Option A.
- **Component (jsdom, React Testing Library + user-event + jest-dom, stubbed `fetch`)** — the two modals and
  the report interactions. Added this feature (see research R8): `.test.tsx` files opt into jsdom via a
  `// @vitest-environment jsdom` docblock; the DB integration suite is untouched. Stubbing `fetch` in a
  component test is UI-boundary isolation, **not** the constitution's DB-no-mock rule (which governs
  integration tests against real infra). This closes the C1 gap flagged in `/speckit-analyze` — the modals
  are no longer manually-verified-only.

**Target Platform**: Web, single tenant, staff admin surface.

**Project Type**: Next.js App Router monolith; domain under `src/server/`, UI under `src/app/(admin)/`.

**Performance Goals**: Admin-scale. Performer typeahead over ~30 rows — trivial; ILIKE, no trigram needed.

**Constraints**: Money is integer cents. Public schedule / treasurer / organizer reports MUST NOT change.
Non-Bookers see the report and modals **read-only**. Existing 510-test suite stays green.

**Scale/Scope**: 5 user stories; 1 migration; 2 data additions; ~1 new endpoint (`searchPerformers`); the
bulk is the report + two modals (front-end).

## Constitution Check

*GATE: Must pass before Phase 0. Re-check after Phase 1.* Constitution v1.3.0.

| Principle | Verdict |
|---|---|
| **I. Test-First** | **PASS** — domain/API pieces go test-first (transition, `searchPerformers`, initials, mailto precedence, prior-event default, rent Option A), AND the modals/report get **component tests** (jsdom + RTL) test-first alongside each component. The C1 gap from `/speckit-analyze` (UI manually-verified-only) is closed by adding the component-test harness this feature. Browser manual validation remains as a final smoke, not the primary coverage. |
| **II. YAGNI** | **PASS** — no speculative abstraction. The typeahead is the *first* B39 picker built for this concrete need; generalizing it is explicitly deferred (spec Out of Scope). No new tables. |
| **III. Type Safety** | **PASS** — new inputs (performer search query, venue short name, event create/patch) are Zod-validated at the boundary; the `tentative` value is added to the enum so `BookingStatus` stays exhaustive. No `any`. |
| **IV. Observability** | **PASS** — every new mutation reuses the existing `writeAudit` path (venue update, booking status/substitute already audited). No new unlogged writes; no ad-hoc logging. |

**Development Workflow**: solo-maintainer mode (v1.3.0) — one atomic commit to `main`, full local gate
suite as the reviewer. Complies as written.

### Post-Design Re-Check

Re-evaluated after Phase 1: **still PASS.** The design added no third table, no escape hatch, and no
unlogged mutation. Two notes (neither a violation): (1) the `tentative` enum value can't be used in the same
transaction it's added (Postgres) — handled by migration ordering, as in feature 019 (research R1); (2) a
component-test harness (RTL + jsdom + user-event + jest-dom) was added to Vitest to close the analyze C1 gap,
scoped so the node DB suite is unaffected (`.test.tsx` opt into jsdom; a smoke test proves it).

## Project Structure

### Documentation (this feature)

```text
specs/020-booker-experience/
├── plan.md              # This file
├── research.md          # R1..R8
├── data-model.md        # venues.short_name, tentative status, report shape
├── quickstart.md        # per-story validation
├── contracts/
│   ├── bookings-report.md
│   ├── booking-modal.md
│   ├── performer-search.md
│   ├── event-modal.md
│   └── venue-short-name.md
├── checklists/requirements.md   # complete
└── tasks.md             # /speckit-tasks (NOT created here)
```

### Source Code (repository root)

```text
src/
├── app/(admin)/
│   ├── bookings-report/page.tsx     US1: venue short name, sort direction, status letters, empty slots,
│   │                                    click → modals
│   ├── bookings/page.tsx            US2: event selector when direct; booking modal (create/edit/read-only)
│   ├── events/…                     US4: event modal (or a shared modal component) — prior-event defaults,
│   │                                    dynamic rent
│   └── venues/page.tsx              US5: short name field
├── server/
│   ├── domain/
│   │   ├── bookings/
│   │   │   ├── bookingStatus.ts     US3: add 'tentative' to ALLOWED (requested→tentative→confirmed/declined)
│   │   │   └── reportService.ts     US1: sort direction + venue (short name) in the row
│   │   ├── performers/performerService.ts   US2: searchPerformers(q)
│   │   ├── venues/venueService.ts   US5: short_name in create/patch; venueShortNameDefault helper
│   │   └── events/eventService.ts   US4: priorEventDefaults(seriesId, beforeDate) resolver
│   ├── db/
│   │   ├── schema/{venues,enums}.ts extended
│   │   └── migrations/0025_booker_experience.sql
│   └── validation/{performers,venues,door}.ts   search query, short name, event-create defaults
└── tests/{unit,integration}/
```

**Structure Decision**: No structural change — the established Next.js App Router monolith. New work slots
into existing domain services (`bookings`, `performers`, `venues`, `events`) and existing admin pages, plus
one new endpoint. The two modals are new client components on existing pages.

## Complexity Tracking

> No entries. This feature introduces no constitution deviation and no new architectural pattern — the one
> "new" thing (the typeahead picker) is built to a concrete present need, with generalization explicitly
> deferred to B39.
