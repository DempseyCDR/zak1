# Phase 0 Research: Fix Contact Search

No `[NEEDS CLARIFICATION]` in the spec. This records the matching decisions and the code facts they rest
on (verified against the tree).

## Decision 1 — Substring/prefix is the primary matcher (monotonic)

- **Decision**: The primary match is `ILIKE '%needle%'` over the contact's normalized name keys — which
  **narrows monotonically** (a longer needle yields a subset).
- **Rationale/Verified**: Today `searchContacts` matches only `name_normalized % needle` (pg_trgm, 0.3
  threshold) — non-monotonic and length-biased ("cat" ≈ 0.19 vs "catherine jones" → no match). Substring
  is what incremental typing expects, and the **GIN trigram index accelerates `ILIKE`** for needles ≥3
  chars (`contacts_name_trgm`); 1–2-char needles fall back to a scan, fine at this roster size.
- **Alternatives**: lower the similarity threshold (rejected — still non-monotonic, length-biased);
  `word_similarity`/`<%` (rejected — still fuzzy, more complexity than substring).

## Decision 2 — Match name ∪ dedup ∪ email; email by PREFIX

- **Decision**: Match `name_normalized` **OR** `dedup_normalized` **OR** an `EXISTS` on the contact's
  active/transition emails by **prefix** (`lower(trim(email)) LIKE needle || '%'`).
- **Rationale/Verified**: `dedup_normalized` is `normalize("first last")` (ignores the display override),
  so it's exactly how to find someone by real first/last when their display name is pinned;
  `contacts_dedup_trgm` accelerates it. Email prefix uses the existing `contact_emails` functional index
  on `lower(trim(email))` — **no new index**. The US2 scenario types a prefix (`dj@example`), so prefix
  suffices.
- **Deferred (YAGNI)**: infix email (`%example%`) would need a trigram index on email — out of scope; the
  scenario and common use (typing the local-part) are prefix.

## Decision 3 — Fuzzy is a thin-results fallback, ranked below

- **Decision**: If the primary (substring) result count is below a small floor (e.g. < 5), append trigram
  matches (`name_normalized % needle`) **not already present**, ranked after the exact set.
- **Rationale**: Preserves typo tolerance (Katherine/Catherine) without polluting the common case. The
  **monotonic guarantee (SC-002) applies to the primary set**; the fuzzy tail is explicitly secondary
  "did you mean" and is only reached when exact results are sparse — the SC-002 test asserts the primary
  results narrow monotonically.
- **Alternatives**: always-on fuzzy (rejected — reintroduces the non-monotonic wobble).

## Decision 4 — Return `{ items, truncated }`; expose + surface truncation

- **Decision**: Query `limit + 1`; `truncated = fetched > limit`; return `{ items, truncated }`. The two
  API routes include `truncated`; the door and contacts surfaces render a "more matches — refine"
  indicator.
- **Rationale**: FR-005 forbids silent incompleteness. `limit + 1` is the cheapest truncation signal (no
  second count query). Full pagination is deferred (search now narrows predictably, so refining reaches
  the target).
- **Verified call sites**: server `searchContacts` is called by `src/app/api/attendance/search/route.ts`
  and `src/app/api/contacts/route.ts` only; the `/api/contacts` GET returns `{ items, total }` today →
  becomes `{ items, truncated }` (drop or keep `total` as needed). Client typeahead pickers read `.items`
  and are unaffected.

## Decision 5 — Keep the 300ms p95 @ ~1,300 contacts target

- **Decision**: The rewritten query must still pass the existing perf test.
- **Verified**: `tests/integration/contacts.search.test.ts` asserts "meets the 300ms p95 target at ~1,300
  contacts." Substring over GIN + an `EXISTS` email prefix at ~1,300 rows is well within budget; the plan
  keeps the test and re-verifies.

## Decision 6 — Empty-query browse unchanged at the search layer

- **Decision**: Leave the empty-`q` browse (recent / name-ordered, `LIMIT`) as-is; FR-008's "sensible
  empty state" is a per-surface presentation choice, not a search-layer change.
- **Rationale**: Minimal, YAGNI. The door already browses name-ordered (useful roster); the contacts
  surface can present a "type to search" affordance in its own feature if desired — no core change here.
