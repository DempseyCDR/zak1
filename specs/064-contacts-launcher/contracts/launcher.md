# Contract: Contacts Page Launcher

Interfaces the launcher uses. Two endpoints are new, one gains a query param, one gains an auto-clear
rule; the dedup list/merge endpoints are reused unchanged. UI contract items describe the page's
observable behavior (validated by component tests).

## Endpoints

### GET /api/contacts?needsReview=1  *(existing route — param added)*

- **Requires**: `base`.
- **Returns**: `{ items: ContactSummary[], truncated: boolean }` — active, non-merged contacts with
  `needs_review = true`, bounded and ordered by last/first name. Without the param, the route behaves as
  today (text search / empty-query browse).

### GET /api/contacts/launcher-counts  *(new)*

- **Requires**: `base`.
- **Returns**: `{ needsReview: number, duplicates: number }` — the two totals for the task buttons.

### POST /api/contacts/[id]/reviewed  *(new)*

- **Requires**: `contact.write`.
- **Effect**: sets `needs_review = false` for the contact (manual override, FR-013); returns the updated
  contact.

### PATCH /api/contacts/[id]  *(existing — ONE rule added)*

- **Requires**: `contact.write`.
- **NEW rule**: on save, when the resulting record has contact data (a `phone`, or an active
  `contact_emails` row), the service clears `needs_review` (FR-012). Never re-flags. All other 063
  behavior unchanged.

### GET /api/dedup/suggestions  ·  POST /api/dedup/merge  *(reused, unchanged)*

- The duplicates view fetches suggestions (global, no `q`); typing fetches `?q=` (query-scoped). Merge is
  the existing `dedup.write` flow.

## Contract checks

| ID | Statement | Verified by |
|---|---|---|
| C1 | `GET /api/contacts?needsReview=1` returns only `needs_review=true` contacts (bounded), nothing unflagged | integration |
| C2 | `countNeedsReview` / the counts endpoint report the true total of needs-review contacts | integration |
| C3 | `countMergeSuggestions` / the counts endpoint report the true total of candidate pairs | integration |
| C4 | `GET /api/contacts/launcher-counts` returns `{ needsReview, duplicates }` for a signed-in reader | integration |
| C5 | `patchContact` on a flagged contact with a phone (or email) now present clears `needs_review` (FR-012) | integration |
| C6 | `patchContact` on a flagged contact still lacking email+phone leaves `needs_review` set | integration |
| C7 | `POST /api/contacts/:id/reviewed` clears `needs_review` even with no email/phone (FR-013) | integration |
| C8 | On mount the page shows only header + search + task buttons — no single-contact list, no duplicates list, no create form (FR-001) | component |
| C9 | On mount only the counts are fetched; the two review buttons render their counts (FR-002/FR-003) | component |
| C10 | Tapping **Review queue** shows the needs-review list; tapping a row opens the editor (FR-004) | component |
| C11 | Tapping **Review duplicates** shows the global pairs; merging removes a pair (FR-005) | component |
| C12 | Typing shows single results **and** query-scoped pairs; the views are mutually exclusive; clearing returns to the bare launcher (FR-006/FR-007) | component |
| C13 | **Add contact** opens the create form in a modal; submit creates + closes + refreshes; Cancel/Escape closes with no create (FR-008) | component |
| C14 | After a create / merge / mark-reviewed / auto-clearing save — from **any** view — the affected button count refreshes via the shared refresh (FR-009) | component |
| C15 | The editor shows **Mark reviewed** for a flagged contact; using it clears the flag and refreshes (FR-013) | component |
| C16 | After a contact is cleared (auto-clear or Mark reviewed), its row leaves the review-queue list, not just the count | component |
