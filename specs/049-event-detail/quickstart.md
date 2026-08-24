# Quickstart: Event detail page enrichment (P7-R5)

Validation/run guide. Implementation lives in `tasks.md` + code; this proves the feature end-to-end.

## Prerequisites

- On `049-event-detail` (stacked on `048-whats-on-cards`, so R1 tokens + R4 `seriesColor` are present).
- Dependencies installed (`pnpm install`); no new dependency; **no migration**.
- At least one committed per-series hero asset under `public/series/` (e.g. `public/series/tnc.webp`) so the
  hero path can be demonstrated; other series exercise the clean-header (null) path.

## 1. Automated checks (write tests first — constitution Test-First)

```bash
pnpm test -- seriesHero eventHero lineup            # map + hero + lineup components
pnpm test:integration -- publicEventDetail.detail   # seriesKey + band members + confirmed-only (real Postgres)
pnpm typecheck && pnpm lint
```

**Expected**: `seriesHeroSrc` returns the mapped path per series and `null` for an unknown key; `EventHero`
renders an `<img>` for a mapped series and a clean header (no `<img>`) for an unmapped one; `Lineup` renders a
band with its members + a caller, and "Lineup to be announced" for an empty lineup; the integration test finds
`seriesKey` + the band `members` and confirms non-confirmed bookings are excluded.

## 2. Visual verification (browser preview)

Open a fully-booked event at `/whats-on/<eventId>` at 375px:

- **SC-001**: series (color-coded), date, time, venue, price, and lineup all render as a coherent page; **no
  horizontal scroll**; **exactly one H1**.
- **SC-002**: the series color on the page **matches** that series' color on its `/whats-on` card.
- **SC-003**: the confirmed band(s) + members and caller(s) are shown; for an event with no confirmed lineup, a
  **"Lineup to be announced"** message shows instead of an empty section.
- **SC-004**: the venue shows its name + a **tappable map link**; a missing venue / price / description is
  omitted (never blank/broken).
- **SC-005**: an event whose series has a committed photo shows the **hero image**; one whose series has none
  shows a **clean header** with no broken image.
- **SC-006**: a **cancelled** event is clearly marked; an unknown event id returns **not-found**.

Then widen the viewport and confirm the page enhances upward.

## 3. Consistency

- Tap a card on `/whats-on` and confirm it lands on this page for the same event, with the **same series color**
  (single source — SC-002).

## Success criteria mapping

| Check | Criterion |
|-------|-----------|
| Coherent page @375px, no scroll, one H1 | SC-001 |
| Series color matches the card | SC-002 |
| Confirmed lineup + members + callers; TBA empty state | SC-003 |
| Venue name + map link; graceful omissions | SC-004 |
| Hero image when present; clean header when not | SC-005 |
| Cancelled marker; unknown id → not-found | SC-006 |
| No upload UI, no venue schema, no new page | SC-007 |
