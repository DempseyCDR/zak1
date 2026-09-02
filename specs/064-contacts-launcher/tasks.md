# Tasks: Contacts Page Launcher (M-R4 alteration)

**Feature**: 064-contacts-launcher | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

**Scope**: replace the eager contacts page with an uncluttered launcher (header + search + task buttons
with counts); load a list only on a tap or the first keystroke; three mutually-exclusive views (search,
review queue, duplicates); the create form moves into a modal. **New backend** is query-shaped: a
needs-review filter + count, a duplicate-pair count, and two ways `needs_review` clears (auto on save
when contact data is present, and a manual **Mark reviewed**). **Reuse** `searchContacts`, the dedup
suggestions/merge endpoints, and the 063 modal overlay + record editor. **No schema, no migration, no new
capability.** **Test-First** (constitution I).

Contract checks C1–C15 live in [contracts/launcher.md](./contracts/launcher.md).

Note: `page.tsx` and `tests/component/contacts.page.test.tsx` are edited across US1–US5 (one file each →
sequential); the two integration test files are independent and `[P]`.

---

## Phase 1: Setup

- [X] T001 Establish a green baseline: `pnpm vitest run tests/component/contacts.page.test.tsx tests/integration/contacts.search.test.ts tests/integration/dedup.suggestions.test.ts && pnpm tsc --noEmit` — all pass before any change.

## Phase 2: Foundational

None — US1 delivers the launcher shell (view model + counts) that the other stories layer onto. Proceed.

## Phase 3: User Story 1 — Uncluttered launcher with counts (Priority: P1) 🎯 MVP

**Goal**: on load show only header + search + task-button row (Add contact / Review queue (n) / Review
duplicates (n)); fetch only the two counts, no lists.

**Independent test**: load the page with seeded needs-review contacts + duplicate pairs; confirm no lists
render, the three buttons show, and the two review buttons show correct counts.

- [X] T002 [P] [US1] In `tests/integration/contacts.launcherCounts.test.ts` (new; file-level DB hooks), add failing cases: `countNeedsReview(db)` and `countMergeSuggestions(db)` return correct totals; `GET /api/contacts/launcher-counts` returns `{ needsReview, duplicates }` for a signed-in reader (C2/C3/C4). Run; watch fail.
- [X] T003 [US1] Add `countNeedsReview(db)` to `src/server/domain/contacts/contactService.ts` and `countMergeSuggestions(db, threshold)` to `src/server/domain/dedup/suggestionService.ts` (C2/C3). (depends: T002)
- [X] T004 [US1] Add `GET /api/contacts/launcher-counts` in `src/app/api/contacts/launcher-counts/route.ts` (`requires: base`) composing both counts → `{ needsReview, duplicates }` (C4). Make T002 pass. (depends: T003)
- [X] T005 [P] [US1] In `tests/component/contacts.page.test.tsx`, add failing cases (mock `fetch`): on mount only the header, search box, and three task buttons render — no single-contact list, no duplicates list, no create form (C8); only the counts are fetched and the two review buttons render their counts (C9). Run; watch fail.
- [X] T006 [US1] In `src/app/(admin)/contacts/page.tsx`, remove the mount auto-load (`search("")`); add a `view` state (`none | search | review | duplicates`) defaulting to `none`; render the task-button row (Add contact / Review queue (n) / Review duplicates (n)); add a **shared `refreshCounts()`** that re-fetches `/api/contacts/launcher-counts` and updates the button counts, called on mount; in `view === none` render only header + search + buttons (hide the always-visible create form). Add task-button styles to `src/app/(admin)/contacts/contacts.module.css`. Make T005 pass. (depends: T004, T005)
  - **Count-refresh is centralized (F1)**: every mutating action — an editor save (incl. an auto-clearing `needs_review`), a Mark reviewed, a pair merge (from **either** the search view or the duplicates view), and a create — MUST call the shared `refreshCounts()` so the launcher counts stay correct regardless of which view initiated it. The per-story tasks below wire their action to it.

**Checkpoint**: US1 MVP — the uncluttered launcher with live counts.

## Phase 4: User Story 2 — Review queue + clears (Priority: P1)

**Goal**: Review queue lists the `needs_review` contacts; opening + fixing (email/phone present) auto-
clears the flag; **Mark reviewed** clears it manually; counts update.

**Independent test**: seed flagged + unflagged contacts; tap Review queue → only flagged appear; save one
with a phone → it leaves the queue; Mark reviewed another → it leaves.

