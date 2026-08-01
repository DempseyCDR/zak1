# Data Model: Backfill existing mis-split contact names

**No schema change.** This feature is a one-time data `UPDATE` over existing columns — no new table or column.

## Entity: `contacts` (unchanged columns)

- `first_name` (not null), `last_name` (nullable), `display_name` (not null, derived), `name_normalized`
  (derived), `dedup_normalized` (derived). The repair moves data **within** the row: the full name in
  `first_name` is split into `first_name` + `last_name`. `display_name` / `name_normalized` / `dedup_normalized`
  are **not written**.

## The transform (migration 0028)

| | Target rows | Result |
|---|---|---|
| **Condition** | `last_name IS NULL` **AND** `btrim(first_name)` contains a space | corrected |
| **`first_name`** | — | everything before the **last** space (btrim'd) |
| **`last_name`** | — | the final word (btrim'd) |
| **`display_name` / `name_normalized` / `dedup_normalized`** | — | **unchanged** (already derive from the full name) |
| **all other fields / other rows** | — | **untouched** |

## Invariants preserved / established

- **Display/search/dedup unchanged**: a corrected contact's `display_name`, `name_normalized`, and
  `dedup_normalized` are byte-identical before and after (the structured "first last" reproduces the same full
  name the keys were built from).
- **No row count change**: `UPDATE` only — nothing inserted, deleted, or merged.
- **Idempotent**: the `last_name IS NULL` guard means a corrected row (now with a last name) is never matched
  again; re-running changes zero rows.
- **Correct rows immune**: contacts that already have a last name, and single-word contacts with no space
  (mononyms), do not match the condition and are never modified.
- **Everything else preserved**: emails, phone, membership, any `display_name_override`, `source`, review
  flags, and unrelated timestamps are untouched (not in the SET list).
