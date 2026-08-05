# Contract: Removed Surface (GL Account Mapping)

This feature **removes** interfaces. The contract is what ceases to exist and what provably stays.

## Removed HTTP surface

- `PUT /api/qbo-mapping/accounts/[lineKey]` — edited a GL account mapping. **Removed** (route deleted). No path
  accepts a GL account-mapping edit afterward (FR-005).
- `GET /api/qbo-mapping` — **changed**: returns `{ series }` only (no `accounts`). The `POST/PUT` series route
  (`/api/qbo-mapping/series/[seriesId]`) is **unchanged**.

## Removed domain / type surface

- `loadAccountMap`, `updateAccountMapping`, and the `accounts` half of `getMappingConfig`
  (`domain/treasurer/mappingService.ts`) — **removed** (series functions kept).
- `accountMappingPutSchema` / `AccountMappingPutInput` (`validation/treasurer.ts`) — **removed**.
- `errors.mappingKeyNotFound()` (`lib/apiError.ts`) — **removed** (only the deleted route used it).
- `accountMapping` table def + `AccountMappingRow` type (`schema/qboMapping.ts`) — **removed**;
  `seriesQboMap` + `SeriesQboMapRow` **kept**.
- `TreasurerReport` — the `account` field is **removed** from every line (gate lines, named receipts, performer
  payments + per-line, deposit, fees); `class` + `customer` **kept**.

## Removed UI surface

- The `/qbo-mapping` **"Accounts"** editor (`(admin)/qbo-mapping/page.tsx`) — **removed**. The **"Series → gate
  customer / class"** editor is **kept** and still saves (FR-004).
- The treasurer report's per-line **GL account code** column (`(admin)/treasurer/page.tsx`) — **removed**; class
  (and gate customer) columns **kept** (FR-001/FR-002).

## Unchanged (must be provably identical)

- Every **computed** report figure — gate amounts, named receipts, performer payments + reconciliation, deposit,
  fees totals (FR-003). The report simply runs one fewer query and shows one fewer column.
- `series_qbo_map` (customer + class) and `mapping_audit` (series-QBO edits still recorded) — FR-007/FR-008.
- All other stored financial data — money in cents, no figure altered (FR-009).

## Migration contract

- `0032_drop_account_mapping.sql`: `DROP TABLE IF EXISTS account_mapping` — idempotent. Snapshot
  `~/zak1_pre_0032.dump` first.

## Test contract (codifies the removal)

- `migration.dropAccountMapping.test.ts`: after `0032`, `account_mapping` absent from `information_schema.tables`;
  re-running does not error.
- `treasurer.report.test.ts`: report lines have **no** `account` property; `class`/`customer` present.
- `treasurer.mapping-audit.test.ts`: no account GET/PUT; series-QBO edit still returns + audits.
- `treasurer.page.test.tsx`: no GL-account column rendered.
