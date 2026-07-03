# Implementation Plan: Series-Scoped Rate & Expense Parameters

**Branch**: `009-series-parameters` | **Date**: 2026-07-03 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/009-series-parameters/spec.md`

## Summary

Consolidates two already-shipped, structurally-identical entities — `rateParameters` (feature 003:
Caller/Sound Tech pay, global, no `label`) and `seriesExpenseParameters` (feature 005: Rent/Ongoing,
per-series, with `label`) — into one `series_parameters` table where **every** parameter (rate or
expense) is scoped to a series. Adds a new `general` series for joint/cross-series events instead of
a nullable/global-fallback special case, and adds a `musician` rate kind (shared identically by Lead
Musician and Musician bookings) — closing a gap where those two roles have no standard rate today.
This is the prerequisite feature 008 (Band roster) needs for its per-series pay-default behavior.
Existing global Caller/Sound Tech rates are backfilled into every series so nothing changes for any
existing event on migration day; existing Rent/Ongoing behavior is untouched.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js LTS (24.x), strict mode (existing project)

**Primary Dependencies**: Next.js (App Router), Drizzle ORM, Zod, pino. Retrofits feature 003
(`rate_parameters`, `rate_parameter_audit`, `resolveRateCents`, `bookingService.ts`,
`performerRules.ts`) and consolidates feature 005 (`series_expense_parameters`,
`resolveExpenseCents`, `reportService.ts`). No new external dependency.

**Storage**: PostgreSQL 16. New: `series_parameters` + `series_parameter_audit` tables,
`parameter_category` (`rate`|`expense`) and `parameter_kind` (`caller`|`sound_tech`|`musician`|
`rent`|`ongoing`) enums. A new `general` series row. Dropped: `rate_parameters`,
`rate_parameter_audit`, `series_expense_parameters` tables and the `rate_kind`/`series_expense_kind`
enums, after a same-migration backfill.

**Testing**: Vitest; the resolver is a DB query (integration-tested against real `zak1_test`, no unit
tests — same pattern as today's `resolveRateCents`/`resolveExpenseCents`). Existing tests that
reference the old tables/functions must be updated, not just left passing incidentally.

**Target Platform**: Linux server (Node); two existing admin pages (`rate-parameters`,
`expense-parameters`) continue to exist, backed by the shared table.

**Performance Goals**: No explicit SC in spec; same tiny single-club scale as every other feature
here — not a design constraint.

**Constraints**: Migrating to series-scoping MUST NOT change what any existing series resolves
(FR-005/SC-002) — this is the highest-risk part of this feature and drives the backfill design.
No automatic fallback between series, including to/from `general` (FR-004's Assumption).

**Scale/Scope**: Single tenant, 4 series after migration (`tnc`, `ecd`, `community_dance`,
`general`), 5 parameter kinds, on-demand admin edits only (no scheduling).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Test-First (NON-NEGOTIABLE)**: PASS — the resolver and creation service are integration-tested
  against real Postgres (matching the existing, un-mocked pattern for `resolveRateCents`/
  `resolveExpenseCents`); every existing test that touches the old tables/functions is updated, not
  bypassed, so regressions in Caller/Sound Tech/Rent/Ongoing behavior are caught immediately.
- **II. Simplicity / YAGNI**: PASS — one table, one audit table, one resolver function
  (`resolveParameterCents`) replaces two structurally-identical entities and two near-duplicate
  resolvers; two Zod schemas and two API routes are kept only because they're genuinely different
  business rules (expense requires a series always; rate now does too, but the two are still
  validated/exposed separately to avoid a conditionally-required polymorphic schema). No new
  discriminated-union type gymnastics — `kind` is one flat enum, correctness enforced by which
  literal each call site passes, matching this codebase's existing level of type strictness elsewhere.
- **III. Type Safety**: PASS — strict TS; `parameter_category`/`parameter_kind` are real Postgres
  enums with matching Zod schemas at the API boundary; no undocumented `any`/`as`.
- **IV. Observability**: PASS, and *improves* on today — expense-parameter changes currently have no
  dedicated audit table (only the pino log); they gain the same durable, queryable audit trail
  (`series_parameter_audit`) that rate changes already have, closing that asymmetry.

**Initial gate: PASS. No violations — Complexity Tracking left empty.**

## Project Structure

### Documentation (this feature)

```text
specs/009-series-parameters/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
└── tasks.md   # /speckit-tasks (not created here)
```

### Source Code (repository root) — consolidates/retrofits existing files

```text
src/
├── app/
│   ├── (admin)/rate-parameters/page.tsx      # + series selector, "musician" kind, resolved-preview (parity with expense page)
│   ├── (admin)/expense-parameters/page.tsx    # unchanged
│   └── api/
│       ├── rate-parameters/route.ts           # POST/GET now series-scoped (seriesKey required)
│       └── expense-parameters/route.ts        # unchanged surface; import path updated
├── server/
│   ├── db/
│   │   ├── schema/
│   │   │   ├── seriesParameters.ts            # NEW — replaces rates.ts + seriesExpenseParameters.ts
│   │   │   └── enums.ts                       # rateKindEnum/RateKind removed (superseded)
│   │   └── migrations/
│   │       └── 0012_series_parameters.sql     # NEW — create tables/enums, seed `general` series, backfill, drop old tables/enums
│   ├── domain/
│   │   ├── parameters/
│   │   │   └── seriesParameterService.ts      # NEW — resolveParameterCents, createRateParameter, createExpenseParameter
│   │   ├── bookings/
│   │   │   ├── bookingService.ts              # resolveParameterCents call now passes event.seriesId
│   │   │   └── resolveRate.ts                 # DELETED — folded into seriesParameterService.ts
│   │   ├── organizer/
│   │   │   ├── reportService.ts               # resolveParameterCents calls (rent/ongoing) updated
│   │   │   └── expenseParameterService.ts     # DELETED — folded into seriesParameterService.ts
│   │   └── performers/
│   │       └── performerRules.ts              # lead_musician + musician gain rateKind: "musician"
│   └── validation/
│       ├── performers.ts                       # rateParameterCreateSchema: + seriesKey, kind + "musician"
│       └── organizer.ts                        # expenseParameterCreateSchema unchanged
└── (reuses series from feature 002; no schema change to events/series beyond the new `general` row)
```

**Structure Decision**: Continue the single Next.js project. The two entities being consolidated
live in different domain folders today (`domain/bookings` for rates, `domain/organizer` for
expenses) with no natural shared home — rather than force the new shared logic into either existing
folder, it gets a small new neutral folder, `domain/parameters/`, matching how this project already
gives cross-cutting concerns (`domain/gate/eventMoney.ts`, extracted from feature 004 for reuse by
005) their own home. `bookingService.ts` and `reportService.ts` keep calling a resolver — just from
the new shared location — so neither of those already-complex files needs restructuring beyond the
one call-site change each.

## Complexity Tracking

> No constitution violations — section intentionally empty.
