# Contract: Removed Surface (Non-Dance Income)

This feature **removes** interfaces. The contract is what ceases to exist and what provably stays the same.

## Removed HTTP surface

- `POST /api/events/[id]/non-dance-income` — created a non-dance-income line. **Removed** (route deleted). After
  removal there is no path that accepts a non-dance-income submission (FR-003).
- `GET /api/events/[id]/non-dance-income` — listed them. **Removed**.

## Removed domain surface

- `createNonDanceIncome`, `listNonDanceIncome` (`domain/treasurer/nonDanceIncomeService.ts`) — **removed**.
- `nonDanceIncomeCreateSchema` / `NonDanceIncomeCreateInput` (`validation/treasurer.ts`) — **removed**.
- `TreasurerReport.nonDanceIncome` — **removed** from the report type and the assembled report object.

## Removed UI surface

- The treasurer page's **"Non-Dance Income"** section and its **add-entry form** (`(admin)/treasurer/page.tsx`)
  — **removed**. No non-dance-income control renders (FR-001/FR-002).

## Unchanged (must be provably identical)

- Every other `TreasurerReport` field/section: gate sales, named-customer receipts, performer payments +
  reconciliation, deposit, fees (FR-004). The report simply runs one fewer query.
- The `account_mapping` **table** and all other line items (FR-007).
- All other stored financial data — money in cents, no figure altered (FR-005).

## Migration contract

- `0031_drop_non_dance_income.sql`: `DROP TABLE IF EXISTS non_dance_income` — idempotent (safe to re-run),
  drops the `non_dance_income_event` index with the table. Snapshot `~/zak1_pre_0031.dump` first.

## Test contract (codifies the removal)

- `tests/integration/migration.dropNonDanceIncome.test.ts`: after running `0031`, `non_dance_income` is absent
  from `information_schema.tables`; running `0031` twice does not error.
- `treasurer.report.test.ts`: the assembled report has **no** `nonDanceIncome` property.
- `treasurer.page.test.tsx`: the "Non-Dance Income" section/form is **not** rendered.
- `treasurer.non-dance-income.test.ts`: **deleted**.
