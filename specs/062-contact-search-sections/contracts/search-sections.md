# Contract: Two-Section Search + Duplicates (feature 062)

The interface is (1) the query-scoped behavior of `getMergeSuggestions` / `/api/dedup/suggestions?q=`,
and (2) the two-section + focus behavior of the contacts maintenance surface. These drive the tests.

## Duplicates engine (query filter)

- **C1 — query-scoped**: `getMergeSuggestions(db, t, limit, q)` with `q` set returns **only** pairs where
  `a` or `b` matches `q` (name/dedup substring). A duplicate pair unrelated to `q` is excluded. (FR-003)
- **C2 — global when empty**: with `q` empty/absent, returns the roster-wide pairs (unchanged). (FR-003)
- **C3 — pairs, structured-name**: each result is a pair `{ a, b, similarity }` computed on
  `dedup_normalized`, so a display-name override does not hide a duplicate. (FR-003, FR-005)
- **C4 — route passthrough**: `GET /api/dedup/suggestions?q=<query>` forwards `q` to the engine; the GET
  stays `requires: "base"` (read). (FR-007-adjacent)

## Contacts surface (two sections + focus)

- **C5 — two sections**: the maintenance surface renders a **single-contacts** section (the `/api/contacts`
  matches, each opening a record) and a **potential-duplicates** section (the `/api/dedup/suggestions?q=`
  pairs). (FR-001, FR-002)
- **C6 — pair → merge**: selecting a candidate pair invokes the existing merge for that pair
  (`POST /api/dedup/merge { canonicalId, mergedId }`); no new merge logic. (FR-004, FR-009)
- **C7 — empty duplicates**: when the query yields no pairs, the duplicates section is absent or a clear
  empty state (no clutter). (FR-008)
- **C8 — empty query = global queue**: with the search box empty, the duplicates section shows the global
  dedup queue. (FR-003, clarified)
- **C9 — focus-to-search**: the search field is focused on load and regains focus after an action. (FR-006)
- **C10 — authority**: merge is gated by the existing `dedup.write`; a viewer without it sees the section
  review-only / hidden. (FR-009)

## Verification mapping

| Contract | Verified by |
|---|---|
| C1, C2, C3 | `tests/integration/dedup.suggestions.test.ts` (query filter + global) |
| C5, C7, C9 | `tests/component/contacts.page.test.tsx` (sections render; autofocus; empty state) |
| C6 | component test (selecting a pair calls `/api/dedup/merge`) + existing merge tests unchanged |
| C4, C8, C10 | route/behavior (C4 in the suggestions route; C8/C10 exercised via the component with a mocked empty-`q` fetch) |
