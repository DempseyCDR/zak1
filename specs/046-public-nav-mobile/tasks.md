---

description: "Task list for Public nav, small-screen pattern (P7-R2)"
---

# Tasks: Public nav, small-screen pattern (P7-R2)

**Input**: Design documents from `specs/046-public-nav-mobile/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/public-nav.md](contracts/public-nav.md)

**Tests**: INCLUDED — the constitution's Test-First principle is NON-NEGOTIABLE. Disclosure state / ARIA /
focus / behavior are jsdom-testable and unit-tested first; the existing feature-034 `publicNav.test.tsx`
MUST stay green. Touch-target size, the 768px switch, no-scroll, and the two-bar stack have no layout
engine in jsdom → browser-preview checks (quickstart).

**Organization**: By user story in priority order. P1 = US1 (compact mobile bar), US2 (accessibility);
P2 = US3 (two bars coexist).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: different files, no dependency on an incomplete task.

## Path Conventions

Presentation layer under `src/app`. The nav is one shared component: `PublicNav.tsx` +
`PublicNav.module.css`; `publicNavItems.ts` is unchanged. Tests under `tests/component/`.

---

## Phase 1: Setup (Shared Infrastructure)

- [x] T001 [P] Create `src/app/PublicNav.module.css` with the mobile-first base bar styles from the R1 `:root` tokens — bar layout, wordmark, link colors (`--link`/`--text`), `--hairline` divider, `--space-*`, and a visible `:focus-visible` outline. (The stylesheet the stories extend.)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Move the existing bar onto the tokenized stylesheet before adding the disclosure, keeping the
034 behavior intact.

**⚠️ CRITICAL**: No user story work begins until this is complete.

- [x] T002 Restyle `src/app/PublicNav.tsx` from its inline `style={{…}}` onto `PublicNav.module.css` classes — same layout/behavior as today (wordmark + inline links + `aria-current` active state), just tokenized. `tests/component/publicNav.test.tsx` (034) MUST stay green.

**Checkpoint**: The bar is tokenized; no behavior change yet.

---

## Phase 3: User Story 1 - Compact, scalable mobile bar (Priority: P1) 🎯 MVP

**Goal**: Below 768px the nav is a compact bar (wordmark + labeled toggle) that reveals a flat destination
panel; at ≥768px it is the inline bar.

**Independent Test**: At 375px the nav is a compact bar (not a wrapped list); tapping the toggle reveals
all destinations; at ≥768px it renders inline.

### Tests (write first)

- [x] T003 [P] [US1] New component test `tests/component/publicNav.mobile.test.tsx` (jsdom, mocking `next/navigation` + `next/link` as the 034 test does) — a labeled toggle button exists with `aria-expanded="false"` initially; clicking it sets `aria-expanded="true"`; all `PUBLIC_NAV` links + the wordmark are present in the DOM in both states (kept queryable).

### Implementation

- [x] T004 [US1] In `src/app/PublicNav.tsx`: add the disclosure structure — local `open` state, a labeled toggle `<button>` with `aria-expanded` + `aria-controls`, and the destination `<ul>` panel (always rendered in the DOM); preserve the wordmark/home affordance and `aria-current` active state.
- [x] T005 [US1] In `src/app/PublicNav.module.css`: mobile-first compact bar (wordmark + toggle) with the panel hidden when closed and shown when open; a `@media (min-width: 768px)` block that hides the toggle and shows the destinations **inline** (the desktop bar) regardless of `open`; a `<noscript>` fallback (rendered from `PublicNav.tsx`) that reveals the panel so destinations are reachable without JS (FR-005).

**Checkpoint**: Compact mobile bar + inline desktop bar work (MVP).

---

## Phase 4: User Story 2 - Accessible disclosure (Priority: P1)

**Goal**: The menu is fully keyboard- and screen-reader-operable with ≥44px targets and AA contrast.

**Independent Test**: Keyboard-only, open the menu, traverse links, press Escape → it closes and focus
returns to the toggle; the toggle exposes expanded/collapsed state; targets are thumb-sized; AA passes.

### Tests (write first)

- [x] T006 [P] [US2] Extend `tests/component/publicNav.mobile.test.tsx` — pressing Escape while open sets `aria-expanded="false"` and returns focus to the toggle; rendering with a changed `usePathname` collapses the panel (`aria-expanded="false"`); the toggle has an accessible label.

### Implementation

- [x] T007 [US2] In `src/app/PublicNav.tsx`: keyboard/close behavior — Escape closes an open panel and returns focus to the toggle; a `usePathname` effect closes it on route change; ensure the toggle is a labeled button and links are keyboard-reachable.
- [x] T008 [US2] In `src/app/PublicNav.module.css`: ensure the toggle and panel links present ≥44×44px touch targets, and that all nav text/controls use the R1 tokens (AA-guaranteed); confirm the `:focus-visible` ring is visible on the toggle and links.

**Checkpoint**: US1 + US2 — compact, mobile-first, and fully accessible.

---

## Phase 5: User Story 3 - Public and volunteer bars coexist (Priority: P2)

**Goal**: When signed in, both the public bar and the volunteer bar render and stay reachable on small
screens without overlap.

**Independent Test**: Signed in at 375px, both bars render, are distinguishable, and every destination in
each is reachable without overlap or horizontal scroll.

### Tests (write first)

- [x] T009 [P] [US3] Component test `tests/component/nav.stack.test.tsx` — rendering `PublicNav` (aria-label "Site") together with `VolunteerNav` (aria-label "Main") yields two distinct navigation landmarks both present in the DOM (structural guard; visual non-overlap is browser-verified).

### Implementation

- [x] T010 [US3] In `src/app/PublicNav.module.css`: ensure the open mobile panel flows in normal document order (pushing following content/the volunteer bar down) rather than a fixed full-viewport overlay that would cover the volunteer bar — both bars stack without overlap or clipping.

**Checkpoint**: All user stories independently done.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [x] T011 [P] Browser-preview verification (quickstart): at 375px confirm the compact bar (no h-scroll), keyboard open → traverse → Escape → focus-return, and ≥44px targets; at ≥768px confirm the inline bar; capture a screenshot. Two-bar stack verified signed-in (or noted if a session isn't available).
- [x] T012 [P] Scope guard: confirm `src/app/publicNavItems.ts` (destinations) is unchanged, `Nav.tsx`/`VolunteerNav.tsx` are unchanged, and admin/door page **bodies** are visually unchanged (only the shared bar's look changes, per FR-009).
- [x] T013 Final gate before opening the PR: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`; confirm the plan.md Constitution Check still holds. Land via reviewed PR (multi-contributor mode — no self-merge; stacked on `045`).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (T001)** → **Foundational (T002)** blocks the stories (tokenized bar first).
- **US1 (Phase 3)** is the MVP — adds the disclosure + responsive switch.
- **US2 (Phase 4)** layers a11y behavior onto the same component/stylesheet.
- **US3 (Phase 5)** adds the stack-without-overlap CSS.
- **Polish (Phase 6)** last.