- [X] T007 [P] [US2] In `tests/integration/contacts.needsReview.test.ts` (new; file-level DB hooks), add failing cases: `GET /api/contacts?needsReview=1` returns only `needs_review=true` contacts, bounded (C1); `patchContact` on a flagged contact now having a phone/email clears the flag (C5) and without it leaves it set (C6); `POST /api/contacts/:id/reviewed` clears the flag with no email/phone (C7). Run; watch fail.
- [X] T008 [US2] In `src/server/domain/contacts/contactService.ts`: add `listNeedsReview(db, limit)` (active, non-merged, `needs_review=true`, bounded like search); make `patchContact` clear `needs_review` when the saved record has a phone or an active `contact_emails` row (never re-flags); add `markReviewed(db, id)` setting it false. Make the service parts of T007 pass. (depends: T007)
- [X] T009 [US2] In `src/app/api/contacts/route.ts` handle `?needsReview=1` → `listNeedsReview`; add `POST /api/contacts/[id]/reviewed` in `src/app/api/contacts/[id]/reviewed/route.ts` (`requires: contact.write`) → `markReviewed`. Make T007 pass. (depends: T008)
- [X] T010 [US2] In `tests/component/contacts.page.test.tsx`, add failing cases: tapping **Review queue** shows the needs-review list and a row opens the 063 editor (C10); the editor shows **Mark reviewed** for a flagged contact and using it clears the flag and refreshes the count (C15 + C14 part); **after clearing (Mark reviewed or an auto-clearing save), the contact's row leaves the review-queue list, not just the count (F2)**. Run; watch fail. (same file — sequential)
- [X] T011 [US2] In `src/app/(admin)/contacts/page.tsx`, add the review-queue view (fetch `?needsReview=1`, render via `TriageList`, row → `openRecord`); add a **Mark reviewed** button to the record editor (shown when the contact is flagged) calling `POST …/reviewed`; after Mark reviewed OR an auto-clearing editor save, call the shared `refreshCounts()` (F1) **and** re-fetch the review-queue list so the cleared contact leaves it (F2). Make T010 pass. (depends: T006, T009, T010 — same file)

**Checkpoint**: US2 — the review queue is a real, self-emptying worklist.

## Phase 5: User Story 3 — Resolve duplicates view (Priority: P1)

**Goal**: Review duplicates shows the global pairs; merging removes a pair and drops the count.

**Independent test**: seed pairs; tap Review duplicates → global list; merge one → it leaves and the count
decreases.

- [X] T012 [US3] In `tests/component/contacts.page.test.tsx`, add a failing case: tapping **Review duplicates** shows the global candidate pairs, and merging a pair removes it from the list and decrements the duplicates count (C11 + C14 part). Run; watch fail. (same file — sequential)
- [X] T013 [US3] In `src/app/(admin)/contacts/page.tsx`, add the duplicates view (fetch `GET /api/dedup/suggestions` with no `q`, render pairs with keep-left/keep-right merge via the existing `POST /api/dedup/merge`). Route the merge through the shared merge handler so it calls `refreshCounts()` (F1) and re-fetches the current view's pairs after a merge. Make T012 pass. (depends: T006, T012 — same file)

**Checkpoint**: US3 — the global duplicates queue is a dedicated view.

## Phase 6: User Story 4 — Find/open by typing (Priority: P1)

**Goal**: typing shows single-contact results **and** query-scoped duplicate pairs (062 hybrid); views are
mutually exclusive; clearing the box with no active task returns to the bare launcher.

**Independent test**: type a query → matching contacts + any query-scoped pair appear; tap a contact →
editor; clear the box → bare launcher.

- [X] T014 [US4] In `tests/component/contacts.page.test.tsx`, add failing cases: typing shows the single-contact results together with the query-scoped duplicate pairs; the search view replaces any task view (mutual exclusivity); clearing the search box with no active task returns to only header + search + buttons (C12). Run; watch fail. (same file — sequential)
- [X] T015 [US4] In `src/app/(admin)/contacts/page.tsx`, wire the search view: on a non-empty query fetch single results + query-scoped `/api/dedup/suggestions?q=` and set `view = search`; a tap on a result opens the editor and a tap on a pair merges (retain 062) **via the shared merge handler, so a search-view merge also calls `refreshCounts()`** (F1); clearing the query with no active task sets `view = none`. Make T014 pass. (depends: T006, T014 — same file)

**Checkpoint**: US4 — the implicit single-contact task, with the near-duplicate heads-up.

## Phase 7: User Story 5 — Add contact from a modal (Priority: P2)

**Goal**: **Add contact** opens the create form in a modal; submit creates + closes + refreshes; Cancel/
Escape closes with no create.

