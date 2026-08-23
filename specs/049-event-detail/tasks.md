# Tasks: Event detail page enrichment (P7-R5)

**Feature dir**: `specs/049-event-detail/` · **Branch**: `049-event-detail` (stacked on `048-whats-on-cards`)
**Input**: plan.md, research.md, data-model.md, contracts/event-detail.md, quickstart.md, spec.md

**Constitution**: Test-First (NON-NEGOTIABLE) — the test task in each area precedes its implementation task.
**No migration.** Reuses `getPublicEventDetail`, the roster `getBand` already loads, R1 tokens, and the R4
`seriesColor` map (present on this stacked branch).

## Phase 1: Setup

- [X] T001 [P] Add committed per-series hero asset(s) under `public/series/` (curated static images, D-4 — **no
  upload**). At minimum wire one real image (e.g. `public/series/tnc.webp`) so the hero path is demonstrable; the
  remaining series exercise the clean-header (null) path. An interim stand-in (e.g. reusing the 047 hero) is
  acceptable until curated per-series photos are supplied.

## Phase 2: Foundational (blocking prerequisites — projection additions)

- [X] T002 Integration test `tests/integration/publicEventDetail.detail.test.ts` (real Postgres): seed an event
  with a venue, a band with a two-member roster (one lead), a **confirmed** booking under that band, and a
  **non-confirmed** booking; assert `getPublicEventDetail` returns `seriesKey`, a band block carrying both
  `members` (with `isLead`), and that the non-confirmed booking is **excluded** (018). (Test-first — fails until
  T003/T004.)
- [X] T003 Extend `BandBlock` in `src/server/domain/bands/publicDisplay.ts` with
  `members: { name: string; isLead: boolean }[]`, populated from the roster `getBand` already returns (currently
  discarded) — no new query.
- [X] T004 Extend the projection in `src/server/domain/public/publicSchedule.ts`: add `seriesKey: string` to
  `PublicEventDetail` (select `series.key` — the detail query already inner-joins `series`) and
  `members: { name: string; isLead: boolean }[]` to `PublicBandBlock`, mapping `BandBlock.members` through. No
  migration.

## Phase 3: User Story 1 — A coherent, shareable event page (Priority: P1)

**Goal**: the page presents series (color-coded to match the card), date/time, venue (name + map link), price,
description, hero slot, and cancelled marker as a coherent mobile-first page with one H1.
**Independent test**: load a fully-booked event at 375px — series/date/time/venue/price/description render
coherently, no horizontal scroll, exactly one H1, series color matches the card.

- [X] T005 [P] [US1] Unit test `tests/unit/seriesHero.test.ts`: `seriesHeroSrc("tnc")` → its committed
  `/series/…` path (for a mapped series) and `null` for an unmapped/unknown key. (Test-first.)
- [X] T006 [P] [US1] Component test `tests/component/eventHero.test.tsx` (jsdom; stub `next/image` to `<img>`):
  a mapped series renders an `<img>` with the mapped `src` + non-empty `alt`; an unmapped series renders a clean
  header with **no** `<img>`; renders **no** `<h1>`. (Test-first.)
- [X] T007 [US1] Implement `src/app/(public)/_components/seriesHero.ts`: `seriesHeroSrc(seriesKey): string | null`
  — a typed per-series map to a `public/series/<key>` asset path; unmapped → `null`. Mirrors R4 `seriesColor`.
- [X] T008 [US1] Implement `src/app/(public)/_components/EventHero.tsx` (+ `EventHero.module.css`): `next/image`
  hero from `seriesHeroSrc(seriesKey)` when non-null (with an `alt` from the series/activity), else a clean
  series-colored header (accent via `seriesColorVar`, no broken image); no `<h1>`.
- [X] T009 [P] [US1] Component test `tests/component/venueBlock.test.tsx` (jsdom): given a venue, renders the
  name + a map link (anchor to `mapUrl`, or an `<img>` when `mapUrl` is a static-map URL); given `null` venue,
  renders nothing; no `<h1>`. (Test-first.)
- [X] T010 [US1] Implement `src/app/(public)/_components/VenueBlock.tsx` (+ `VenueBlock.module.css`): the venue
  name with a tappable map link; a directions slot reserved for R8 (renders only when a directions field exists —
  none today); omit entirely when `venue` is null.
