# Implementation Plan: Venue-Scoped Rent with Per-Event Override

**Branch**: `011-venue-scoped-rent` | **Date**: 2026-07-07 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/011-venue-scoped-rent/spec.md`

## Summary

Reshape how rent and ongoing charges resolve (Phase 2 item P2-2), driven by two `/speckit-clarify`
decisions. **Rent** moves out of the series-scoped `series_parameters` table into a venue-keyed model with
three effective-dated layers resolved most-specific-first: **per-event → series-at-venue → venue default
→ 0**. **Ongoing** stays in `series_parameters` but is resolved as a *labeled sum* so a series can carry
several concurrent charges, each ended independently by a $0 entry. Performer pay and misc are untouched.
Existing Dance Net is preserved by freezing every existing event's rent onto a new `events.rent_cents`
override at migration time. This is a larger reshape than the P2-2 sketch — it adds a table
(`venue_rents` + its audit), an `events.rent_cents` column, two new resolvers, a venue-rent admin
surface, and changes the organizer report's rent/ongoing sourcing.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js LTS (24.x), strict mode (existing project).

**Primary Dependencies**: Next.js (App Router, RSC), Drizzle ORM, Zod, pino. Retrofits feature 009
(`series_parameters`, `resolveParameterCents`), feature 005 (`reportService`/Dance Net), and feature 007
(`venues`, `events.venue_id`, `PATCH /api/events/[id]`). No new external dependency.

**Storage**: PostgreSQL 16. New: `venue_rents` (venue_id, series_id **nullable**, amount_cents,
effective_date) + `venue_rent_audit`; new nullable `events.rent_cents`. `series_parameters` keeps the
`ongoing` kind (now resolved as a labeled sum) and **loses rent as an active config kind** (rent rows are
migrated to `events.rent_cents`, then deleted; the `rent` enum value is retained only so historical
`series_parameter_audit` rows stay valid — see research Decision 5). One migration
`0016_venue_rent_and_multi_ongoing.sql` (0015 is latest).

**Testing**: Vitest against real `zak1_test` (no mocking). New integration tests for the three-layer
rent resolver, the labeled-ongoing sum, and the migration-freeze. Existing organizer-report tests seed
rent via `series_parameters` (expense/rent) — their `seedRent` helper must move to `events.rent_cents` /
`venue_rents`, not be left incidentally green.

**Target Platform**: Linux server (Node). Admin surfaces: a **new** venue-rent admin, the events admin
gains a per-event rent override field, and the expense-parameters page becomes **ongoing-only**.

**Performance Goals**: None specified; single-club scale. The report already resolves rent/ongoing per
event; this keeps that (two small indexed lookups for rent, one grouped lookup for ongoing).

**Constraints**: FR-007/SC-004 — existing events' resolved rent and Dance Net MUST be byte-identical
after migration; the freeze-onto-`events.rent_cents` backfill is the mechanism and the highest-risk part.
Effective-dated history stays immutable (FR-012): superseding never rewrites past rows.

**Scale/Scope**: Single tenant. Rent gains a table + a column + an audit table; ongoing resolution
changes shape; ~2 new API routes + 1 new admin page + edits to events/expense-parameter surfaces + report
resolver swaps + test updates. Production loads fresh at go-live, so the migration backfill only touches
seed/pre-go-live data.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Test-First (NON-NEGOTIABLE)**: PASS — every new behavior is integration-tested against real
  Postgres before implementation: three-layer rent precedence, per-event override/clear, no-venue → 0,
  labeled-ongoing sum, independent $0 ending, and a migration-freeze test asserting each pre-existing
  event resolves its identical prior rent. Existing report/expense-parameter tests are updated to the new
  rent/ongoing sourcing, not bypassed.
- **II. Simplicity / YAGNI**: PASS — the added structure is required by the clarified spec, not
  speculative: rent's resolution dimension genuinely changed from series to venue (so it earns its own
  table), and multiple concurrent ongoing charges are an explicit, clarified requirement. Rent is *not*
  forced to stay in `series_parameters` where it no longer fits, and ongoing is *not* split into a new
  table when a labeled sum over the existing one suffices. No speculative per-event rent history table
  (a single nullable column covers the override), and per-individual performer pay stays unbuilt.
- **III. Type Safety**: PASS — strict TS; `venue_rents.series_id` nullability encodes venue-default vs.
  series-at-venue; new Zod schemas validate venue-rent and (ongoing-only, label-required) expense inputs
  at the boundary; no undocumented `any`/`as`.
- **IV. Observability**: PASS, and keeps parity — venue-rent changes get a dedicated `venue_rent_audit`
  table mirroring `series_parameter_audit`; per-event rent overrides ride the existing `PATCH
  /api/events/[id]` audit path (like a booking's pay override, which has no separate audit table).

**Initial gate: PASS. No violations — Complexity Tracking left empty.** (The feature is sizeable but every
piece traces to a functional requirement; nothing is speculative.)

## Project Structure

### Documentation (this feature)

```text
specs/011-venue-scoped-rent/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── api-deltas.md
├── checklists/
│   └── requirements.md  # from /speckit-specify + /speckit-clarify
└── tasks.md             # /speckit-tasks (not created here)
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── (admin)/
│   │   ├── venue-rents/page.tsx          # NEW — set venue default + series-at-venue rents (effective-dated)
│   │   ├── events/page.tsx               # + per-event rent override field (set/clear)
│   │   └── expense-parameters/page.tsx   # now ONGOING-ONLY (multiple labeled charges); rent controls removed
│   ├── api/
│   │   ├── venue-rents/route.ts          # NEW — GET (list by venue) + POST (create a venue/series rent)
│   │   ├── events/[id]/route.ts          # PATCH extended to set/clear rentCents (per-event override)
│   │   └── expense-parameters/route.ts   # POST now ongoing-only, label required
│   └── dev/routes/page.tsx               # + /venue-rents UI row and /api/venue-rents endpoint
├── server/
│   ├── db/
│   │   ├── schema/
│   │   │   ├── venueRents.ts             # NEW — venue_rents + venue_rent_audit tables/types
│   │   │   ├── events.ts                 # + rent_cents (nullable integer)
│   │   │   └── index.ts                  # export the new schema module
│   │   └── migrations/
│   │       └── 0016_venue_rent_and_multi_ongoing.sql  # NEW — tables, events.rent_cents, freeze backfill, delete rent config rows
│   ├── domain/
│   │   └── parameters/
│   │       ├── rentService.ts            # NEW — resolveEventRentCents(...) (3-layer), createVenueRent(...)
│   │       └── seriesParameterService.ts # + resolveOngoingTotalCents(seriesId,onDate) (labeled sum); createExpenseParameter now ongoing-only
│   ├── domain/organizer/
│   │   └── reportService.ts              # rent → resolveEventRentCents(ev); ongoing → resolveOngoingTotalCents(...)
│   ├── domain/venues/
│   │   └── venueService.ts               # assignVenueToEvent extended to also set/clear events.rent_cents
│   └── validation/
│       ├── venueRents.ts                 # NEW — venueRentCreateSchema (venueId, seriesKey?, amount, effectiveDate)
│       ├── organizer.ts                  # expenseParameterCreateSchema → kind ongoing-only, label REQUIRED
│       └── venues.ts                     # event PATCH schema (assignVenueSchema) gains rentCents: number|null (set/clear)
└── tests/integration/                    # new rent/ongoing/migration tests; updated report + expense-param tests
```

**Structure Decision**: Continue the single Next.js project. Rent gets its own schema module
(`venueRents.ts`) and resolver (`domain/parameters/rentService.ts`) because it is no longer series-scoped;
ongoing stays in `seriesParameterService.ts` because it is still a `series_parameters` concern — the split
follows the data's actual shape rather than forcing both into one place. The per-event override is a
single nullable `events.rent_cents` column (no new table) reached through the existing event PATCH,
mirroring how a booking carries its own overridable pay. The organizer report keeps calling resolvers —
just different ones — so its structure is unchanged beyond two call-site swaps.

## Complexity Tracking

> No constitution violations — section intentionally empty. (Scope is large but each element maps to a
> functional requirement; see Constitution Check II.)