**Independent test**: tap Add contact → modal create form; submit valid → modal closes and page refreshes;
Cancel → no create.

- [X] T016 [US5] In `tests/component/contacts.page.test.tsx`, add failing cases: tapping **Add contact** opens the create form in a `role="dialog"` modal; submitting a valid contact issues the create POST, closes the modal, and refreshes; Cancel/Escape closes it with no POST (C13 + C14 part). Run; watch fail. (same file — sequential)
- [X] T017 [US5] In `src/app/(admin)/contacts/page.tsx`, move the existing create form into a modal (reuse the 063 `.backdrop`/`.modalPanel` overlay + a `role="dialog"` panel); the **Add contact** button opens it; an `onCreated` handler closes the modal, re-runs the active search, and calls the shared `refreshCounts()` (F1 — a new no-contact-info contact raises the needs-review count). Make T016 pass. (depends: T006, T016 — same file)

**Checkpoint**: US5 — adding a contact no longer clutters the launcher.

## Phase 8: Polish & Cross-Cutting

- [X] T018 Regression + typecheck: `pnpm vitest run tests/component tests/integration/contacts.needsReview.test.ts tests/integration/contacts.launcherCounts.test.ts tests/integration/contacts.search.test.ts tests/integration/dedup.suggestions.test.ts tests/integration/dedup.merge.test.ts tests/integration/contacts.volunteer.test.ts tests/integration/authz.pii.test.ts && pnpm tsc --noEmit` — all green (search, dedup/merge, 063 editor, PII unchanged). (depends: T011, T013, T015, T017)
- [X] T019 [P] Prettier/ESLint on changed files only (`contacts/page.tsx`, `contacts.module.css`, `contacts/route.ts`, `contacts/launcher-counts/route.ts`, `contacts/[id]/reviewed/route.ts`, `contactService.ts`, `suggestionService.ts`, `contacts.needsReview.test.ts`, `contacts.launcherCounts.test.ts`, `contacts.page.test.tsx`).
- [~] T020 Browser (auth-gated, manual) — signed in at `/contacts`: confirm the bare launcher + counts; Review queue → fix/Mark-reviewed empties it; Review duplicates → merge drops the count; typing shows results + query-scoped pairs and clearing returns to the launcher; Add contact modal creates + refreshes. `/contacts` is `requireStaff`-gated (no dev bypass); behavior is covered by the integration + component tests, so only the live visual confirmation remains.

---

## Dependencies

- **Setup (T001)** → stories.
- **US1**: T002 (test) → T003 (counts) → T004 (endpoint); T005 (test) → T006 (launcher; needs T004 + T005).
- **US2**: T007 → T008 (service) → T009 (routes); T010 → T011 (UI; needs T006 + T009).
- **US3**: T012 → T013 (needs T006).
- **US4**: T014 → T015 (needs T006).
- **US5**: T016 → T017 (needs T006).
- **Same-file sequential**: `page.tsx` (T006 → T011 → T013 → T015 → T017) and `contacts.page.test.tsx`
  (T005 → T010 → T012 → T014 → T016).
- **Story independence**: US1 is a viable MVP (the launcher). US2–US5 each layer on and are independently
  testable.

## Parallel execution examples

- **T002** (launcher-counts integration test) ∥ **T007** (needs-review integration test) — different files.
- **T004** (counts endpoint) ∥ **T008/T009** (needs-review service/routes) — different files/domains once
  their tests exist.
- **T019** (lint) is `[P]`.
- Sequential (same file): the `page.tsx` chain and the component-test chain above.

## Implementation strategy

MVP = **US1** (the uncluttered launcher + counts). **US2** makes the review queue a self-emptying
worklist (the one real backend addition — `needs_review` clears). **US3/US4** are view wiring over reused
endpoints. **US5** relocates the create form into a modal. Everything reuses existing services, endpoints,
and the 063 overlay/editor — no schema, migration, or new capability.

_Impl notes: because the page (`page.tsx`) and its component test share one file each across all five
stories, the launcher was implemented as one coherent rewrite and the component tests were rewritten to
the new model — opening a record now goes **through the search view** (`openViaSearch` types then clicks
a row), since the mount auto-load is gone. Two behavioral realities worth recording: (1) `refreshCounts`
and a shared `refreshView` are the single F1/F2 refresh path — every mutation handler (save, Mark
reviewed, merge, create) calls them, so counts/lists stay correct from any view; (2) `patchContact`'s
auto-clear checks contact data as "a resulting phone **or** an active/transition `contact_emails` row"
(one extra COUNT query per patch), matching the create predicate. Verified: 64 files / 209 tests green,
tsc + Prettier + ESLint clean._
