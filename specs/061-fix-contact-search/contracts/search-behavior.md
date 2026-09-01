# Contract: `searchContacts` Behavior (feature 061)

The interface is the behavior of the shared contact search. These assertions drive the integration tests.

## Matching

- **C1 — substring/prefix**: a query that is a substring of a contact's `name_normalized` matches.
  _"cat" → "Catherine Jones"._ (SC-001)
- **C2 — monotonic (primary)**: for needles `n` ⊂ `n'` (n is a prefix/substring extension), the primary
  result set for `n'` ⊆ the primary set for `n`. _`cath` ⊇ `cathe` ⊇ `cather`._ (SC-002)
- **C3 — by real first/last**: a contact with a display-name **override** is matched by their real
  first/last (via `dedup_normalized`). _override "DJ", real "David Jones" → "David"/"Jones" match._ (SC-003)
- **C4 — by email (prefix)**: a contact is matched by a prefix of one of their active/transition emails.
  _`dj@example` → the owner._ (SC-003)
- **C5 — fuzzy fallback**: when primary matches are sparse (`< FUZZY_FLOOR`), close trigram matches are
  appended, ranked **below** exact matches, and not otherwise. _"Catherine" may surface "Katherine" last._
- **C6 — exclusions**: merged contacts (`merged_into_id` set) never appear (unchanged).

## Result shape & truncation

- **C7 — return `{ items, truncated }`**: `items` are the matched summaries; `truncated` is `true` iff
  more than `limit` contacts matched. (FR-005 / SC-004)
- **C8 — ordering**: exact/prefix name matches first, other substrings next, fuzzy fallback last.

## Cross-surface invariants

- **C9 — read-only, per-surface unchanged**: no data or authorization change; the door route keeps its
  PII gating and `recordPiiDisclosure` over `items`; `/api/contacts` and `/api/attendance/search` keep
  their displayed fields. (FR-006 / SC-005)
- **C10 — performance**: 300ms p95 at ~1,300 contacts holds. (existing perf test)

## Verification mapping

| Contract | Verified by |
|---|---|
| C1, C2, C3, C4, C6, C7, C8 | `tests/integration/contacts.search.test.ts` (extend/update) |
| C5 | `contacts.search.test.ts` (thin-results fixture) |
| C9 | `door.checkin-search.test.ts` + `authz.pii.test.ts` (unchanged gating) |
| C10 | `contacts.search.test.ts` perf test (kept) |
| C7 truncation indicator (UI) | door + contacts surfaces; Browser preview (auth-gated — manual) |
