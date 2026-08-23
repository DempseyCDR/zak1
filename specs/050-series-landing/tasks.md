# Tasks: Series landing pages (P7-R6)

**Feature dir**: `specs/050-series-landing/` · **Branch**: `050-series-landing` (stacked on `049-event-detail`)
**Input**: plan.md, research.md, data-model.md, contracts/series-landing.md, quickstart.md, spec.md

**Constitution**: Test-First (NON-NEGOTIABLE) — the test task in each area precedes its implementation task.
**No migration, no new query.** Reuses `EventHero` (049), `ScheduleList` + `seriesColor` (048),
`getPublicSchedule(db, undefined, seriesKey)` (037), and `Container` (045). Migrated copy lives in a committed
registry (clarified). Source copy: `tmp/contra_dance_rochester.md` (contra **and** community),
`tmp/english_country_dance_rochester.md`, and `tmp/country_dancers_of_rochester_club.md` (cross-cutting).

## Phase 1: Setup

No setup: no new dependency, no migration, no config. (The `.markdownlint-cli2.jsonc` `tmp/**` ignore is
already applied so the gate does not lint the scratch source docs; the branch already has 048 + 049.)

## Phase 2: Foundational (blocking prerequisites — the content registry)

- [X] T001 Unit test `tests/unit/styleLanding.test.ts`: `getStyleLanding` returns the three styles
  (`contra`/`english`/`community`) with the correct `seriesKey` mapping (`contra`→`tnc`, `english`→`ecd`,
  `community`→`community_dance`), non-empty `title`/`intro`/`whyYoullLove`/`whatToExpect`, and each
  `whatToExpect` includes a **"no partner"** reassurance; `getStyleLanding("tango")` → `null`; `STYLE_SLUGS`
  is exactly `["contra","english","community"]`. (Test-first — fails until T002.)
- [X] T002 Implement `src/app/(public)/dances/[style]/landingContent.ts`: the typed `StyleLanding` model +
  `LANDING_CONTENT` registry + `getStyleLanding(slug)` + `STYLE_SLUGS`. **Migrate the club's copy** (voice
  preserved, lifted not paraphrased) into `intro` / `whyYoullLove` / `whatToExpect` per data-model.md:
  **contra** + **community** from `tmp/contra_dance_rochester.md`, **english** from
  `tmp/english_country_dance_rochester.md`, cross-cutting etiquette from
  `tmp/country_dancers_of_rochester_club.md`. **Role/gendered-language note is style-specific** (spec FR-001):
  contra & community → gender-free **Larks/Robins**; english → **traditional men's/women's line** terms, some
  callers moving toward **positional** (NOT Larks/Robins). Every `whatToExpect` includes "no partner needed".

## Phase 3: User Story 1 — Newcomer learns the style and feels welcome (Priority: P1)

