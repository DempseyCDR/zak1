---

description: "Task list for Public design tokens & mobile-first foundation (P7-R1)"
---

# Tasks: Public design tokens & mobile-first foundation (P7-R1)

**Input**: Design documents from `specs/045-public-design-tokens/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/design-tokens.md](contracts/design-tokens.md)

**Tests**: INCLUDED — the constitution's Test-First principle is NON-NEGOTIABLE. Contrast/heading/token
logic is pure or parseable, so it is unit-tested first; presentational components are jsdom-tested. The
DB-backed public *pages* are async server components (not jsdom-renderable), so page-level guards are
source-parse tests, and the visual/responsive proof is the browser preview (quickstart).

**Organization**: By user story in priority order. P1 = US1 (branded/mobile-first), US2 (accessibility);
P2 = US3 (event-type colors).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: different files, no dependency on an incomplete task.

## Path Conventions

Presentation layer under `src/app`. Tokens in `src/app/globals.css`; components + co-located CSS Modules
under `src/app/(public)/_components/`; tests under `tests/unit/` and `tests/component/`.

---

## Phase 1: Setup (Shared Infrastructure)

- [x] T001 Create `src/app/lib/contrast.ts` — a pure WCAG contrast-ratio helper (sRGB→relative luminance→ratio) used by the token tests; no I/O, fully typed.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The app-wide token layer, fonts, and layout primitive every user story consumes.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T002 [P] Write **failing** unit test `tests/unit/designTokens.contrast.test.ts` — parse `src/app/globals.css` `:root` into `--name → #hex`, then assert WCAG AA on the text/UI pairs (research R3): `--text` on `--ground` ≥4.5, `--link` on `--ground` ≥4.5 (fails if left at `#b96131` = 3.82), `--link-on-dark` on `--band` ≥4.5, `--band` text on `--ground` ≥4.5. Uses `contrast.ts`.
- [x] T003 Create `src/app/globals.css` — `:root` tokens with the AA-correct values from research R3 (`--ground #f6efe4`, `--band #2d728f`/`--band-hover #22566c`, `--text #3d3b3d`, `--link #954e27`/`--link-hover`/`--link-on-dark`, `--peach #e5b79e`, type scale, spacing, `--type-contra/english/special/assembly/meeting`) + base element styles (`body` ground+body-font+`margin:0`, heading font/scale, `a` link tokens, visible `:focus-visible`). Makes T002 pass.
- [x] T004 In `src/app/layout.tsx`: load Raleway + Open Sans via `next/font/google` exposed as `--font-heading`/`--font-body` (with fallback stacks), `import "./globals.css"`, and remove the inline `<body style={{ fontFamily … }}>`.
- [x] T005 [P] Create the layout primitive `src/app/(public)/_components/Container.tsx` + `Container.module.css` — mobile-first centered wrapper (padding + max-width from tokens) rendering `<main>` by default, replacing inline `<main style={{ padding, maxWidth }}>`.

**Checkpoint**: Tokens + fonts + primitive exist; the contrast test is green.

---

## Phase 3: User Story 1 - Branded, mobile-first public pages (Priority: P1) 🎯 MVP

**Goal**: The existing public pages render with the brand tokens and fonts, mobile-first, composed from the
shared primitive instead of ad-hoc inline styles.

**Independent Test**: Load a public page at 375px — it shows the cream ground, brand link/heading colors,
and club fonts, fits the viewport, and shares the same system as a second public page (no page-specific
inline sizing).

### Tests (write first)

- [x] T006 [P] [US1] Component test `tests/component/publicLayout.test.tsx` (jsdom) — render `ScheduleList` (fixture items), `SeriesFilter` (fixture series), and `Container`; assert each carries CSS-Module class names, contains no inline `maxWidth`/sizing, and that `ScheduleList`/`SeriesFilter` render no `<h1>` (pages own the single H1).

### Implementation

- [x] T007 [US1] Restyle `src/app/(public)/_components/ScheduleList.tsx` + add `ScheduleList.module.css` — replace the inline `style={{…}}` (list, row, border, muted color) with token-based module classes.
- [x] T008 [US1] Restyle `src/app/(public)/_components/SeriesFilter.tsx` + add `SeriesFilter.module.css` onto tokens/module classes.
- [x] T009 [US1] Restyle the four public pages — `whats-on/page.tsx`, `what-was-on/page.tsx`, `whats-on/[eventId]/page.tsx`, `join/page.tsx` — to wrap content in `<Container>` and drop inline `padding`/`maxWidth` (and any other inline sizing).

**Checkpoint**: Public pages are branded and mobile-first (MVP).

---

## Phase 4: User Story 2 - Accessibility floor (Priority: P1)

**Goal**: Public pages meet WCAG AA, have exactly one H1 with honest nesting, and are keyboard-focusable.

**Independent Test**: A contrast + heading check on the public pages passes AA everywhere (incl. links),
each page has one H1 and no skipped levels, and interactive elements show a visible focus ring.

### Tests (write first)

