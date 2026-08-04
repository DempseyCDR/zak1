---

description: "Task list for feature 034 — Public Navigation Menu"
---

# Tasks: Public Navigation Menu

**Input**: Design documents from `specs/034-public-nav-menu/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/public-nav.md, quickstart.md

**Tests**: INCLUDED — the project constitution (I. Test-First) is non-negotiable, so the component test is
written first and must fail before implementation.

**Organization**: Tasks are grouped by user story (US1 P1 → US2 P2 → US3 P3) for independent implementation and
testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1 / US2 / US3 — maps to the spec's user stories
- Every task names an exact file path

## Path Conventions

Single Next.js App Router project — `src/app/**` and `tests/component/**` at repo root (per plan.md).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the tooling this feature needs already exists — no install.

- [ ] T001 Confirm the jsdom component-test harness is available for a new
  `tests/component/publicNav.test.tsx` — the feature-020 setup (`tests/setup.dom.ts`, the
  `// @vitest-environment jsdom` docblock, RTL + `@testing-library/user-event` + jest-dom). No dependency
  install is required; note the pattern to follow (see an existing `tests/component/*.test.tsx`).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The single-source entry list that both the component and its tests import.

**⚠️ CRITICAL**: The component (US1) and every test import this module — it must exist first.

- [ ] T002 Create the hand-maintained entries module `src/app/publicNav.ts` exporting
  `export const PUBLIC_NAV: readonly { href: string; label: string }[]` with exactly two entries in order —
  `{ href: "/whats-on", label: "What's On" }`, `{ href: "/join", label: "Join" }`. No `"use client"` directive
  (importable by server or client). This is the single edit point for FR-003 / SC-003.

**Checkpoint**: Entry source exists — user-story work can begin.

---

## Phase 3: User Story 1 - Visitor reaches any public page from a consistent menu (Priority: P1) 🎯 MVP

**Goal**: A visitor sees a top menu on public pages listing the public destinations and the club wordmark, and
can navigate to any of them.

**Independent Test**: Load `/whats-on` and `/join`; the same menu (wordmark + What's On + Join) is present and
every entry navigates correctly.

### Tests for User Story 1 (write FIRST — must FAIL before T005/T006)

- [ ] T003 [US1] Create the failing component test `tests/component/publicNav.test.tsx` (jsdom docblock) that
  renders `PublicNav` and asserts: a navigation landmark with `aria-label="Site"` exists; a wordmark/home link to
  `/whats-on` is present; one link per `PUBLIC_NAV` entry is rendered (mapping over the imported `PUBLIC_NAV`
  so the assertion is data-driven — "What's On" → `/whats-on`, "Join" → `/join`); the entry links are
  keyboard-focusable in DOM order (FR-008 — assert tab/DOM order of the rendered anchors); and the component
  renders the **full** entry set with **no** auth input, props, or fetch — it makes no authorization decision
  (FR-005, presentation-only). Mock `usePathname` from `next/navigation` (return `/whats-on`). Confirm it FAILS
  (component does not yet exist).

### Implementation for User Story 1

- [ ] T004 [US1] Create `src/app/PublicNav.tsx` as a `"use client"` component: render `<nav aria-label="Site">`
  containing the club wordmark link to `/whats-on` (FR-006) followed by one `next/link` per `PUBLIC_NAV` entry
  (in array order) with `entry.label` text and `entry.href` target. Use a responsive `flex` + `flexWrap: "wrap"`
  style consistent with `src/app/Nav.tsx` (FR-008). (Active-state wiring lands in US2 — this component is the one
  US2 extends.) Makes T003 pass.
- [ ] T005 [US1] Render `<PublicNav/>` in the root layout `src/app/layout.tsx`, inside `<body>` immediately
  before `{children}`, so it is the topmost bar on **every** page (FR-001, clarification A).
- [ ] T006 [US1] Remove the now-redundant wordmark header from `src/app/(public)/layout.tsx` (the club-name link
  and its `<header>`); `PublicNav` supplies the wordmark. Keep the layout otherwise passing `{children}` through.

**Checkpoint**: The public menu renders on public pages and every entry navigates — MVP is demonstrable.

---

## Phase 4: User Story 2 - Menu present on every page, signed in or not, with the current section marked (Priority: P2)

**Goal**: The menu appears at the top of every page — public and staff — in both signed-out and signed-in
states, and indicates the current section.

**Independent Test**: Visit public and staff pages, signed out and in; the menu is present each time (topmost on
staff pages, volunteer nav beneath), and the current page/section is marked active.

### Tests for User Story 2 (write FIRST — must FAIL before T008)

- [ ] T007 [US2] Extend `tests/component/publicNav.test.tsx` with active-state cases (re-mocking `usePathname`
  per case): `/whats-on` and `/whats-on/evt-123` → the **What's On** link has `aria-current="page"`; `/join` →
  **Join** has it; `/gate` → no public entry has `aria-current`. Confirm the new cases FAIL.

### Implementation for User Story 2

- [ ] T008 [US2] Add active-section logic to `src/app/PublicNav.tsx`: read `usePathname()` and mark an entry
  active when `pathname === href || pathname.startsWith(href + "/")` (research R3), setting `aria-current="page"`
  and a visible active style on that link (FR-004). Makes T007 pass.
- [ ] T009 [US2] Verify (no code expected) that the root-layout placement (T005) already yields the public menu
  as the **topmost** bar on `/checkin` and `/gate` with the volunteer `<Nav/>` beneath it, per quickstart step 4
  — the `(admin)`/`(door)` layouts remain unchanged. If the two bars are indistinguishable to assistive tech,
  confirm the distinct landmarks (`aria-label="Site"` vs the volunteer nav's `aria-label="Main"`).

**Checkpoint**: Menu is on every page in both auth states with correct active-state; US1 still passes.

---

## Phase 5: User Story 3 - Maintainer adds or changes a menu entry in one place (Priority: P3)

**Goal**: Adding, removing, renaming, or reordering an entry is a single edit to `PUBLIC_NAV`, reflected
site-wide with no other change.

**Independent Test**: Add one entry to `PUBLIC_NAV`; it appears in the menu with no other file edited; remove it;
it disappears.

> **US3 has no implementation delta** — the single-source property is a *consequence* of US1's array-driven
> render (T003 + T004). This phase adds one **regression guard**, not a fail-first TDD test.

### Regression guard for User Story 3 (expected to PASS on write)

- [ ] T010 [US3] Add a **regression-guard** test to `tests/component/publicNav.test.tsx` that locks the
  single-source property beyond T003's presence checks: assert the rendered entry links equal `PUBLIC_NAV` mapped
  to `{ text: label, href }` **in order** and that their **count equals `PUBLIC_NAV.length`** (so adding/removing
  an array entry changes the menu with no component edit). This encodes FR-003 / SC-003 as an executable
  guarantee. Unlike the US1/US2 tests, this is **not** fail-first — the behavior already exists (T004); the test
  is expected to pass on write and guards against future regression. (If preferred, merge it into T003 instead of
  a separate case — same guarantee.)

**Checkpoint**: The single-source property is locked by a regression guard; all three stories pass
independently.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Gates, docs, and end-to-end validation.

- [ ] T011 [P] Update `docs/zak1_Help_Glossary.md` with a short "Public navigation menu" entry pointing at
  `src/app/PublicNav.tsx` + `src/app/publicNav.ts` (mirrors the glossary's term→file convention).
- [ ] T012 Run the full local gate: `pnpm exec tsc --noEmit && pnpm run lint && pnpm exec vitest run` — all
  green (scope prettier/lint to changed files if run separately).
- [ ] T013 Run the manual quickstart validation (`specs/034-public-nav-menu/quickstart.md`) via the dev server /
  browser preview: public pages, event detail page, a staff page (two bars), and a mobile-width check;
  screenshot the result.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies.
- **Foundational (Phase 2)**: after Setup — **blocks all stories** (the entries module is imported everywhere).
- **User Stories (Phase 3–5)**: all depend on Phase 2. They are layered on the **same** component + test file, so
  in practice they proceed in priority order (P1 → P2 → P3) rather than in parallel.
- **Polish (Phase 6)**: after the desired stories are complete.

### User Story Dependencies

- **US1 (P1)**: after Foundational. No dependency on other stories. Delivers the MVP.
- **US2 (P2)**: builds on US1's `PublicNav` component (adds active-state) — extends, does not break, US1.
- **US3 (P3)**: builds on US1's array-driven render (adds a guarantee test) — extends, does not break, US1/US2.

### Within Each User Story

- The test task is written and made to FAIL before its implementation task(s) — **except** US3's T010, which is
  a regression guard expected to pass on write (US3 adds no implementation).
- T002 (module) before T003/T004 (test + component import it).
- T004 (component) before T005 (root-layout render) and before T008 (active-state extends it).

### Parallel Opportunities

- Few — this feature is a single component + one test file + two layout edits, so most tasks touch overlapping
  files and serialize. `tests/component/publicNav.test.tsx` is edited by T003/T007/T010 (same file — sequential).
- **[P]** applies only to T011 (docs, independent file) relative to the T012 gate run.

---

## Parallel Example

```bash
# This feature has minimal parallelism. The one independent-file task:
Task: "T011 Update docs/zak1_Help_Glossary.md with a Public navigation menu entry"
# can proceed alongside preparing the T012 gate run; everything else touches
# PublicNav.tsx, publicNav.ts, the layouts, or the single test file and must serialize.
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 Setup (T001) → Phase 2 Foundational (T002).
2. Phase 3 US1 (T003 test → T004 component → T005 root layout → T006 remove redundant header).
3. **STOP and VALIDATE**: menu renders on public pages, entries navigate. Demoable MVP.

### Incremental Delivery

1. Setup + Foundational → entry source ready.
2. US1 → menu + navigation (MVP).
3. US2 → active-state + confirmed on staff pages (two bars).
4. US3 → single-source guarantee test.
5. Polish → glossary, gates, quickstart.

---

## Notes

- Tests live in one file (`tests/component/publicNav.test.tsx`) grown across US1/US2/US3 — verify each new block
  FAILS before its implementation, except US3's T010 regression guard (expected to pass on write).
- No database, migration, API route, or authorization change — this is presentation only (FR-005). The route
  inventory is unaffected (no new route).
- `(admin)`/`(door)` layouts are intentionally **not** edited; the volunteer nav sits beneath the root menu for
  free.
- Commit after each logical group; the whole feature is one atomic commit per repo convention (solo-maintainer
  mode).