**Goal**: each style's page presents what-it-is / why-you'll-love / what-to-expect (incl. no partner needed,
dress, etiquette, the style-appropriate role note) in the club's voice, one H1, mobile-first.
**Independent test**: load a style page at 375px — the three content sections render (incl. "no partner
needed"), no horizontal scroll, exactly one H1; English shows its traditional terminology, not Larks/Robins.

- [X] T003 [P] [US1] Component test `tests/component/landingSections.test.tsx` (jsdom): given a `StyleLanding`,
  `LandingSections` renders the `intro`, `whyYoullLove`, and `whatToExpect` prose (assert a sample line incl.
  "no partner") under `<h2>` section headings, and renders **no** `<h1>`. (Test-first.)
- [X] T004 [US1] Implement `src/app/(public)/_components/LandingSections.tsx` (+ `LandingSections.module.css`):
  a pure component taking a `StyleLanding` (or its prose fields); renders the what-it-is / why-you'll-love /
  what-to-expect sections as `<h2>`-headed blocks (paragraphs + the what-to-expect list). No `<h1>`.
- [X] T005 [US1] Create `src/app/(public)/dances/[style]/page.tsx` (+ `styleLanding.module.css`): async server
  page — `getStyleLanding(style)` else `notFound()`; render `EventHero(seriesKey, title)` (reused, 049), one
  `<h1>` (the page `title`) with a series-color accent via `seriesColorVar` (048), and `LandingSections`;
  wrap in `Container` (045). Export `generateStaticParams` → `STYLE_SLUGS`. Mobile-first, no horizontal scroll.

## Phase 4: User Story 2 — See this style's upcoming dances (Priority: P1)

**Goal**: the page shows this style's upcoming dances as the shared cards, each linking to its event detail,
with an empty state.
**Independent test**: on a style page, the upcoming-dances section lists only that series' dances as the P7-R4
cards; a series with none shows the empty message.

- [X] T006 [US2] Add the upcoming-dances section to `src/app/(public)/dances/[style]/page.tsx`: read
  `getPublicSchedule(db, undefined, seriesKey)` (037, series-filtered) and render `<ScheduleList>` (048) under
  a heading (e.g. "Upcoming contra dances") with an empty-state message. Same file as T005 — sequential.

## Phase 5: User Story 3 — Representative photo, on-brand, findable (Priority: P2)

**Goal**: the page shows the style's representative photo and series color, and the pages are reachable from
the site nav.
**Independent test**: the page shows the `seriesHero` photo (or a clean header) and the series color accent
matches the card; the three landing pages are reachable from the public nav.

- [X] T007 [US3] Add three flat entries to `PUBLIC_NAV` in `src/app/publicNavItems.ts` — Contra / English /
  Community → `/dances/contra` · `/dances/english` · `/dances/community` (FR-006; flat, per 046 no-dropdown).
- [X] T008 [US3] Confirm the representative photo + color reuse: `EventHero` renders the series' `seriesHero`
  image (049) for each covered style (contra→`/series/contra.webp`, english→`/series/ecd.jpg`,
  community→`/series/community_dance.jpg`) and the title accent uses `seriesColorVar(seriesKey)` (matching the
  card). No new code beyond T005's wiring; verified in the browser step (T010).

## Phase 6: Polish & validation

- [X] T009 Gate suite: `pnpm exec vitest run tests/unit/styleLanding.test.ts
  tests/component/landingSections.test.tsx`, then `pnpm exec tsc --noEmit`, `pnpm run lint`, and
  `pnpm exec prettier --check` on the changed files. Full `pnpm test` green.
- [X] T010 Browser verify (quickstart §2) at 375px: `/dances/contra`, `/dances/english`, `/dances/community`
  each render hero + the three content sections (incl. "no partner needed") + this-series-only upcoming cards +
  empty state (SC-001/SC-002); series color matches the card/event page (SC-003); representative photo shows
  (SC-004); the pages are reachable from the nav (SC-005); the migrated voice reads as the club's own and
  **English shows traditional terminology, not Larks/Robins**; an unknown slug (`/dances/tango`) → 404 (SC-006).

## Dependencies

- T001 (test) precedes T002; T002 (registry) blocks everything (the page reads it; `seriesKey` drives US2 +
  US3).
- T003 precedes T004; T004 + T002 block T005. T006 follows T005 (same file). T007 is independent (nav file).
  T008 depends on T005 (uses `EventHero`/`seriesColorVar` wired there). Phase 6 last.

## Parallel opportunities

- T003 (component test) is independent ([P]) once the `StyleLanding` shape (T002) is known.
- T007 (nav, a different file) can proceed alongside the US1/US2 page work.

## Implementation strategy

**MVP** = Phase 2 + US1 + US2 (the content pages with their upcoming dances) — a working growth funnel. **US3**
(nav entries + the photo/color confirmation) makes them findable and finished. Incremental: registry (copy) →
content page (US1) → upcoming dances (US2) → nav + photo (US3) → polish.
