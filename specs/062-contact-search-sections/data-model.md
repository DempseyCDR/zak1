# Phase 1 Data Model: Contact Maintenance Search — Two Sections + Focus

**No database entities, schema, or migration.** Reads existing data via existing functions. The "model"
is the query-filter extension and the two response shapes the UI consumes.

## Data read (existing, unchanged)

| Source | Fields used | Index |
|---|---|---|
| `contacts` (single section) | matched summaries via `searchContacts` (feature 061) | `contacts_name_trgm`, `contacts_dedup_trgm` |
| `contacts` (duplicates section) | likely-duplicate pairs via `getMergeSuggestions` on `dedup_normalized` | `contacts_dedup_trgm` |
| `contact_emails` | active emails shown on a pair (existing engine output) | `contact_emails_contact` |

## Contract change — `getMergeSuggestions`

- **Before**: `getMergeSuggestions(db, threshold = 0.4, limit = 50) → MergeSuggestion[]` — **global**
  pairs `{ a, b, similarity }`.
- **After**: `getMergeSuggestions(db, threshold = 0.4, limit = 50, q?: string) → MergeSuggestion[]`.
  - `q` empty/absent → unchanged (global).
  - `q` set → only pairs where **`a` OR `b`** matches `q` (`name_normalized ILIKE '%q%'` OR
    `dedup_normalized ILIKE '%q%'`). `MergeSuggestion` shape is unchanged.

## The two UI sections (response shapes, not new entities)

- **Single contacts** — `GET /api/contacts?q=` → `{ items: ContactSummary[]; truncated }` (feature 061),
  rendered as the existing TriageList; each row opens the contact's record.
- **Potential duplicates** — `GET /api/dedup/suggestions?q=` → `{ pairs: MergeSuggestion[] }` (candidate pairs),
  rendered as pair rows; each pair merges via `POST /api/dedup/merge { canonicalId, mergedId }`.

## Validation / invariants

- **Hybrid** (FR-003): `q` present → query-scoped pairs; `q` empty → global queue.
- **Pairs** (FR-003): every duplicates entry is a two-contact pair; merge is that pair.
- **Structured-name detection** (FR-005): duplicates use `dedup_normalized` (first+last), so a display
  override can't mask a duplicate — unchanged from the existing engine.
- **No data change here** (FR-009): the merge is the existing `dedup.write` flow (audits `contact.merge`);
  search + suggestions reads are read-only.
- **Merged contacts** excluded (existing engine behavior).

## State transitions

None persisted by this feature. UI state only: the query, the two result lists, which contact is open,
and focus. The merge (existing flow) is the only mutation, and it is not new here.
