# Quickstart: Public home page

Validation/run guide. Implementation lives in `tasks.md` + code; this proves the feature end-to-end.

## Prerequisites

- On `047-public-home` (stacked on 046 → 045, so R1 tokens + R2 nav are present).
- Dependencies installed (`pnpm install`); no new dependency.
- A single optimized hero image placed under `public/` (club-supplied) — or verify the text-first hero band
  when no image is provided.

## 1. Automated checks (write tests first — constitution Test-First)

```bash
pnpm test -- footer home.orientation   # Footer landmark + org info/links/support; orientation copy + onward link
pnpm test -- publicHome                # (public)/page.tsx has one <h1>; root app/page.tsx removed
pnpm typecheck && pnpm lint
```

## 2. Visual verification (browser preview)

Open `/` at 375px and confirm the sections in order:

- **SC-001**: hero (tagline + orientation CTA) and the "new here?" orientation appear **before** any dance listing.
- **SC-002**: the next upcoming dances show, each linking to its detail; when none are scheduled, a clear empty-state message shows instead.
- **SC-004**: at most one optimized hero image, no carousel/slider, no video; the page is light.
- **SC-005**: no horizontal scroll; exactly one H1; WCAG AA contrast (via R1 tokens).
- **SC-006**: the old staff stub ("CDR Platform" + Contacts link) is gone.

Then widen the viewport and confirm the home enhances upward.

## 3. Footer is site-wide (SC-003)

- On `/` **and** `/whats-on`, `/join`, an event detail page: confirm the footer (org info + a couple of
  links + support/donate affordance) renders, and its links resolve.
- Confirm admin/door pages (e.g. `/gate`, `/checkin`) do **not** show the public footer.

## 4. Empty next-dances state

- With no upcoming dances in the schedule, confirm the home shows the empty-state message (not a blank
  region).

## Success criteria mapping

| Check | Criterion |
|-------|-----------|
| Orientation before listing | SC-001 |
| Next dances + empty state | SC-002 |
| Footer site-wide + support | SC-003 |
| One hero image, no carousel/video | SC-004 |
| 375px no-scroll, one H1, AA | SC-005 |
| Staff stub removed | SC-006 |
