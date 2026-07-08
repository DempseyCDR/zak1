# Phase 1 Contracts: API Deltas

No new endpoints or routes (dev route index unchanged). The contact create/patch request bodies change
shape; two read surfaces change behavior.

## `POST /api/contacts` — create (CHANGED body)

```jsonc
// Before
{ "displayName": "Robert Frost", "email": {...}, "phone": "..." }
// After
{ "firstName": "Robert", "lastName": "Frost", "displayNameOverride": "Bob Frost",
  "pronouns": "he/him", "email": {...}, "phone": "..." }
```

- `firstName` **required**; `lastName`, `displayNameOverride`, `pronouns` optional; email/phone unchanged.
- Response contact includes `displayName` (effective), `firstName`, `lastName`, `displayNameOverride`,
  `pronouns`. `displayName` = override ?? trimmed "first last" (just first when last blank).
- Acceptance: FR-001..FR-005.

## `PATCH /api/contacts/[id]` — edit (CHANGED body)

```jsonc
{ "firstName": "Robert" }          // recomputes display_name / normalized keys
{ "lastName": null }               // clears last name → display becomes first only
{ "displayNameOverride": "Bob" }   // sets override; { "displayNameOverride": null } clears it
{ "pronouns": "they/them" }
```

- Any name-field change recomputes the effective `display_name`, `name_normalized`, `dedup_normalized`.
  Editing first/last does **not** disturb an existing override (FR-004).
- Acceptance: FR-003, FR-004, FR-005.

## `GET /api/dedup/suggestions` — behavior change (same shape)

- Now ranks pairs by pg_trgm similarity on **`dedup_normalized`** (structured first+last), not the
  display name. Two contacts with the same first+last surface as a suggestion even if one has a different
  `displayNameOverride`. Response shape (a/b/similarity) unchanged.
- Acceptance: FR-006, SC-006.

## `GET /api/attendance/search` (check-in roster) — behavior change

- Roster is orderable by **last name, then first name**; member-button label remains the effective
  `display_name`. (Exact query-param/sort surface is a plan/impl detail.)
- Acceptance: FR-007, FR-008, SC-002.

## `GET /api/exports/[listId]` — behavior change (same CSV columns)

- First Name / Last Name columns are sourced from `contacts.first_name` / `last_name` (not a split of the
  display name). Blank last name → empty Last Name cell. Column set unchanged.
- Acceptance: FR-009, SC-003.

## Unchanged (regression guardrails)

- **Contact search** (`GET /api/contacts?q=`): still matches the **effective display name**
  (`name_normalized`) — a contact is found by its shown name/override (FR-006, SC-006).
- Every surface that displays a contact name (reports, bookings, exports, member buttons) keeps reading
  `display_name` (now the effective value) — no change (FR-008, FR-010, SC-005).
