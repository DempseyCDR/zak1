# Phase 0 Research: Remove the GL-Account-Per-Line Mapping

The spec is unambiguous (drop the whole `account_mapping` catalog; retain `series_qbo_map` + `mapping_audit`). No
`NEEDS CLARIFICATION`. Mechanical decisions resolved below.

## R1 — Dropping the table (destructive, idempotent, snapshot-first)

- **Decision**: `src/server/db/migrations/0032_drop_account_mapping.sql`:
  `DROP TABLE IF EXISTS account_mapping;`. Snapshot `~/zak1_pre_0032.dump` before applying to `zak1_dev`
  (`zak1_test` auto-migrates). Fold the `account_mapping` removal from the `resetDb` TRUNCATE list into the same
  step so the suite never truncates a dropped table (the 038/I1 lesson).
- **Rationale**: Additive, never-edited migrations (`0006` created the table). `IF EXISTS` = idempotent (FR-006).
  Snapshot matches the data-migration safety convention (`0028`/`0030`/`0031`).
- **Alternatives considered**: editing `0006` (forbidden); keeping the table but hiding the column (leaves dead
  schema — not a real removal).

## R2 — Type-driven removal (the `account` field on every line)

- **Decision**: Remove the `account` field from every `TreasurerReport` line type (gate lines, named receipts,
  performer payments + per-line, deposit, fees), the `loadAccountMap` import, and the `account()` helper. Then let
  `tsc --noEmit` enumerate every remaining `account:` producer and every page `<td>` that reads it.
- **Rationale**: Constitution III — the compiler is the safety net. Because `account` is on the type, removing it
  turns every producer/consumer into a compile error, so none is missed. **`class`/`customer` are on different
  fields and are untouched.**
- **Alternatives considered**: grep-only removal (risks missing a transitive reader that the type checker catches).

## R3 — `getMappingConfig` shape + the QBO-mapping page/route

- **Decision**: `getMappingConfig` returns `{ series }` only (drop the `accounts` half; keep `series`). The route
  `GET /api/qbo-mapping` returns that. The `/qbo-mapping` page drops the **Accounts** section (its `Account` type,
  `accounts` state, `saveAccount`, and the table) and keeps **"Series → gate customer / class"**; retitle the page
  to reflect it is now series/customer/class only.
- **Rationale**: FR-004/FR-005 — no GL-account editor remains; the series editor stays and still saves. The
  accounts route (`/api/qbo-mapping/accounts/[lineKey]`) and its Zod schema + `mappingKeyNotFound` error are
  deleted (only that route used them).
- **Alternatives considered**: leaving an empty Accounts section (pointless); a redirect (no value).

## R4 — Testing the removal (test-first)

- **Decision**:
  1. **Migration guard** (`tests/integration/migration.dropAccountMapping.test.ts`): execute `0032`, assert
     `account_mapping` absent from `information_schema.tables`, re-run (idempotent). Written first (RED — missing).
  2. **Report** (`treasurer.report.test.ts`): replace the `adm.account`/`gc.account`/`mem.account`/
     `performerPayments[0].account`/`deposit.account` value assertions with **no-`account`-property** assertions on
     those lines, and keep the `class`/`customer` assertions. RED against current → GREEN after removal.
  3. **Mapping** (`treasurer.mapping-audit.test.ts`): drop the account GET/PUT cases + the `PUT_ACCOUNT`/
     `accountMapping` imports; keep the series-QBO case (and its audit assertion). The config test asserts
     `body.series` (no `body.accounts`).
  4. **Page** (`treasurer.page.test.tsx`): drop the `account` fields from the mock-report fixture (coordinated
     with the type-field removal).
- **Rationale**: The migration is a true TDD cycle; the report/page/mapping removals are codified by
  absence-assertions while the retained `class`/`customer`/series behaviour keeps its assertions — proving the
  boundary (FR-002/FR-007) held.
- **Alternatives considered**: delete-and-hope (fails Constitution I — the boundary wouldn't be codified).

## R5 — `mapping_audit` retained

- **Decision**: Keep the `mapping_audit` table and the `series_qbo` write path (`qbo_mapping.updated` audit kind).
  Only the account-edit write path is gone (its route is deleted). Historical `account`-kind audit rows remain as
  inert history.
- **Rationale**: FR-008 — series/customer/class edits are still audited; the table is shared. Removing it would
  break the retained series editor's audit trail.
- **Alternatives considered**: dropping `mapping_audit` (breaks the retained series audit — out of scope, wrong).

## R6 — `resetDb` truncate list + seed

- **Decision**: Remove `account_mapping` from the `resetDb` `TRUNCATE …` list (with the migration, R1) and delete
  the `INSERT INTO account_mapping …` block in the test helper + the `account_mapping` seed block in `seed.ts`.
  Keep the `series_qbo_map` seed.
- **Rationale**: After `0032` drops the table, truncating/seeding it errors; the Drizzle schema no longer defines
  it. `series_qbo_map` seeding is unaffected.
- **Alternatives considered**: none — required for the suite/seed to run.
