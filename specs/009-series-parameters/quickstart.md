# Quickstart & Validation: Series-Scoped Rate & Expense Parameters

End-to-end validation guide. Implementation details live in `tasks.md`. Retrofits features 003/005;
prerequisite for feature 008.

## Prerequisites

- Features 001–008 (spec-only for 008) applied; Postgres running, with the existing dev DB already
  seeded from earlier sessions (has pre-existing `rate_parameters`/`series_expense_parameters` rows —
  this matters for the migration-safety scenario below).
- `pnpm install`; `.env` with `DATABASE_URL` / `TEST_DATABASE_URL`

## Setup

```bash
pnpm db:migrate     # applies 0012_series_parameters.sql (tables/enums, `general` series, backfill, drops old tables/enums)
pnpm db:seed        # re-seeds sample series-scoped rates (caller/sound_tech/musician) per series
```

## Run

```bash
pnpm dev
# /rate-parameters      — set standard Caller/Sound Tech/Musician rates, now per series, with a resolved-preview
# /expense-parameters   — set rent/ongoing per series (unchanged UI)
```

## Validation scenarios

Map to acceptance scenarios in [spec.md](spec.md); contracts in [contracts/api.md](contracts/api.md).

1. **Series-scoped rate isolation** (US1): set a Caller rate for series A, a different one for
   series B; book a Caller on an event in each and confirm each resolves its own series' rate
   (FR-002/FR-003, SC-001).
2. **Existing expense behavior unchanged** (US2): generate an Organizer Report for a series with
   Rent/Ongoing set before this migration; confirm the resolved figures are identical to before
   (FR-007, SC-002).
3. **Musician rate default** (US3): with no Musician rate set for a series, book a Musician — pay
   defaults to $0/manual entry. Set a Musician rate for that series; book another Musician — pay
   defaults to the rate, overridable (FR-006, SC-003).
4. **General series, no fallback** (US4): assign an event to the `general` series; set a rate scoped
   to `general` and confirm that event resolves it. Separately, confirm a rate set for series A does
   **not** apply to an event in the `general` series (FR-004, edge case).
5. **Migration safety on real (already-seeded) data** — manual, not an automated test: before
   running the `0012` migration, record the currently-resolved Caller and Sound Tech rate for each
   existing series (via the dev DB or the old endpoints) for a few representative dates. Run the
   migration. Re-resolve the same (series, kind, date) combinations via the new endpoint/resolver
   and confirm they're byte-identical to the pre-migration values (FR-005, SC-002). This is the
   highest-risk part of this feature and must be checked against the actual dev DB, not just a fresh
   test schema (a fresh `zak1_test` run of the migration has nothing to backfill from, so this
   specific check only means something against already-populated data).
6. **Audit parity** (FR-008): create a rate parameter and an expense parameter; confirm both produce
   a `series_parameter_audit` row (previously only rate did), each with `actor` populated
   (SC-005).
7. **Superseding never rewrites history** (FR-010): set a rate effective 2026-01-01, book a
   performer on an event dated 2026-02-01, then set a new rate for the same series/kind effective
   2026-06-01; confirm the already-created booking's `payCents` is untouched.

## Test commands

```bash
pnpm test:unit          # none new — the resolver is DB-backed, matching today's pattern
pnpm test:integration   # resolveParameterCents (per category/kind/series), creation routes, migration-adjacent booking/report tests — real Postgres
pnpm typecheck && pnpm lint
```

Expected: all green; every existing rate/expense-adjacent test (booking defaults, organizer report
rent/ongoing, rate/expense audit) updated to the new table/service and still passing; no regression
in resolved figures for any existing series.
