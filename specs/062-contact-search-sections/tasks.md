# Tasks: Contact Maintenance Search — Two Sections + Focus

**Feature**: 062-contact-search-sections | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

**Scope**: extend `getMergeSuggestions` with an optional `q` filter (+ `?q=` on its route), grow the 060
contacts page into two sections (single contacts + candidate-duplicate pairs), and add focus-to-search.
**Reuse** the existing suggestions + merge endpoints. **No schema / migration / new merge logic.**
**Test-First.**

⚠️ The suggestions route returns `{ pairs }` (not `{ items }`) — the duplicates section reads `.pairs`.
Merge is the existing `POST /api/dedup/merge { canonicalId, mergedId }` (`dedup.write`, which Mel holds).

---

## Phase 1: Setup

- [X] T001 Establish a green baseline: `pnpm vitest run tests/integration/dedup.suggestions.test.ts tests/component/contacts.page.test.tsx && pnpm tsc --noEmit` — all pass before any change.

## Phase 2: Foundational

None — the query filter is part of US1's duplicates section; no separate shared prerequisite. Proceed.

## Phase 3: User Story 1 — Two-section search results (Priority: P1) 🎯 MVP

**Goal**: single-contacts section + a potential-duplicates section of candidate pairs (hybrid: query-scoped with a query, global when empty), each routing to the existing merge.

**Independent test**: a query returns matching single contacts in one section and its duplicate pairs in another; selecting a pair merges it; no-dup query → empty duplicates section.

- [X] T002 [P] [US1] In `tests/integration/dedup.suggestions.test.ts`, add failing cases: `getMergeSuggestions(db, threshold, limit, q)` with `q` returns **only** pairs where a member matches `q` (C1); with empty `q` returns the global set (C2); a duplicate hidden by a display-name override is still paired (C3). Run; watch fail.
- [X] T003 [US1] Add an optional `q?: string` to `getMergeSuggestions` in `src/server/domain/dedup/suggestionService.ts`: when set, add `AND (a.name_normalized ILIKE '%'||q||'%' OR a.dedup_normalized ILIKE … OR b.name_normalized ILIKE … OR b.dedup_normalized ILIKE …)`; empty/absent = unchanged global. Make T002 pass. (depends: T002)
- [X] T004 [US1] In `src/app/api/dedup/suggestions/route.ts`, read `?q=` and pass it to `getMergeSuggestions(db, threshold, undefined, q)` (GET stays `requires: "base"`; response stays `{ pairs }`). (depends: T003)
- [X] T005 [P] [US1] In `tests/component/contacts.page.test.tsx`, add failing cases (mock `fetch` for both `/api/contacts` and `/api/dedup/suggestions`): both sections render — single contacts + duplicate **pairs** (C5); a no-pairs response → the duplicates section is empty/absent (C7); clicking a pair's merge action issues `POST /api/dedup/merge` with the chosen `{ canonicalId, mergedId }` (C6). Run; watch fail.
- [X] T006 [US1] In `src/app/(admin)/contacts/page.tsx`, add the **potential-duplicates** section: fetch `/api/dedup/suggestions?q=<q>` (read `.pairs`), render each pair (A ↔ B with the engine's phone/email fields) as Triage-style rows with keep-left / keep-right merge actions calling `/api/dedup/merge`; show an empty state when there are no pairs. Add styles to `src/app/(admin)/contacts/contacts.module.css`. Make T005 pass. (depends: T004, T005)

**Checkpoint**: US1 MVP — search is both a lookup and a duplicate-cleanup surface.

## Phase 4: User Story 2 — Focus-to-search (Priority: P2)

**Goal**: the search field is ready on load and regains focus after an action (the check-in pattern).

**Independent test**: on mount the search field is focused; after an action focus returns to it.

- [X] T007 [US2] In `tests/component/contacts.page.test.tsx`, add a failing case: on mount the search input has focus (C9). Run; watch fail.
- [X] T008 [US2] In `src/app/(admin)/contacts/page.tsx`, add a `searchRef` + auto-focus on load and refocus after an action (mirror `(door)/checkin/page.tsx`). Make T007 pass. (depends: T006 — same file)

**Checkpoint**: US2 — fast, mouse-free repetitive maintenance.

## Phase 5: Polish & Cross-Cutting

- [X] T009 Regression + typecheck: `pnpm vitest run tests/component tests/integration/dedup.suggestions.test.ts tests/integration/authz.pii.test.ts && pnpm tsc --noEmit` — all green (merge flow + PII gating unchanged). (depends: T006, T008)
- [X] T010 [P] Prettier/ESLint on changed files only (`suggestionService.ts`, `dedup/suggestions/route.ts`, `contacts/page.tsx`, `contacts.module.css`, `dedup.suggestions.test.ts`, `contacts.page.test.tsx`).
- [~] T011 Browser (auth-gated, manual) — **PENDING**: signed in at `/contacts`, confirm the two sections, pair → merge, empty-box → global queue, and focus-on-load. `/contacts` is `requireStaff`-gated (no dev bypass) → manual pass with a session. The behavior is covered by the integration + component tests; only the live visual confirmation remains.

_Impl notes: the query filter and the two-section UI + focus landed test-first (query-filter red before T003; C5/C6/C9 red before T006/T008). One incidental fix — the integration test file gained a **second `describe`**, so its DB lifecycle hooks were hoisted to file level (a single `closeDb` for the shared pool)._

---

## Dependencies

- **Setup (T001)** → stories.
- **US1**: T002 (test) → T003 (engine) → T004 (route); T005 (component test) → T006 (UI; needs T004 + T005).
- **US2**: T007 (test) → T008 (focus; edits the contacts page after T006 — same file).
- **Same-file sequential**: `contacts/page.tsx` (T006 → T008) and `contacts.page.test.tsx` (T005 → T007).
- **Polish**: T009 after impl; T010 after the edits it formats; T011 manual last.
- **Story independence**: US1 is a viable MVP (two sections). US2 (focus) layers on and is independently testable.

## Parallel execution examples

- **T002** (integration test) ∥ **T005** (component test) — different files, no dependency between the test-writing.
- **T010** (lint) is `[P]`.
- Sequential: the engine→route chain (T003→T004) and the two edits to `contacts/page.tsx` (T006→T008).

## Implementation strategy

MVP = **US1** (two-section results): the query filter on the dedup engine + the duplicates section that
merges pairs via the existing flow — search becomes lookup **and** cleanup. **US2** adds focus-to-search.
Everything reuses existing endpoints and 060 patterns; no schema or merge logic changes.
