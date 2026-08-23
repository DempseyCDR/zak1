# Quickstart: Series landing pages (P7-R6)

Validation/run guide. Implementation lives in `tasks.md` + code; this proves the feature end-to-end.

## Prerequisites

- On `050-series-landing` (stacked on `049-event-detail`, so 048 cards + `seriesColor` and 049 `seriesHero` are
  present).
- Dependencies installed (`pnpm install`); no new dependency; **no migration**.
- The migrated per-style copy is supplied in `landingContent.ts` (the club's voice — see spec Assumptions).

## 1. Automated checks (write tests first — constitution Test-First)

```bash
pnpm test -- styleLanding landingSections     # content registry + the pure prose renderer
pnpm typecheck && pnpm lint
```

**Expected**: `getStyleLanding` returns the three styles with the right `seriesKey` (contra→tnc, english→ecd,
community→community_dance) and non-empty required sections (incl. "no partner needed"), and `null` for an
unknown slug; `STYLE_SLUGS` is exactly the three; `LandingSections` renders the prose (incl. "no partner
needed") under `<h2>` headings and no `<h1>`.

## 2. Visual verification (browser preview)

Open `/dances/contra`, `/dances/english`, `/dances/community` at 375px:

- **SC-001**: each page presents what-it-is, why-you'll-love, and what-to-expect (incl. **no partner needed**,
  dress, etiquette, and the style's role/gendered-language note — Larks/Robins for contra/community, traditional
  men's/women's terms for English) as one readable page; no horizontal scroll; exactly one H1.
- **SC-002**: the upcoming-dances section shows **only that style's** dances as the shared cards, each opening
  its event detail; a series with none upcoming shows an empty-state message.
- **SC-003**: the page's series color accent **matches** that series' color on the `/whats-on` card and the
  event detail page.
- **SC-004**: a representative **photo** shows for the style (contra/english/community have `seriesHero` images);
  a style with no image would show a clean header (no broken image).
- **SC-005**: the pages are reachable from the site **navigation** (Contra / English / Community entries).
- **SC-006**: the migrated **voice** reads as the club's own words; an **unknown** style slug (e.g.
  `/dances/tango`) returns **not-found**.

Then widen the viewport and confirm the page enhances upward.

## 3. Consistency

- Tap a card on a landing page and confirm it lands on that event's detail page with the **same series color**
  (single source — SC-003).

## Success criteria mapping

| Check | Criterion |
|-------|-----------|
| What-it-is / why / what-to-expect @375px, one H1 | SC-001 |
| This-style-only upcoming cards + empty state | SC-002 |
| Series color matches card + event page | SC-003 |
| Representative photo (clean header when absent) | SC-004 |
| Reachable from the nav | SC-005 |
| Migrated voice; unknown slug → not-found | SC-006 |
