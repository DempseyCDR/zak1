# Research: Contacts Page Launcher (M-R4 alteration)

Phase 0 decisions. All spec clarifications were resolved in `/speckit-clarify`; no `NEEDS
CLARIFICATION` remain. Notes record the load-bearing choices and the existing code they build on.

## D1 — needs-review list: filter on the existing contacts route

- **Decision**: Add a `needsReview` filter. `GET /api/contacts?needsReview=1` dispatches to a new
  `listNeedsReview(db, limit)` that returns the bounded `{ items, truncated }` shape (same
  `ContactSummary` + `withTruncation` as search), ordered like the empty-query browse (last/first name).
- **Rationale**: reuses the route, the summary shape, `TriageList`, and the 063 editor as the open
  target — the review queue is just "contacts filtered by a flag." `needs_review` has no query path today
  (set on import/door-create, never read), so this is the new surface.
- **Alternatives**: a dedicated `/api/contacts/needs-review` route (more surface for no gain); adding the
  filter to `searchContacts` itself (it's called by check-in/attendance — keep it untouched; a separate
  `listNeedsReview` avoids risk).

## D2 — the two launcher counts: one endpoint

- **Decision**: `GET /api/contacts/launcher-counts` → `{ needsReview, duplicates }`, composing
  `countNeedsReview(db)` (contacts domain) and `countMergeSuggestions(db, threshold)` (dedup domain).
- **Rationale**: FR-002 wants counts (not lists) on load in the fewest round trips; one endpoint at the
  route layer composing two domain counts is the least chatty and keeps domains separate. The counts are
  bounded queries (a `COUNT` on the flag; a `COUNT` over the dedup self-join at the same threshold as the
  list) — cheap at this scale (the 062 perf test held ~300ms p95 at 1,300 contacts).
- **Alternatives**: two separate count endpoints (an extra round trip); returning a total alongside the
  bounded lists (the lists aren't fetched on load, so counts must stand alone).

## D3 — needs_review auto-clear on save (FR-012)

- **Decision**: In `patchContact`, compute `hasContactInfo` = the resulting phone is present **or** the
  contact has an active email row; when true, set `needs_review = false`. Never re-flags (only clears).
- **Rationale**: mirrors the create predicate (`needsReview = !email && !phone`) — the flag existed
  because contact data was missing, so acquiring it lifts the flag. `patchContact` already recomputes
  derived fields on save; this is one more. Phone is on the row; email presence is a small existence
  check on `contact_emails`.
- **Note**: a door-created contact flagged despite having a phone will auto-clear on its next save once
  the predicate is satisfied; anything that should be dismissed without data uses D4.
- **Alternatives**: a DB trigger (opaque, harder to test); clearing only via an explicit action (leaves
  fixed-up contacts stuck in the queue).

## D4 — Mark reviewed (FR-013): a dedicated action endpoint

- **Decision**: `POST /api/contacts/[id]/reviewed` (`requires: contact.write`) calls `markReviewed(db,
  id)` → sets `needs_review = false` and returns the contact. The 063 editor shows a **Mark reviewed**
  button when the open contact is flagged; it calls this, then refreshes the count/view.
- **Rationale**: single-purpose and clearly named, cleaner than overloading `contactPatchSchema` with a
  control flag; easy to test in isolation; gated by the capability Mel already holds.
- **Alternatives**: a `markReviewed` boolean on the PATCH body (mixes a command into a field patch); a
  bulk endpoint (no stated need — one at a time).

## D5 — duplicates view + merge: reuse 062 unchanged

- **Decision**: The **Review duplicates** view fetches the existing `GET /api/dedup/suggestions` with no
  query (global queue) and merges via the existing `POST /api/dedup/merge`. Typing keeps the 062 hybrid
  (single results + query-scoped pairs from the same endpoint with `?q=`).
- **Rationale**: the detection + merge flow is done and tested (033/062); 064 only changes *when* the
  pairs are surfaced (behind a button and alongside search), not how.

## D6 — launcher view model + create modal

- **Decision**: `page.tsx` holds a `view` state — `none | search | review | duplicates`. `none` renders
  only header + search + task buttons (+counts). Typing sets `search`; clearing with no active task
  returns to `none`. Task buttons set `review` / `duplicates`. **Add contact** opens the create form in
  a modal reusing the 063 `.backdrop`/`.modalPanel` overlay; the existing create form moves into it with
  an `onCreated` callback that closes the modal and refreshes results + counts.
- **Rationale**: one exclusive `view` keeps the screen from stacking lists (FR-007) and makes each task
  one tap / first keystroke (SC-002). Reusing 063's overlay avoids a new modal system (YAGNI); no shared
  cross-screen create-modal abstraction yet (deferred Feature B).
