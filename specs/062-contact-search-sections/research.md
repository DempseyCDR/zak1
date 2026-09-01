# Phase 0 Research: Contact Maintenance Search — Two Sections + Focus

The two clarifications (hybrid scope; candidate pairs) are settled in the spec. This records the reuse
decisions and the code facts they rest on (verified).

## Decision 1 — Extend `getMergeSuggestions` with an optional query filter (hybrid)

- **Decision**: Add `q?: string`. When present, keep only pairs where **a or b matches `q`** on
  `name_normalized` or `dedup_normalized` (`ILIKE '%q%'`); when absent/empty, the existing **global**
  result.
- **Rationale/Verified**: `getMergeSuggestions(db, threshold = 0.4, limit = 50)` today returns global
  `{ a, b, similarity }` pairs from a `contacts a JOIN contacts b` self-join on
  `a.dedup_normalized % b.dedup_normalized`. Adding `AND (a.name_normalized ILIKE … OR a.dedup_normalized
  ILIKE … OR b.…)` is a narrowing filter using the existing `contacts_name_trgm` / `contacts_dedup_trgm`
  indexes — cheap, no schema. This realizes the hybrid clarification (query → scoped; empty → global) in
  one place.
- **Alternatives**: a separate query-scoped function (rejected — duplicates the self-join); scoping in the
  route/UI (rejected — pushes SQL filtering into TS over an already-capped list, and can't see pairs
  dropped by the global `LIMIT 50`).

## Decision 2 — Reuse the existing suggestions + merge endpoints

- **Decision**: The contacts duplicates section fetches `/api/dedup/suggestions?q=<query>`; each pair
  merges via the existing `/api/dedup/merge`.
- **Rationale/Verified**: `/api/dedup/suggestions` GET is `requires: "base"` and already reads a
  `threshold` param — adding `?q=` is a one-line passthrough. `/api/dedup/merge` POST is
  `requires: "dedup.write"` and calls `mergeContacts` (which audits `contact.merge`). The
  `mailing_list_manager` holds `dedup.write`, so Mel can merge. No new endpoint or merge logic (FR-009).
- **Alternatives**: navigate to the `/dedup` page (rejected — loses "that specific pair"; `/dedup` shows
  the whole queue); a new per-pair merge endpoint (rejected — the existing one already merges a pair).

## Decision 3 — Candidate pairs render via the Triage pattern; merge inline

- **Decision**: The duplicates section renders each `MergeSuggestion` pair (A ↔ B, with the identifying
  fields the engine already returns — phone + active emails) using the 060 Triage-style rows, with a
  merge action per pair (keep-left / keep-right, as the `/dedup` page does) calling `/api/dedup/merge`.
- **Rationale**: "Selecting a candidate pair opens the merge of that specific pair" (clarified) is exactly
  the existing `/dedup` pair UI; reusing its shape keeps it consistent and avoids a navigation detour.
  Presentation + the existing endpoint — no new data logic.
- **Alternatives**: single-tap merge without a keep-which choice (rejected — merge direction matters;
  `mergeContacts(canonicalId, mergedId)` needs which survives).

## Decision 4 — Focus-to-search mirrors the check-in page

- **Decision**: Auto-focus the contacts search field on load and return focus after an action, via a
  `searchRef` + `focus()`.
- **Verified**: the door check-in page uses exactly this (`searchRef = useRef`, `searchRef.current?.focus()`
  on load and after check-in). Mirror it on the contacts page (M-R3).

## Decision 5 — Testing

- **Decision**: real-Postgres integration for the query filter (`dedup.suggestions.test.ts`): seed a
  duplicate pair matching `q` and an unrelated pair; assert `q` returns only the matching pair, empty `q`
  returns both. jsdom component test (`contacts.page.test.tsx`): both sections render; the search field is
  auto-focused. The merge routing reuses the existing, already-tested `/api/dedup/merge`.
