# Data Model: Dedup review shows phone + email (P5-R7)

**No schema change.** No table, column, index, or migration. This feature reads existing data
(`contacts.phone`, `contact_emails`) and adds it to a payload the page renders.

## Extended payload (not stored — a query result shape)

- **`MergeSuggestion`** (from `getMergeSuggestions`): per candidate `a` / `b`, the existing `{ id, displayName,
  membershipStatus }` gains:
  - **`phone: string | null`** — the contact's canonical phone (feature 032), or null.
  - **`emails: string[]`** — the contact's **active** email addresses (`contact_emails.status = 'active'`),
    login/primary first; empty array when none.

## Reused / unchanged

- **Contact** (`contacts`): `phone` (canonical), `display_name`, `membership_status`, `dedup_normalized` (the
  matching key — unchanged), `merged_into_id` (the merged filter — unchanged).
- **Contact email** (`contact_emails`): `email`, `status` (`active` / `transition` / `inactive`), `is_login`.
  Only `active` addresses are surfaced.

## Rules

- **Active emails only** (FR-003): `status = 'active'`; transition/inactive excluded. All active shown when a
  contact has more than one.
- **Matching unchanged** (FR-004): the pairs query's JOIN/WHERE/ORDER are untouched; only SELECT columns are
  added.
- **Display** (FR-002): phone via `formatPhone` (dashed US / country-coded non-US / raw passthrough); missing
  phone or email shows a clear indication.

No entities, relationships, validation rules, or state transitions are added.
