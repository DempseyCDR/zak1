---

description: "Task list for feature 039 — remove the GL-account-per-line mapping"
---

# Tasks: Remove the GL-Account-Per-Line Mapping

**Input**: Design documents from `specs/039-drop-account-mapping/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/removed-surface.md, quickstart.md

**Tests**: INCLUDED — the constitution (I. Test-First) is non-negotiable. The migration gets a true RED→GREEN
cycle and the report removal is codified by absence-assertions written first; the account-route/schema tests are
removed and the retained `series`/`class`/`customer` assertions kept.

**Organization**: One user story (US1, P1) — the clean removal. Schema-destructive; snapshot precedes the drop.
Mirrors 038's removal pattern (bigger — the `account` field is on every report line).

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
  `pg_dump -Fc "$DATABASE_URL" -f ~/zak1_pre_0032.dump` (data-migration safety convention; FR-006).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: None — single story. Proceed to US1.

---

## Phase 3: User Story 1 - Drop the dead GL-account annotation (Priority: P1) 🎯 MVP

**Goal**: The `account_mapping` table, its editor/route/schema, and the report's per-line GL-account column are
gone; **`series_qbo_map`, `mapping_audit`, `class`/`customer`, and every computed figure are unchanged**; the
suite is green with no dangling references.

**Independent Test**: Migration guard passes (table gone, idempotent); the report has no `account` on any line but
keeps `class`/`customer`; `GET /api/qbo-mapping` returns `{ series }`; the `/qbo-mapping` Series editor still
saves; `tsc` + full suite green.

### Tests for User Story 1 (write FIRST)

- [ ] T002 [P] [US1] Create `tests/integration/migration.dropAccountMapping.test.ts`: execute
  `src/server/db/migrations/0032_drop_account_mapping.sql`; assert `account_mapping` is absent from
  `information_schema.tables`; execute a **second** time and assert no error (idempotent). Confirm it FAILS
  (migration file missing). (Mirror `migration.dropNonDanceIncome.test.ts`.)
- [ ] T003 [P] [US1] In `tests/integration/treasurer.report.test.ts`, **replace** the `.account` value assertions
  (`adm.account`, `gc.account`, `mem.account`, `performerPayments[0].account`, `deposit.account`) with assertions
  that those lines have **no** `account` property. **Positively assert the retained boundary (FR-002):** add a
  `class` assertion on a report line (e.g. the admission gate line still has its `class`) alongside the existing
  `gateSalesSummary.customer` assertion — the report keeps class + customer, only the account column goes. Confirm
  the no-`account` assertions FAIL against current code.
- [ ] T004 [US1] In `tests/integration/treasurer.mapping-audit.test.ts`, remove the account cases and the
  `PUT_ACCOUNT` + `accountMapping` imports (they will not compile once the route/schema are deleted): the
  `"updates an account mapping…"` case **and** the `"404s for an unknown line key"` case (it exercises the deleted
  account route + `mappingKeyNotFound`). Change `"returns the seeded mapping"` to assert `GET /api/qbo-mapping`
  returns `{ series }` (no `accounts`). **Keep** the series-QBO case (edit + audit, line ~42). (Coordinated
  cleanup — passes once the deletions land.)
- [ ] T005 [US1] In `tests/component/treasurer.page.test.tsx`, remove the `account` fields from the mock-report
  fixture (`deposit`/`fees`, etc.) — coordinated with the `TreasurerReport` type-field removal in T010.

### Implementation for User Story 1

- [ ] T006 [US1] Create `src/server/db/migrations/0032_drop_account_mapping.sql` — `DROP TABLE IF EXISTS
  account_mapping;` (idempotent). Makes T002 pass. **In the same step** remove `account_mapping` from the
  `resetDb` `TRUNCATE …` list in `tests/integration/helpers/db.ts` (else the suite errors truncating a dropped
  table — the 038/I1 lesson). Then apply: `pnpm run db:migrate`.
- [ ] T007 [P] [US1] Delete `src/app/api/qbo-mapping/accounts/[lineKey]/route.ts` (and the empty `accounts`
  folder); remove `accountMappingPutSchema` + `AccountMappingPutInput` from `src/server/validation/treasurer.ts`;
  remove `errors.mappingKeyNotFound()` from `src/server/lib/apiError.ts` (only that route used it).
- [ ] T008 [P] [US1] In `src/server/db/schema/qboMapping.ts`, remove the `accountMapping` table def + the
  `AccountMappingRow` type. **KEEP** `seriesQboMap` + `SeriesQboMapRow` in the same file.
- [ ] T009 [US1] In `src/server/domain/treasurer/mappingService.ts`, drop `loadAccountMap`, `updateAccountMapping`,
  and the `accounts` half of `getMappingConfig` (so it returns `{ series }`); drop the `accountMapping` schema
  import. Keep `loadSeriesQbo`, `updateSeriesQbo`, and the `series` half.
- [ ] T010 [US1] In `src/server/domain/treasurer/reportService.ts`, drop the `loadAccountMap` import, the
  `account()` helper (+ `accountMap`), every `account:` field on report lines (admission, anon categories, named
  receipts, performer payments + per-line, deposit, fees), and the `account` fields on the `TreasurerReport`
  type. **KEEP** `class` (qboClass) and `customer` (gateCustomer). Makes T003 pass.
- [ ] T011 [US1] In `src/app/(admin)/treasurer/page.tsx`, remove the per-line GL-account `<th>`/`<td>`s and the
  `account` fields from the page's local report type. Keep the class (and gate customer) columns.
- [ ] T012 [US1] In `src/app/(admin)/qbo-mapping/page.tsx`, remove the **"Accounts"** section (the `Account`
  type, `accounts` state, `saveAccount`, the accounts table, and reading `data.accounts`); keep **"Series → gate
  customer / class"**; retitle the page to reflect series/customer/class only. Verify `src/app/api/qbo-mapping/
  route.ts` returns the new `{ series }` config shape (no change needed if it returns `getMappingConfig` as-is).
- [ ] T013 [US1] Remove the `account_mapping` seed block from `src/server/db/seed.ts` **and** the
  `INSERT INTO account_mapping …` block from `tests/integration/helpers/db.ts` (the TRUNCATE-list edit was done in
  T006). Keep the `series_qbo_map` seed.
- [ ] T014 [US1] Update `docs/zak1_Help_Glossary.md`: drop the GL-account-code half of the QBO-mapping entry
  (keep the series → gate customer / class description).

**Checkpoint**: annotation fully removed; migration/report/mapping/page tests green; series/class/customer +
every computed figure unchanged.

---

## Phase 4: Polish & Cross-Cutting Concerns

- [ ] T015 Run the full local gate: `pnpm exec tsc --noEmit && pnpm run lint && pnpm exec vitest run` — all
  green. `tsc` proves **no dangling references** (SC-005); the full suite proves no other figure changed (SC-002).
  ⚠️ If `tsc` reports a stale `.next/types/validator.ts` referencing the deleted accounts route (the 038 gotcha —
  route deleted under a running dev server), clear `.next/types` and recompile, then re-run `tsc`.
- [ ] T016 (Optional) Manual check: sign in as Treasurer — `/treasurer` (an event) shows class (+ gate customer)
  and amounts with **no** GL account code; `/qbo-mapping` has **no** Accounts editor and the Series editor still
  saves. (Staff-only pages; the automated tests are the primary proof.)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: the snapshot precedes the drop.
- **US1 (Phase 3)**: after the snapshot. The whole feature.
- **Polish (Phase 4)**: after US1.

### Within User Story 1

- Genuine fail-first: **T002** (migration) and **T003** (report no-`account`). **T004**/**T005** are coordinated
  cleanups (the account cases/fixtures must go with the route/type deletions).
- T006 (migration + resetDb) makes T002 pass. T010 (reportService) makes T003 pass. T007/T008 (route + schema
  deletions) must precede/accompany T004 so the mapping test compiles. T010's type-field drop pairs with T005/T011.
- The type-driven removal means `tsc` (T015) is the completeness check — it flags any missed `account` reader.

### Parallel Opportunities

- **T002 / T003** (different test files) draft together. **T007 / T008** (independent deletions) are `[P]`.
- Sequential: `reportService.ts` (T010), the two pages (T011/T012), `mappingService.ts` (T009), and any shared
  file (`db.ts`, `validation/treasurer.ts`).

---

## Parallel Example

```bash
# Independent deletions together:
Task: "T007 delete accounts route + validation schema/type + apiError.mappingKeyNotFound"
Task: "T008 remove accountMapping + AccountMappingRow from schema/qboMapping.ts (keep seriesQboMap)"
```

---

## Implementation Strategy

### MVP (User Story 1 — the whole feature)

1. Setup (T001 snapshot).
2. US1 tests RED (T002/T003) + coordinated cleanups (T004/T005) → migration (T006) → deletions (T007/T008) →
   service/report/page edits (T009–T012) → seed/helper/glossary (T013/T014). GREEN.
3. Polish: full gate (T015) proves no dangling refs + no other figure changed; optional manual (T016).

---

## Notes

- **Schema-destructive**: snapshot first (T001), `DROP TABLE IF EXISTS` (idempotent), resetDb TRUNCATE-list edit
  folded into the migration task (T006). The project never edits old migrations — `0006` created the table; `0032`
  drops it.
- **Load-bearing boundary**: `series_qbo_map` (customer + class) and `mapping_audit` STAY; the report keeps
  `class`/`customer` — only the GL-account column goes; **no computed figure changes** (the report reshape is a
  separate feature, P6-R8).
- The removal is type-driven — `tsc` enumerates every dangling `account` reference (T015 is the guarantee).
- Ships as one atomic commit per repo convention.