- [X] T011 [US1] Compose `src/app/(public)/whats-on/[eventId]/page.tsx`: render `EventHero` at the top, the
  title (one `<h1>`) + a series-color accent, the date/time, price (omit when null), description (omit when
  null), and `VenueBlock`; keep the cancelled marker and `notFound()`. Rewrite `eventDetail.module.css` to a
  richer, token-based, mobile-first layout (no horizontal scroll at 375px).

## Phase 4: User Story 2 — See who is playing (the confirmed lineup) (Priority: P1)

**Goal**: the confirmed lineup — bands grouped with their members + callers — with a "to be announced" empty
state.
**Independent test**: for a confirmed band + caller, both render (members by name, lead present); for no
confirmed lineup, "Lineup to be announced" shows instead of an empty section.

- [X] T012 [P] [US2] Component test `tests/component/lineup.test.tsx` (jsdom): a band block with `members` + a
  caller (from `performers`) both render (members by name, lead first/labelled); an empty lineup (no bands, no
  performers) renders **"Lineup to be announced"**; renders no `<h1>`. (Test-first.)
- [X] T013 [US2] Implement `src/app/(public)/_components/Lineup.tsx` (+ `Lineup.module.css`): given `bandBlocks`
  (with `members`) and `performers`, render each band with its members (lead first) + bio/photo, then the
  callers/other performers; render "Lineup to be announced" when both are empty. Confirmed-only is upstream.
- [X] T014 [US2] Wire `Lineup` into `page.tsx`, replacing the current inline performers/bandBlocks section.
  (Same file as T011 — sequential.)

## Phase 5: User Story 3 — A welcoming hero image (Priority: P2)

**Goal**: an event whose series has a committed photo shows it as the hero; a series without one shows a clean
header — no broken image.
**Independent test**: an event of a series with a committed asset shows the hero image; an event of a series
without one shows a clean header.

- [X] T015 [US3] Confirm end-to-end: `seriesHero.ts` maps the committed series (T001) to its asset, `EventHero`
  renders that image for such an event, and an unmapped series renders the clean header. (Logic asserted by
  T005/T006; this verifies the real committed asset via the browser step in T017.)

## Phase 6: Polish & validation

- [X] T016 Gate suite: `pnpm exec vitest run tests/unit/seriesHero.test.ts tests/component/eventHero.test.tsx
  tests/component/venueBlock.test.tsx tests/component/lineup.test.tsx
  tests/integration/publicEventDetail.detail.test.ts`, then `pnpm exec tsc --noEmit`, `pnpm run lint`, and
  `pnpm exec prettier --check` on the changed files. Full `pnpm test` green.
- [X] T017 Browser verify (quickstart §2) at 375px: coherent page, no horizontal scroll, one H1 (SC-001); series
  color matches the card (SC-002); confirmed band + members + caller, and "to be announced" for an unbooked event
  (SC-003); venue name + map link, graceful omissions (SC-004); hero image for a committed series + clean header
  otherwise (SC-005); cancelled marker + unknown id → not-found (SC-006).

## Dependencies

- T003 blocks T004 (projection maps `BandBlock.members`). T002 is test-first for the foundational projection.
- T004 (projection) blocks the page + lineup (they consume `seriesKey` + band `members`).
- T005 precedes T007; T006 precedes T008; T007 blocks T008 (EventHero uses `seriesHeroSrc`). T009 precedes T010.
- T008 + T010 block T011 (page composes them). T012 precedes T013; T013 precedes T014; T014 follows T011 (same
  file). T015 depends on T001 + T008. Phase 6 last.

## Parallel opportunities

- T001 (asset) is independent ([P]).
- The test files are independent ([P]): T005, T006, T009 within US1; T012 within US2 — each can be written before
  its implementation once the projection (T004) lands.

## Implementation strategy

**MVP** = Phase 2 + US1 + US2 (the enriched page with its confirmed lineup) — deliverable with the clean-header
hero even before any image lands. **US3** (the actual hero image) enhances it once a committed per-series asset
is supplied. Incremental: foundational projection → page (US1) → lineup (US2) → hero image (US3) → polish.
