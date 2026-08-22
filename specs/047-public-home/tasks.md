---

description: "Task list for Public home page (P7-R3)"
---

# Tasks: Public home page (P7-R3)

**Input**: Design documents from `specs/047-public-home/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/public-home.md](contracts/public-home.md)

**Tests**: INCLUDED — the constitution's Test-First principle is NON-NEGOTIABLE. Pure presentational pieces
(orientation block, Footer) are jsdom-tested first; the home's one-H1 + stub-removal are a source-parse
test. The home is an async server component (reads the schedule), so full-page facts (hero render, next-
dances, empty state, footer-everywhere, AA, no-scroll) are browser-verified (quickstart).

**Organization**: By user story in priority order. P1 = US1 (newcomer orientation), US2 (next-dances);
P2 = US3 (site-wide footer).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: different files, no dependency on an incomplete task.

## Path Conventions

Presentation under `src/app`; the home moves to `src/app/(public)/page.tsx`; footer + blocks under
`src/app/(public)/_components/`; the hero asset at repo-root `public/hero.webp`. Tests under `tests/`.

---

## Phase 1: Setup (Shared Infrastructure)

- [x] T001 [P] Create the `public/` directory and add the hero image at `public/hero.webp` — the club-supplied dancers photo, **16:9**, ≥1600px wide, subject centered with safe margins, optimized (target < ~150 KB). If the photo is not yet available, proceed; the hero renders its token band + tagline and the image is dropped in later.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Move `/` into the public group so every story's content lives on a styled public home.

**⚠️ CRITICAL**: No user story work begins until this is complete.

- [x] T002 Move the home into the `(public)` group: **delete `src/app/page.tsx`** (the staff stub — FR-009) and create **`src/app/(public)/page.tsx`** as a minimal async server-component home with exactly one `<h1>`, so it renders inside the `(public)` styling wrapper + the R2 nav.
- [x] T003 [P] Create `src/app/(public)/home.module.css` — the home stylesheet skeleton (hero band + section layout) built from the R1 `:root` tokens.

**Checkpoint**: `/` renders a styled (empty-ish) public home; the old stub is gone.

---

## Phase 3: User Story 1 - A newcomer is oriented before any listing (Priority: P1) 🎯 MVP

**Goal**: A first-time visitor on `/` sees a hero (tagline + image) and a "new here?" orientation block
before any dance listing.

**Independent Test**: Load `/` as a first-time visitor — the hero + tagline + "new here?" CTA are present
and read before any listing; on a phone the hero is one optimized image (no carousel) with no h-scroll.

### Tests (write first)

- [x] T004 [P] [US1] Component test `tests/component/home.orientation.test.tsx` (jsdom) — the "new here?" orientation block renders the orientation copy (what the dancing is · all welcome · no partner · cost) and an onward link to `/whats-on`.
- [x] T005 [P] [US1] Unit test `tests/unit/publicHome.test.ts` — `src/app/(public)/page.tsx` declares exactly one `<h1>`, and `src/app/page.tsx` no longer exists (the staff stub is removed).

### Implementation

- [x] T006 [US1] Implement the hero in `src/app/(public)/page.tsx` + `home.module.css`: a tokenized band with the club-voice **tagline** + a primary CTA; render `/hero.webp` via `next/image` (`fill`) with **`object-fit: cover`**, height **`clamp(200px, 34vh, 460px)`**, focal point via **`--hero-focus: center 30%`** on `object-position`, and a **scrim** overlay (dark→transparent gradient) behind the tagline for WCAG AA. The band has a token background so it reads even if `hero.webp` is absent (degradation edge case).
- [x] T007 [US1] Implement the "new here?" orientation block (a pure `src/app/(public)/_components/NewHere.tsx` for testability, or inline) — orientation copy + onward link to `/whats-on` — placed **before** the next-dances section.

**Checkpoint**: The home orients a newcomer (hero + "new here?") — MVP.

---

## Phase 4: User Story 2 - The next dances at a glance (Priority: P1)

**Goal**: The home shows the next upcoming dances (reused schedule), each linking to detail, with a clear
empty state.

**Independent Test**: With upcoming dances, `/` shows the next few, each linking to detail; with none, a
clear empty-state message shows.

### Tests (write first)

- [x] T008 [P] [US2] Browser-verified per [quickstart.md](quickstart.md) — the next-dances data (`getPublicSchedule`) and list presentation (`ScheduleList`) are already covered by existing tests; this story adds the slice + empty-state + link, whose integration (async server page) is proven in the browser (next dances render + link to detail; empty state shows when none).

### Implementation

- [x] T009 [US2] In `src/app/(public)/page.tsx`: add the next-dances strip — call `getPublicSchedule(db)`, take the next ≤4, render with the shared `ScheduleList` (each links to its detail), show `ScheduleList`'s empty-state message when none, and add a "see the full schedule" link to `/whats-on`.

**Checkpoint**: US1 + US2 — the home orients and shows the next dances.

---

## Phase 5: User Story 3 - Site-wide public footer (Priority: P2)

**Goal**: Every public page has a footer with org info + a support affordance.

**Independent Test**: The footer (org info + links + support/donate) renders on `/` and other public pages
and its links resolve; it does not appear on admin/door.

### Tests (write first)

- [x] T010 [P] [US3] Component test `tests/component/footer.test.tsx` (jsdom) — `Footer` renders a `contentinfo` landmark with the club identity, key links (e.g. What's On, Join), and a support/donate affordance, each with an `href`.

### Implementation

- [x] T011 [US3] Create `src/app/(public)/_components/Footer.tsx` + `Footer.module.css` — a semantic `<footer>` (contentinfo) styled from R1 tokens: club identity, a few key links, and a support/donate affordance.
- [x] T012 [US3] Wire `<Footer/>` into `src/app/(public)/layout.tsx` below `{children}` so it renders on every public page (and never on admin/door).

**Checkpoint**: All user stories independently done.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [x] T013 [P] Browser-preview verification ([quickstart.md](quickstart.md)): `/` at 375px — orientation before the listing, hero (cover/clamp/`center 30%`/scrim; no h-scroll; one H1; AA), next-dances + empty state; footer present on `/`, `/whats-on`, `/join`, an event detail page, and **absent** on `/gate`/`/checkin`; capture a screenshot.
- [x] T014 [P] Scope guard: confirm **no DB/API/migration** change, the schedule domain is untouched, admin/door page **bodies** are unchanged, and only `(public)` files + `public/hero.webp` were added/modified.
- [x] T015 Final gate before opening the PR: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`; confirm the plan.md Constitution Check still holds. Land via reviewed PR (multi-contributor mode — no self-merge; stacked on 046 → 045).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (T001)** and **Foundational (T002–T003)** precede the stories; T002 (the route move) blocks all stories.
- **US1 (Phase 3)** is the MVP — hero + orientation on the moved home.
- **US2 (Phase 4)** adds the next-dances strip to the same page (after US1's page skeleton).
- **US3 (Phase 5)** adds the footer via the layout — independent of US1/US2 beyond the shared `(public)` group.
- **Polish (Phase 6)** last.

### Within Each User Story

Tests first (must fail) → implementation → checkpoint.

### Parallel Opportunities

- Setup T001 (asset) and Foundational T003 (stylesheet) are `[P]`; T002 (route move) is the sequential anchor.
- Each story's test task (T004/T005, T010) is `[P]` and authored first.
- `(public)/page.tsx` is the shared anchor for US1 + US2 (hero, orientation, next-dances) — those impl tasks are **sequential**. The `Footer` (US3) is separate files and can proceed in parallel with US2 once the page skeleton exists.

---

## Parallel Example: story tests

```bash
Task: "T004 home.orientation.test.tsx — orientation copy + onward link"
Task: "T005 publicHome.test.ts — one <h1>; app/page.tsx removed"
Task: "T010 footer.test.tsx — contentinfo landmark + links + support affordance"
```

---

## Implementation Strategy

### MVP First (US1)

Setup → Foundational → US1 → **STOP and VALIDATE**: the home orients a newcomer (hero + "new here?") at
375px in the browser.

### Incremental (one reviewed PR)

US1 → US2 → US3 → Polish. Multi-contributor mode: lands as a **reviewed PR** from `047-public-home`
(stacked on 046 → 045); the full gate suite (T015) must be green before the PR is opened; merge to `main`
requires review — no self-merge.

---

## Notes

- `[P]` = different files, no incomplete dependency. `(public)/page.tsx` + `home.module.css` +
  `(public)/layout.tsx` are shared anchors; tasks touching the same file run sequentially.
- Reuse, don't reinvent (constitution §II): `getPublicSchedule` + `ScheduleList` for the strip; R1 tokens;
  R2 nav; no new dependency, no DB/API/migration.
- **Hero asset**: `public/hero.webp` is a club-supplied content file; render treatment is fixed in research
  R2. The dynamic "next-band" hero is deferred to backlog **B47**.
- **Out of scope (guard in T014)**: video, image-storage system, R13/R14 regions, new destination pages.
- Verify each test fails before implementing it.
