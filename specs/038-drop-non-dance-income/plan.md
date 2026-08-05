# Implementation Plan: Remove the Non-Dance Income Capability

**Branch**: `038-drop-non-dance-income` | **Date**: 2026-08-05 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/038-drop-non-dance-income/spec.md`

## Summary

Delete the unused non-dance-income capability end to end: the `non_dance_income` table (dropped via a new
destructive migration `0031`, snapshot first), its service, API route, Zod schema, the treasurer-report
`nonDanceIncome` section, and the treasurer-page entry form — plus the two docs entries and the seeded QBO
mapping row. The `account_mapping` **table stays** (only the `non_dance_income` line-item row goes; a leftover
row is harmless — FR-007). Every other treasurer figure is unchanged (the section was a standalone add-on).

## Technical Context

**Language/Version**: TypeScript 5.7 (strictest flags)

**Primary Dependencies**: Drizzle + hand-authored SQL migrations; existing treasurer domain
(`reportService.ts`) and page (`(admin)/treasurer/page.tsx`)

**Storage**: PostgreSQL — **destructive** migration `0031_drop_non_dance_income.sql`
(`DROP TABLE IF EXISTS non_dance_income` — drops the `non_dance_income_event` index with it). Idempotent
(`IF EXISTS`). Pre-migration snapshot `~/zak1_pre_0031.dump`.

**Testing**: Vitest against real Postgres — a **migration** test (reads+executes the `0031` SQL, asserts the
table is gone, safe to re-run) mirroring the 027/`0028` convention; plus updated report + treasurer-page tests
asserting the section/form are **absent**; the `treasurer.non-dance-income.test.ts` integration test is deleted.

**Target Platform**: Web (Next.js App Router) + Postgres

**Performance Goals**: N/A — a removal; the report does one fewer query per event

**Constraints**: Money stays integer cents; no other financial data altered (FR-005); `account_mapping` catalog
retained (FR-007); the removal is the whole change (scope = P6-R6 only)

**Scale/Scope**: 5 deletes, 6 edits, 1 new migration, 1 new migration test. Zero non-dance-income rows exist in
practice

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Test-First (NON-NEGOTIABLE)** — PASS. The migration gets a clean TDD cycle (idempotency/table-gone test
  written first → RED, migration file missing → GREEN). The report removal is codified by a runtime assertion
  that the returned report has **no** `nonDanceIncome` property (RED against current code → GREEN after removal);
  the treasurer-page removal by asserting the "Non-Dance Income" section/form is **absent** (RED now → GREEN
  after removal). The obsolete `treasurer.non-dance-income.test.ts` is deleted. Removal is codified by tests, not
  left to inspection.
- **II. Simplicity / YAGNI** — PASS. This *is* the YAGNI cleanup — three years, zero entries. Nothing is added
  except the drop migration + its guard test.
- **III. Type Safety** — PASS. Removing the `nonDanceIncome` field from `TreasurerReport`, the Zod schema, and
  the service tightens types; the compiler flags every dangling reference (the safety net for a clean removal).
- **IV. Observability** — PASS (N/A). Removing an authed endpoint + a report section; no new logging surface.

**Result**: All gates pass. Complexity Tracking empty.

## Project Structure

### Documentation (this feature)

```text
specs/038-drop-non-dance-income/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── removed-surface.md  # Phase 1 output — what interfaces are removed
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks (NOT created here)
```

### Source Code (repository root)

```text
DELETE:
  src/server/db/schema/nonDanceIncome.ts        # table def (+ its `export *` in schema/index.ts)
  src/server/domain/treasurer/nonDanceIncomeService.ts   # create/list
  src/app/api/events/[id]/non-dance-income/route.ts      # POST/GET route (+ the folder)
  tests/integration/treasurer.non-dance-income.test.ts   # obsolete
  # + nonDanceIncomeCreateSchema + NonDanceIncomeCreateInput in src/server/validation/treasurer.ts

EDIT:
  src/server/db/schema/index.ts                 # drop the nonDanceIncome export
  src/server/validation/treasurer.ts            # drop the NDI schema + type
  src/server/domain/treasurer/reportService.ts  # drop import, ndiRows query, nonDanceIncome section +
                                                #   account("non_dance_income"), and the TreasurerReport field
  src/app/(admin)/treasurer/page.tsx            # drop the add-form, addNonDanceIncome, section render, type field
  tests/component/treasurer.page.test.tsx       # drop the nonDanceIncome fixture + assert the section absent
  tests/integration/helpers/db.ts               # drop non_dance_income from resetDb TRUNCATE + the seeded
                                                #   ('non_dance_income','4910',…) account_mapping row
  src/server/db/seed.ts                         # drop the non_dance_income account_mapping seed row
  docs/zak1_Help_Glossary.md                    # drop the two non-dance-income entries

NEW:
  src/server/db/migrations/0031_drop_non_dance_income.sql   # DROP TABLE IF EXISTS non_dance_income
  tests/integration/migration.dropNonDanceIncome.test.ts    # reads+executes 0031: table gone + idempotent (FIRST)
```

**Structure Decision**: Single Next.js + Postgres project. The removal is driven top-down: drop the schema
export + Zod + service + route + page section, letting **tsc** surface every dangling reference (the type-safety
safety net). The table itself is removed by an additive, idempotent SQL migration `0031` (the project never
edits old migrations; `0006` created the table). `account_mapping` and every other treasurer figure are
untouched. Test order: the migration guard test and the report/page "absent" assertions go RED first, then the
removals turn them green.

## Complexity Tracking

> No Constitution Check violations — table intentionally empty.
