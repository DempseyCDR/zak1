---

description: "Task list for feature 038 — remove the non-dance-income capability"
---

# Tasks: Remove the Non-Dance Income Capability

**Input**: Design documents from `specs/038-drop-non-dance-income/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/removed-surface.md, quickstart.md

**Tests**: INCLUDED — the constitution (I. Test-First) is non-negotiable. For a removal, the migration gets a
true RED→GREEN cycle and the report/page removals are codified by "absent" assertions written first.

**Organization**: One user story (US1, P1) — the clean removal. Schema-destructive, so a snapshot precedes the
drop.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1 — the spec's single user story
- Every task names an exact file path

## Path Conventions

Single Next.js + Postgres project — `src/server/**`, `src/app/**`, `tests/**`, migrations in
`src/server/db/migrations/` (per plan.md).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Safety snapshot before the destructive drop.

- [ ] T001 Take the pre-migration snapshot: `set -a; . ./.env; set +a` then
  `pg_dump -Fc "$DATABASE_URL" -f ~/zak1_pre_0031.dump` (data-migration safety convention; FR-006).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: None — single story. Proceed to US1.

---

## Phase 3: User Story 1 - Remove the unused non-dance-income capability (Priority: P1) 🎯 MVP

**Goal**: The non-dance-income table, service, route, validation, treasurer-report section, and treasurer-page
form are gone; every other treasurer figure is unchanged; the suite is green with no dangling references.

**Independent Test**: The migration guard passes (table gone, idempotent); the assembled report has no
`nonDanceIncome` property; the treasurer page renders no "Non-Dance Income" section/form; `tsc` + full suite are
green.

### Tests for User Story 1 (write FIRST — must FAIL before the removals)

- [ ] T002 [P] [US1] Create `tests/integration/migration.dropNonDanceIncome.test.ts`: read + execute
  `src/server/db/migrations/0031_drop_non_dance_income.sql` against the migrated test DB; assert
  `non_dance_income` is absent from `information_schema.tables`; execute the SQL a **second** time and assert no
  error (idempotent). Confirm it FAILS (migration file missing).
- [ ] T003 [P] [US1] In `tests/integration/treasurer.report.test.ts`, add an assertion that the assembled
  `TreasurerReport` has **no** `nonDanceIncome` property (`expect(report).not.toHaveProperty("nonDanceIncome")` —
  runtime, type-independent). Confirm it FAILS (report still has the section).
- [ ] T004 [US1] In `tests/component/treasurer.page.test.tsx`, add an assertion that no "Non-Dance Income"
  heading/form is rendered (e.g. `queryByText(/Non-Dance Income/i)` is null). Confirm it FAILS. (The mock-report
  `nonDanceIncome` fixture field is dropped together with the type field in T008 to avoid a tsc excess-property
  error.)

### Implementation for User Story 1

- [ ] T005 [US1] Create `src/server/db/migrations/0031_drop_non_dance_income.sql` — `DROP TABLE IF EXISTS
  non_dance_income;` (drops the `non_dance_income_event` index with it; idempotent). Makes T002 pass. **In the
  same step** remove `non_dance_income` from the `resetDb` `TRUNCATE …` list in
  `tests/integration/helpers/db.ts` — once `0031` exists the test DB auto-drops the table on the next test run,
  so `resetDb` must NOT name it (else every subsequent test errors on a missing relation). Then apply:
  `pnpm run db:migrate` (zak1_dev; test DB auto-migrates).
- [ ] T006 [P] [US1] Delete `src/server/db/schema/nonDanceIncome.ts` and remove its `export *` line from
  `src/server/db/schema/index.ts`.
- [ ] T007 [P] [US1] Delete `src/server/domain/treasurer/nonDanceIncomeService.ts` and
  `src/app/api/events/[id]/non-dance-income/route.ts` (and the now-empty `non-dance-income` folder); remove
  `nonDanceIncomeCreateSchema` + `NonDanceIncomeCreateInput` from `src/server/validation/treasurer.ts`.
- [ ] T008 [US1] Edit `src/server/domain/treasurer/reportService.ts`: remove the `nonDanceIncome` import, the
  `ndiRows`/`ndiTotal` query, the `nonDanceIncome` section in the returned object (and its
  `account("non_dance_income")` lookup), and the `nonDanceIncome` field from the `TreasurerReport` type. Makes
  T003 pass; also drop the now-invalid `nonDanceIncome` fixture line in `tests/component/treasurer.page.test.tsx`.
- [ ] T009 [US1] Edit `src/app/(admin)/treasurer/page.tsx`: remove the "Non-Dance Income" section render, the
  add-entry `<form>` + `addNonDanceIncome` handler + its state, and the `nonDanceIncome` field from the page's
  local report type. Makes T004 pass.
- [ ] T010 [US1] Remove the seeded `('non_dance_income','4910',…)` `account_mapping` row from
  `tests/integration/helpers/db.ts` **and** `src/server/db/seed.ts` (the `resetDb` TRUNCATE-list removal is done
  in T005). Delete `tests/integration/treasurer.non-dance-income.test.ts`.
- [ ] T011 [US1] Remove the two non-dance-income entries from `docs/zak1_Help_Glossary.md`.

**Checkpoint**: capability fully removed; migration guard + report + page tests green; other figures unchanged.

---

## Phase 4: Polish & Cross-Cutting Concerns

- [ ] T012 Run the full local gate: `pnpm exec tsc --noEmit && pnpm run lint && pnpm exec vitest run` — all
  green. `tsc` proves **no dangling references** remain (SC-005); the full suite proves no other treasurer figure
  changed (SC-004).
- [ ] T013 (Optional) Manual check: sign in as Treasurer, open `/treasurer` for an event — confirm no
  "Non-Dance Income" section/form and every other section present. (Staff-only page; the automated tests are the
  primary proof.)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: the snapshot precedes the drop.
- **US1 (Phase 3)**: after the snapshot. The whole feature.
- **Polish (Phase 4)**: after US1.

### Within User Story 1

- Tests (T002/T003/T004) are written and made to FAIL before the removals.
- T005 (migration) makes T002 pass and must run before the schema deletion is meaningful.
- T008 (reportService) makes T003 pass; T009 (page) makes T004 pass.
- The type-field removal (T008) and the test fixture drop are coordinated so `tsc` stays consistent; the gate
  (T012) is the final completeness check.

### Parallel Opportunities

- **T002 / T003** are different test files → draftable together. **T006 / T007** are independent deletions →
  `[P]`. The report edit (T008) and page edit (T009) touch different files but each pairs with a test.

---

## Parallel Example

```bash
# The independent deletions can proceed together:
Task: "T006 delete schema/nonDanceIncome.ts + its index.ts export"
Task: "T007 delete service + api route + validation schema/type"
```

---

## Implementation Strategy

### MVP (User Story 1 — the whole feature)

1. Setup (T001 snapshot).
2. US1 tests RED (T002/T003/T004) → migration (T005) → deletions (T006/T007) → report/page edits (T008/T009) →
   seed/helper/glossary (T010/T011). GREEN.
3. Polish: full gate (T012) proves no dangling refs + no other figure changed.

---

## Notes

- **Schema-destructive**: snapshot first (T001), `DROP TABLE IF EXISTS` (idempotent). The project never edits old
  migrations — `0006` created the table; `0031` drops it.
- **account_mapping table stays** — only the `non_dance_income` seed row goes; a leftover row in a live DB is an
  inert orphan (FR-007), no data migration.
- The removal is type-driven — `tsc` enumerates every dangling reference, which is why T012's typecheck is the
  completeness guarantee.
- Ships as one atomic commit per repo convention.