### Within Each User Story

Tests first (must fail) → implementation → checkpoint. The 034 `publicNav.test.tsx` stays green throughout.

### Parallel Opportunities

- T001 (CSS module) is `[P]`; each story's test task (T003, T006, T009) is `[P]` and authored first.
- `PublicNav.tsx` and `PublicNav.module.css` are the two shared files — most implementation tasks touch
  one of them and are therefore **sequential** within the component (US1 → US2 → US3 order), not `[P]`.

---

## Parallel Example: story tests

```bash
# Test tasks are independent files/additions, authored before their implementation:
Task: "T003 publicNav.mobile.test.tsx — toggle + aria-expanded + links present"
Task: "T009 nav.stack.test.tsx — two distinct nav landmarks"
```

---

## Implementation Strategy

### MVP First (US1)

Setup → Foundational → US1 → **STOP and VALIDATE**: compact mobile bar + inline desktop bar in the browser
preview at 375px and ≥768px.

### Incremental (one reviewed PR)

US1 → US2 → US3 → Polish. Multi-contributor mode: lands as a **reviewed PR** from `046-public-nav-mobile`
(stacked on the held `045`); the full gate suite (T013) must be green before the PR is opened, and merge
to `main` requires review — no self-merge.

---

## Notes

- `[P]` = different files, no incomplete dependency. `PublicNav.tsx` + `PublicNav.module.css` are shared
  anchors; tasks touching them run sequentially.
- Reuse, don't reinvent (constitution §II): R1 tokens, existing `PUBLIC_NAV` + `usePathname`, native CSS
  media query, a React disclosure of links (not a hand-rolled ARIA menu) — no new dependency.
- **Out of scope (guard in T012)**: nav destinations/IA content, other pages, and admin/door bodies.
- Verify each test fails before implementing it; keep the 034 `publicNav.test.tsx` green.
