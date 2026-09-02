# Data Model: Contacts Page Launcher (M-R4 alteration)

**No schema change, no migration.** Everything below uses existing columns/tables. This documents how
each participates in the launcher.

## Entity: Contact (`contacts`)

### `needs_review` (boolean, existing) — now queryable and clearable

| Concern | Behavior |
|---|---|
| Set (today) | `true` on import / door-create, and on create when a contact has **no email and no phone** (`createContact`: `needsReview = !email && !phone`). Unchanged. |
| **Query** (new) | `listNeedsReview(db, limit)` returns active, non-merged contacts with `needs_review = true`, bounded (`{ items, truncated }`), ordered by last/first name. `countNeedsReview(db)` returns the total. |
| **Auto-clear** (new, FR-012) | `patchContact` sets `needs_review = false` when the saved record has contact data — the resulting `phone` is present **or** an active `contact_emails` row exists. Only ever clears, never re-flags. |
| **Manual clear** (new, FR-013) | `markReviewed(db, id)` sets `needs_review = false` regardless of data. |

Read-only elsewhere: the flag is still shown read-only in the 063 record editor (M-R8); the editor adds
a **Mark reviewed** control that calls the clear action.

### Reached-by (no new fields)

- **Search match** — `searchContacts(db, q)` (unchanged).
- **Needs-review flag** — `listNeedsReview` (new query above).
- **Duplicate pair member** — the dedup engine (unchanged).

## Entity: Duplicate pair (existing dedup engine)

| Concern | Behavior |
|---|---|
| List (global) | `getMergeSuggestions(db, threshold)` with no query — unchanged, backs the Review-duplicates view. |
| List (query-scoped) | `getMergeSuggestions(db, threshold, limit, q)` — unchanged, the typing hybrid. |
| **Count** (new) | `countMergeSuggestions(db, threshold)` — total candidate pairs at the same threshold as the list. |
| Merge | `POST /api/dedup/merge` — unchanged. |

## Launcher counts (derived, not stored)

`GET /api/contacts/launcher-counts` → `{ needsReview: number, duplicates: number }`, composed from
`countNeedsReview` + `countMergeSuggestions`. Fetched on load (no lists). Refreshed after any action that
changes a total: creating a contact, saving a fix that auto-clears review, Mark reviewed, or a merge.

## View state (client, not persisted)

`view ∈ { none, search, review, duplicates }` — mutually exclusive (FR-007):

```text
none  ──type──────────────▶ search      (clear box, no task) ──▶ none
none  ──tap Review queue──▶ review
none  ──tap Review dups───▶ duplicates
(any) ──tap a task button─▶ that task's view
Add contact ─────────────▶ create modal (over the current view); onCreated → refresh + close
```

## Authorization (unchanged)

| Capability | Held by | Role here |
|---|---|---|
| `base` | any staff | read the launcher, counts, lists, search |
| `contact.write` | mailing_list_manager (global), door_attendant, super_user | create a contact; Mark reviewed; the auto-clear rides the existing PATCH (`contact.write`) |
| `dedup.write` | mailing_list_manager (global), super_user | merge a duplicate pair (unchanged) |
