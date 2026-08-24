# Quickstart: `/whats-on` mobile-first event cards

Validation/run guide. Implementation lives in `tasks.md` + code; this proves the feature end-to-end.

## Prerequisites

- On `048-whats-on-cards` (off `main`, so 045 tokens + 046 nav + 047 home are present).
- Dependencies installed (`pnpm install`); no new dependency; **no migration**.

## 1. Automated checks (write tests first — constitution Test-First)

```bash
pnpm test -- seriesColor eventCard scheduleList   # map + card + updated shared-list test
pnpm test:integration -- publicSchedule.cards     # projection carries seriesKey + venueShortName (real Postgres)
pnpm typecheck && pnpm lint
```

**Expected**: the series→colour map returns the right `var(--type-*)` per key and the neutral default for
an unknown key; `EventCard` links the whole card to detail and shows date, time, venue short name (with
fallback), price, the cancelled marker, and the series accent; the projection test finds
`seriesKey`/`venueShortName`; `scheduleList.test.tsx` (updated) stays green.

## 2. Visual verification (browser preview)

Open `/whats-on` at 375px:

- **SC-001**: the next dance's date/time/venue/price is visible **above the fold**; no horizontal scroll.
- **SC-002**: each event is a **card**; tapping anywhere on it opens the detail page.
- **SC-003**: each card carries its **series colour**; the same series is the same colour on `/whats-on`,
  `/what-was-on`, and the home strip.
- **SC-004**: the **venue short name** and **price** show (price omitted when none; venue falls back to
  full name when no short name).
- **SC-005**: a cancelled event is clearly marked; an empty listing shows a message.
- **SC-006**: tap targets ≥44px; WCAG AA contrast (accent used as a stripe, not behind text); one H1; the
  `?series=` filter still narrows the list.

Then widen the viewport and confirm the cards enhance upward.

## 3. Consistency (SC-007)

- Confirm `/whats-on`, `/what-was-on`, and the home "Coming up" strip render the **identical** card.

## Success criteria mapping

| Check | Criterion |
|-------|-----------|
| Next dance above the fold @375px | SC-001 |
| Whole-card tap → detail | SC-002 |
| Series colour, same everywhere | SC-003 |
| Venue short + price (graceful) | SC-004 |
| Cancelled marker + empty state | SC-005 |
| ≥44px, AA, one H1, ?series filter | SC-006 |
| Identical card on all three surfaces | SC-007 |
