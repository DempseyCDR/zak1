# Implementation Plan: Remove the GL-Account-Per-Line Mapping

**Branch**: `039-drop-account-mapping` | **Date**: 2026-08-05 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/039-drop-account-mapping/spec.md`

## Summary

Delete the dead GL-account-code annotation end to end: the `account_mapping` table (dropped via a new
destructive migration `0032`, snapshot first), its accounts API route + Zod schema + `mappingKeyNotFound` error,
the `loadAccountMap`/`account()` machinery in `mappingService`/`reportService`, the `account` field on **every**
treasurer-report line (admission, anon categories, named receipts, performer payments + per-line, deposit, fees)
and the `TreasurerReport` type, the `/qbo-mapping` **"Accounts"** editor, and the seed/docs. **`series_qbo_map`
(customer + class), the report's `class`/`customer`, and `mapping_audit` are retained** — only the GL-account
column goes. No computed figure changes.

## Technical Context

**Language/Version**: TypeScript 5.7 (strictest flags)

**Primary Dependencies**: Drizzle + hand-authored SQL migrations; treasurer domain
(`mappingService.ts`, `reportService.ts`), the `/qbo-mapping` + `/treasurer` pages

**Storage**: PostgreSQL — **destructive** migration `0032_drop_account_mapping.sql`
(`DROP TABLE IF EXISTS account_mapping`, idempotent). Pre-migration snapshot `~/zak1_pre_0032.dump`.
`series_qbo_map` and `mapping_audit` are **not** touched.

**Testing**: Vitest against real Postgres — a **migration** test (table gone + idempotent, mirrors the `0031`
test) + report/page/mapping tests updated to assert **no `account`** on any line while `class`/`customer` and the
series editor remain; the account-route/schema tests are removed. Test-first.

**Target Platform**: Web (Next.js App Router) + Postgres

**Performance Goals**: N/A — a removal; the report does one fewer query (`loadAccountMap`) per event

**Constraints**: Money stays integer cents; no computed figure altered (FR-003); `series_qbo_map` + `mapping_audit`
retained (FR-007/FR-008); scope = P6-R7 only (the report **reshape** is P6-R8, separate)

**Scale/Scope**: 4 deletes, ~10 edits, 1 new migration, 1 new migration test. The `account` annotation touches
**every** report line, so `reportService`/the treasurer page are the widest edits

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Test-First (NON-NEGOTIABLE)** — PASS. The migration gets a clean RED→GREEN idempotency test. The report
  removal is codified by flipping the `.account` assertions to **no-`account`-property** assertions on the lines
  (RED against current) while keeping `class`/`customer` assertions; the `/qbo-mapping` page + mapping test lose
  their Accounts cases and keep the Series case (RED where they assert accounts). The account-route/schema tests
  are deleted.
- **II. Simplicity / YAGNI** — PASS. The whole GL-per-line annotation has no consumer (no calc, no export) — this
  is the YAGNI cleanup. Nothing added but the drop migration + its guard test.
- **III. Type Safety** — PASS. Removing `account` from the `TreasurerReport` line types, the Zod schema, and the
  `AccountMappingRow`/service surface tightens types; `tsc` flags every dangling reference (the completeness net).
- **IV. Observability** — PASS (N/A). Removing an authed endpoint + a display column; `mapping_audit` still
  records series-QBO edits (`qbo_mapping.updated` kind stays).

**Result**: All gates pass. Complexity Tracking empty.

## Project Structure

### Documentation (this feature)

```text
specs/039-drop-account-mapping/
├── plan.md · research.md · data-model.md · quickstart.md
├── contracts/removed-surface.md
├── checklists/requirements.md
└── tasks.md            # /speckit-tasks (NOT created here)
```

### Source Code (repository root)

```text
DELETE:
  src/app/api/qbo-mapping/accounts/[lineKey]/route.ts        # + the accounts folder
  # accountMappingPutSchema + AccountMappingPutInput in src/server/validation/treasurer.ts
  # errors.mappingKeyNotFound() in src/server/lib/apiError.ts (only that route used it)
  # accountMapping table def + AccountMappingRow type in src/server/db/schema/qboMapping.ts (KEEP seriesQboMap)

EDIT:
  src/server/domain/treasurer/mappingService.ts   # drop loadAccountMap, updateAccountMapping, the accounts half
                                                   #   of getMappingConfig (-> returns { series }); keep series bits
  src/server/domain/treasurer/reportService.ts     # drop loadAccountMap import, the account() helper, every
                                                   #   `account:` on report lines + the TreasurerReport account
                                                   #   fields; KEEP class (qboClass) + customer (gateCustomer)
  src/app/(admin)/treasurer/page.tsx               # drop the account <td>s/renders + the account type fields
  src/app/(admin)/qbo-mapping/page.tsx             # drop the Accounts section (Account type, accounts state,
                                                   #   saveAccount, the table); keep Series → gate customer/class
  src/app/api/qbo-mapping/route.ts                 # GET now returns { series } (getMappingConfig shape change)
  src/server/db/seed.ts                            # drop the account_mapping seed block (keep series_qbo_map seed)
  tests/integration/helpers/db.ts                  # drop the INSERT INTO account_mapping block AND account_mapping
                                                   #   from the resetDb TRUNCATE list (in the migration task)
  tests/integration/treasurer.mapping-audit.test.ts # drop the account GET/PUT cases + imports; keep series_qbo
  tests/integration/treasurer.report.test.ts       # replace the `.account` assertions with no-account-property +
                                                   #   keep class/customer
  tests/component/treasurer.page.test.tsx          # drop the account fields from the mock-report fixture
  docs/zak1_Help_Glossary.md                       # QBO mapping entry (drop the account-code half)

NEW:
  src/server/db/migrations/0032_drop_account_mapping.sql        # DROP TABLE IF EXISTS account_mapping
  tests/integration/migration.dropAccountMapping.test.ts        # table gone + idempotent (FIRST)
```

**Structure Decision**: Single Next.js + Postgres project. Type-driven removal: drop the `account` field from the
`TreasurerReport` line types and the service/schema, and let **tsc** surface every reader (admission, categories,
named receipts, performer payments + per-line, deposit, fees — plus the page `<td>`s). The table is removed by an
idempotent migration `0032` (never edit `0006`, which created it). **`series_qbo_map`, `mapping_audit`, and every
computed report figure are untouched** — the load-bearing boundary (FR-002/FR-007). The `resetDb` TRUNCATE-list
edit is folded into the migration task (the `0031`/`I1` lesson) to avoid a truncate-on-dropped-table error.

## Complexity Tracking

> No Constitution Check violations — table intentionally empty.
