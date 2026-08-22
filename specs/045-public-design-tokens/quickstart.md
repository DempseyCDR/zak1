# Quickstart: Public design tokens & mobile-first foundation

Validation/run guide. Implementation lives in `tasks.md` + code; this proves the feature end-to-end.

## Prerequisites

- Dependencies installed (`pnpm install`). No new runtime dependency is added by this feature.
- The dev server builds (the first build fetches the `next/font` Google fonts once).

## 1. Automated checks (write tests first — constitution Test-First)

```bash
pnpm test:unit -- designTokens        # parses globals.css :root; asserts WCAG AA on every text/UI pair; EVENT_TYPE_COLORS complete
pnpm test -- publicDesign             # jsdom: one <h1> per public page; restyled components use module classes, not inline maxWidth
pnpm typecheck && pnpm lint
```

**Expected**: contrast test passes for the shipped token values (it will FAIL first if `--link` is left at
the audit's `#b96131`, which is 3.82:1 on cream — the point of the test); heading/structure tests pass.

## 2. Visual + responsive verification (browser preview)

Start the dev server and view the public pages at a phone width:

- `/whats-on`, `/what-was-on`, `/whats-on/<eventId>`, `/join`.

Check, at **375px**:

- **SC-001**: pages render with the cream ground, brand link/heading colors, and Raleway/Open Sans — not
  browser defaults.
- **SC-004**: no horizontal scrolling; body text ≥16px.
- **SC-003**: exactly one H1 per page (inspect the heading outline).
- **SC-006**: no inline `maxWidth`/sizing remains — pages use `Container`.

Then widen the viewport and confirm the layout **enhances upward** (comfortable reading width) from the
same system.

## 3. Accessibility spot-check (SC-002)

- Run a contrast checker (or the unit test above) over the rendered public pages; confirm every text/UI
  element meets WCAG AA, including link-on-cream and any link on a steel-blue band.
- Confirm the audit's losing pairings are absent: no terracotta `#b96131` link on cream, no peach link on
  steel, no normal-size text on `--type-meeting`.

## 4. Scope check (SC-007)

- Open an admin and a door page (e.g. `/gate`, `/checkin`, `/payments`) and confirm they look **exactly as
  before** — the tokens are defined app-wide but only the public group was restyled.

## Success criteria mapping

| Check | Criterion |
|-------|-----------|
| Public pages branded + fonts | SC-001 |
| AA contrast everywhere (incl. links) | SC-002 |
| One H1, honest nesting | SC-003 |
| 375px, no h-scroll, ≥16px body | SC-004 |
| Event-type colors single-source | SC-005 |
| No ad-hoc inline sizing | SC-006 |
| Admin/door unchanged | SC-007 |
