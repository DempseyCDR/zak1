# Phase 1 Data Model: Remove the Non-Dance Income Capability

This feature **removes** data structures; it adds none. Net schema change: one table dropped.

## Entity removed: `non_dance_income`

The table being dropped (created by migration `0006`). For the record, its shape was:

| Field | Type | Notes |
|-------|------|-------|
| `id` | uuid (pk) | |
| `event_id` | uuid → `events.id` (cascade) | indexed (`non_dance_income_event`) |
| `description` | text | free-text line description |
| `amount_cents` | integer | money in cents |
| `entry_date` | date | when booked |
| `created_at` | timestamptz | |

- **Removal**: `DROP TABLE IF EXISTS non_dance_income` (migration `0031`) — takes the index with it. Idempotent.
- **Rows in practice**: zero (three years). Snapshot `~/zak1_pre_0031.dump` taken before dropping.

## Retained (unchanged): `account_mapping`

- The `account_mapping` **table stays** — many other QBO line items use it. Only the seeded
  `('non_dance_income','4910','Other Miscellaneous Revenue')` **row** is removed from the seed + test helper.
- An existing `non_dance_income` mapping row in a live DB becomes an inert orphan (nothing reads it once the
  report section is gone). No data migration deletes it (FR-007).

## Type / contract changes

- `TreasurerReport` loses its `nonDanceIncome: { account, lines, total }` field — every other field is
  unchanged. `NonDanceIncomeCreateInput` + `nonDanceIncomeCreateSchema` are removed.
- No new type or table is introduced.

## Relationships

- The dropped table's only relationship was `event_id → events.id`; dropping it removes that FK. `events` and
  every other treasurer table are untouched.
