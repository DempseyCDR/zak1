# Phase 1 Data Model: Remove the GL-Account-Per-Line Mapping

Removes one table and a display field from a type; adds nothing.

## Entity removed: `account_mapping`

The GL-account catalog being dropped (created by `0006`):

| Field | Type | Notes |
|-------|------|-------|
| `line_key` | text (pk) | report line-key (admission, rent, a performer type, deposit, fees, …) |
| `account_code` | text | QuickBooks GL account code |
| `account_name` | text | account name |
| `updated_at` | timestamptz | |

- **Removal**: `DROP TABLE IF EXISTS account_mapping` (`0032`), idempotent. Snapshot `~/zak1_pre_0032.dump` first.
- **Rows**: display-only; nothing computed or exported from them. (Feature 038 already removed the
  `non_dance_income` row.)

## Retained (unchanged): `series_qbo_map`, `mapping_audit`

- **`series_qbo_map`** (series → `gate_customer` + `qbo_class`) — the source of the report's `customer` + `class`.
  **Untouched.** Lives in the same schema file as `account_mapping`; only the `accountMapping` def +
  `AccountMappingRow` type are removed, `seriesQboMap` + `SeriesQboMapRow` stay.
- **`mapping_audit`** — records both account and series-QBO edits historically. Retained; series-QBO edits keep
  writing (`qbo_mapping.updated`, kind `series_qbo`); the account-edit path is gone. Old `account`-kind rows are
  inert history.

## Type / contract changes

- `TreasurerReport` loses the `account` field on **every** line type: `gateSalesSummary.lines[]`,
  `namedCustomerReceipts[]`, `performerPayments[]` (+ its `lines[]`), `deposit`, `fees`. **`class` and
  `customer` stay.**
- `getMappingConfig` returns `{ series }` (was `{ accounts, series }`).
- `accountMappingPutSchema` / `AccountMappingPutInput` and `errors.mappingKeyNotFound()` removed.

## Relationships

- `account_mapping` had no FK (keyed by `line_key` string); dropping it removes nothing referential. `events`,
  `series_qbo_map`, `mapping_audit`, and every treasurer table are untouched.