- [x] T010 [P] [US2] Unit test `tests/unit/publicHeadings.test.ts` — read each public page source (`whats-on`, `what-was-on`, `whats-on/[eventId]`, `join`) and assert exactly one `<h1` per page (SC-003 guard). (AA contrast is already enforced by T002; this adds the heading-discipline guard.)

### Implementation

- [x] T011 [US2] Ensure the accessibility affordances hold: a visible `:focus-visible` outline for links/interactive elements in `globals.css` (added in T003 — verify token contrast of the ring), public-page links resolve to `--link` (AA), and each public page keeps its single `<h1>`. No page adds a second H1.

**Checkpoint**: US1 + US2 — public pages are branded, mobile-first, and AA-accessible.

---

## Phase 5: User Story 3 - Event-type color coding as reusable tokens (Priority: P2)

**Goal**: The five event-type colors are single-source tokens plus a typed map that later listing pages
(R4) consume, safe as accents.

**Independent Test**: Each of the five event types resolves to its single defined color from the map, every
`--type-*` is defined once, and the colors are AA as accents (UI ≥3:1 with charcoal; `meeting` documented
accent-only).

### Tests (write first)

- [x] T012 [P] [US3] Unit test `tests/unit/eventTypeColors.test.ts` — assert `EVENT_TYPE_COLORS` covers all five `EventType` keys and each references a `--type-*` variable that exists in `globals.css` (parse); using `contrast.ts`, assert each `--type-*` on `--text` meets the 3:1 UI threshold and assert `--type-meeting` is <4.5 (documents the accent-only constraint from research R3).

### Implementation

- [x] T013 [US3] Create `src/app/tokens.ts` — the `EventType` union (`contra|english|special|assembly|meeting`) and `EVENT_TYPE_COLORS: Record<EventType, string>` mapping each key to its `var(--type-*)` string (no hex duplication); document the accent/badge-only usage rule (esp. `meeting`) referencing the contract.

**Checkpoint**: All user stories independently done.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [x] T014 [P] Browser-preview verification (quickstart): run the dev server, view all four public pages at 375px — confirm brand palette + fonts (SC-001), no horizontal scroll + ≥16px body (SC-004), enhance-upward at desktop; capture a screenshot.
- [x] T015 [P] Scope guard: confirm no admin/door/volunteer files and **not `src/app/PublicNav.tsx`** were changed (PublicNav restyle is P7-R2); open `/gate` and `/checkin` and confirm they are visually unchanged (SC-007).
- [x] T016 Final gate before opening the PR: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`; confirm the plan.md Constitution Check still holds. Land via reviewed PR (multi-contributor mode — no self-merge).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (T001)** → **Foundational (T002–T005)** blocks all stories (tokens/fonts/primitive).
- **US1 (Phase 3)** is the MVP — pages consume the primitive + tokens.
- **US2 (Phase 4)** builds on the same tokens/pages (focus + heading guards); AA is already enforced foundationally.
- **US3 (Phase 5)** adds the typed color map + its test; independent of US1/US2 beyond the shared `--type-*` tokens (in T003).
- **Polish (Phase 6)** last.

### Within Each User Story

Tests first (must fail) → implementation → checkpoint.

### Parallel Opportunities

- Foundational: T002 (test) ∥ T005 (Container) are `[P]`; T003 (globals.css) and T004 (layout/fonts) are sequential anchors (both touch shared root files / the tokens T002 asserts).
- US1: T006 (test) `[P]`; T007 and T008 touch different component files and can run in parallel, then T009 (pages) after the components exist.
- US3's test (T012) and map (T013) are a small independent slice — parallel with US1/US2 once T003 defines the `--type-*` tokens.

---

## Parallel Example: Foundational

```bash
# After T001 (contrast helper):
Task: "T002 failing contrast test in tests/unit/designTokens.contrast.test.ts"
Task: "T005 Container primitive in src/app/(public)/_components/Container.tsx"
# then T003 (globals.css) → T004 (layout/fonts) sequentially
```

---

## Implementation Strategy

### MVP First (US1)

Setup → Foundational → US1 → **STOP and VALIDATE**: public pages branded + mobile-first at 375px in the
browser preview.

### Incremental (one reviewed PR)

US1 → US2 → US3 → Polish. Because the project is in multi-contributor mode, the feature lands as a
**reviewed PR** from `045-public-design-tokens`; the phases are an implement/verify order and the full gate
suite (T016) must be green before the PR is opened. Merge to `main` requires review — no self-merge.

---

## Notes

- `[P]` = different files, no incomplete dependency. `globals.css` and `layout.tsx` are shared anchors —
  tasks touching them are not `[P]`.
- Reuse, don't reinvent (constitution §II): Next's native global-CSS + CSS Modules + `next/font` — no new
  dependency; `contrast.ts` is the one small helper, shared by the token tests.
- **Out of scope (guard in T015)**: `PublicNav`/admin/door restyles — PublicNav is P7-R2; admin styling is
  a later feature. Tokens are defined app-wide but only `(public)` page bodies are restyled here.
- Verify each test fails before implementing it.
