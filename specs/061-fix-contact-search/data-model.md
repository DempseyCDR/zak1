# Phase 1 Data Model: Fix Contact Search

**No database entities, schema, or migration.** This is a query/matching change over existing data. The
"model" here is the `searchContacts` contract change and the matching rules.

## Data read (existing, unchanged)

| Source | Fields used | Index |
|---|---|---|
| `contacts` | `name_normalized`, `dedup_normalized`, `merged_into_id`, summary cols (`id`, `display_name`, `membership_status`, `list_member`, `pronouns`) | `contacts_name_trgm`, `contacts_dedup_trgm` (GIN trigram) |
| `contact_emails` | `email` (`lower(trim())`), `contact_id`, `status` | `contact_emails` functional unique on `lower(trim(email))` (prefix) |

## Contract change — `searchContacts`

- **Before**: `searchContacts(db, q, limit?, opts?) → ContactSummary[]` — matches `name_normalized %
  needle` only (trigram); empty `q` browses.
- **After**: `searchContacts(db, q, limit?, opts?) → { items: ContactSummary[]; truncated: boolean }`.
  - **items**: contacts (non-merged) matched by, in priority order:
    1. **primary** — `name_normalized ILIKE %needle%` **OR** `dedup_normalized ILIKE %needle%` **OR**
       `EXISTS` active/transition email with `lower(trim(email)) LIKE needle||'%'`;
    2. **fallback** — only if primary count `< FUZZY_FLOOR` (small, e.g. 5): trigram `name_normalized %
       needle` matches not already in primary, appended, ranked below.
  - **truncated**: `true` when more than `limit` contacts matched (query `limit + 1`).
  - Empty `q` → the existing browse (recent/name), with the same `{ items, truncated }` shape.

## Ordering (validation rules from requirements)

- Exact/prefix name matches before other substring matches; fuzzy fallback always **last** (FR-004).
- **Monotonic (FR-002)**: for a growing needle, the **primary** result set is a subset of the shorter
  needle's primary set (guaranteed by substring semantics; the fuzzy tail is secondary and excluded from
  the monotonic guarantee).
- **Excluded**: `merged_into_id IS NOT NULL` (as today).

## State transitions

None. Read-only; no persisted state. `truncated` is derived per query.
