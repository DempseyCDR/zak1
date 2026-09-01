# Tasks: Mobile-First Admin UI Foundation

**Feature**: 060-mobile-admin-ui | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

**Scope**: presentation/interaction foundation — adopt the `globals.css` design system in `(admin)`,
add reusable **Record**/**Triage** patterns, prove them on the **`contacts`** reference surface
(presentation only). No schema, no auth, no role-specific data logic (FR-009). **Test-First** for
component logic; layout/visual SCs verified in the Browser preview (jsdom can't compute layout).

⚠️ **No theming.** The app uses a single fixed palette — use `globals.css` tokens, do **not** add
light/dark handling.

---

## Phase 1: Setup

- [X] T001 Confirm on branch `060-mobile-admin-ui`; establish a green baseline: `pnpm vitest run tests/component && pnpm tsc --noEmit` pass before any change.

## Phase 2: Foundational (blocks both stories)

- [X] T002 Establish the shared **48×48px touch-target** floor. _Adjusted from the plan:_ `globals.css` is **token-vocabulary-only** (its comment + the token tests forbid applied rules there), and `--space-7` is already 48px — so the floor is a composable `.touchTarget` helper in `src/app/(admin)/_components/AdminPage.module.css` (`min-block/inline-size: var(--space-7)`), composed by the interactive controls, rather than a rule in `globals.css`.

## Phase 3: User Story 1 — Mobile-first admin shell + design system (Priority: P1) 🎯 MVP

**Goal**: `contacts` becomes mobile-first — shared tokens/shell, no horizontal page scroll at 375px, 48px targets — replacing inline `style={{}}`.

**Independent test**: at a 375px viewport, `/contacts` renders with the public site's palette, no horizontal page-body scroll, and 48px targets; search still returns results (no regression).

- [X] T003 [P] [US1] In `tests/component/adminPage.test.tsx`, add failing tests: `AdminPage` renders a container landmark + its children (structure). Run; watch fail (component absent).
- [X] T004 [P] [US1] In `tests/component/contacts.page.test.tsx`, add tests (mock `apiFetch` + `next/link`): typing a query renders the results list, and submitting the create form posts (no-regression lock, C-S4). These pass **now** and MUST stay green after migration.
- [X] T005 [US1] Create `src/app/(admin)/_components/AdminPage.tsx` + `AdminPage.module.css` — a mobile-first page shell/container using `--container-max` / `--space-*`, no horizontal overflow. Make T003 pass. (depends: T003)
- [X] T006 [US1] Migrate `src/app/(admin)/contacts/page.tsx`: wrap in `AdminPage`, move all inline `style={{}}` into a new `src/app/(admin)/contacts/contacts.module.css` (tokens only), mobile-first, 48px targets on inputs/buttons (T002). **Preserve** search + create behavior (T004 stays green). (depends: T002, T004, T005)

**Checkpoint**: US1 MVP — contacts is usable on a phone with the shared look, no behavior change.

## Phase 4: User Story 2 — Record & Triage paradigms (Priority: P2)

**Goal**: reusable `RecordView` (single-entity editor shell) and `TriageList` (worklist), applied to contacts.

**Independent test**: `RecordView` and `TriageList` render per `contracts/ui-patterns.md` (rows with inline action / `onOpen`; empty state); on `/contacts` the results read as a Triage list that opens a Record view.

- [X] T007 [P] [US2] In `tests/component/recordView.test.tsx`, add failing tests: renders the entity region + actions area; performs no data calls (C-A1, C-A3). Run; watch fail.
- [X] T008 [P] [US2] In `tests/component/triageList.test.tsx`, add failing tests: renders rows with an inline action / `onOpen(item)`, and the empty state when `items` is empty (C-B1–C-B3). Run; watch fail.
- [X] T009 [P] [US2] Create `src/app/(admin)/_components/RecordView.tsx` + `RecordView.module.css` (stacked fields/sections + actions; 48px targets). Make T007 pass.
- [X] T010 [P] [US2] Create `src/app/(admin)/_components/TriageList.tsx` + `TriageList.module.css` (rows: primary content + inline action / open affordance; empty state). Make T008 pass.
- [X] T011 [US2] Refactor `src/app/(admin)/contacts/page.tsx`: render search results via `TriageList` (row → `onOpen` bridge) and wrap the create/detail in a `RecordView` shell. Keep behavior (T004 stays green). (depends: T006, T009, T010)

**Checkpoint**: US2 — the two reusable paradigms exist and contacts demonstrates them.

## Phase 5: Polish & Cross-Cutting

- [~] T012 Browser-preview verification at **375px** per `quickstart.md`. **Automatable parts DONE:** component tests cover structure/behavior; presentation invariants verified by inspection — **0** inline `style={{}}` remain in `contacts/page.tsx`, the new CSS uses tokens only (except two documented status colors), and targets use the 48px floor (`var(--space-7)`). **PENDING (manual):** the live signed-in 375px pass (no h-scroll / computed 48px / computed token colors / nav) — `/contacts` is `requireStaff`-gated and there is no dev auth bypass, so it needs a real staff session (or a future e2e with a seeded session). (depends: T006, T011)
- [X] T013 Full gate: `pnpm vitest run tests/component && pnpm tsc --noEmit` — all green, zero regressions. (depends: T006, T011)
- [X] T014 [P] Prettier/ESLint on changed files only (`src/app/globals.css`, the three `(admin)/_components/*` pairs, `contacts/page.tsx` + `contacts.module.css`, the new test files).

---

## Dependencies

- **Setup (T001)** → **Foundational (T002)** → user stories.
- **US1**: T003, T004 (tests) → T005 (AdminPage) → T006 (contacts migration; also needs T002).
- **US2**: T007, T008 (tests) → T009, T010 (components) → T011 (contacts refactor; also needs T006).
- **contacts/page.tsx is edited by T006 then T011** — sequential, never parallel.
- **Polish**: T012, T013 after T011; T014 after the edits it formats.
- **Story independence**: US1 is a viable MVP (contacts mobile-first) without US2. US2 adds the reusable patterns and re-expresses the contacts list/record through them.

## Parallel execution examples

- **US1 tests**: T003 (`adminPage.test.tsx`) ∥ T004 (`contacts.page.test.tsx`) — different files.
- **US2 tests**: T007 (`recordView.test.tsx`) ∥ T008 (`triageList.test.tsx`) — different files.
- **US2 components**: T009 (`RecordView`) ∥ T010 (`TriageList`) — different files.
- **Never parallel**: T006 and T011 (both edit `contacts/page.tsx`).

## Implementation strategy

MVP = **US1** (AdminPage + touch utility + contacts migrated to the shell): contacts becomes mobile-first
with the shared palette and no behavior change. **US2** then adds `RecordView`/`TriageList` and routes the
contacts list/record through them — the reusable seam the Mel/Meg/Booker features consume. Verify the
visual SCs in the Browser preview at 375px throughout.
