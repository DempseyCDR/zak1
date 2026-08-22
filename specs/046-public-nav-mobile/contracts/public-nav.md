# Contract: Public navigation presentation

The interface this feature presents to visitors (and the shape later Phase 7 nav growth relies on). No
HTTP/API surface — the contract is the nav's presentation states and its accessibility guarantees.

## Presentation states

- **< 768px, closed**: a compact bar — the site wordmark/home affordance + a labeled menu **toggle**. The
  destination panel is hidden.
- **< 768px, open**: the toggle reveals a **flat** list of all `PUBLIC_NAV` destinations in a disclosure
  panel.
- **≥ 768px**: the **inline bar** — wordmark + destinations in a row; the toggle is not shown. (No
  functional regression from today's desktop nav.)
- **No-JS**: the destination list is reachable (a `<noscript>` fallback reveals the panel); navigation
  never depends solely on the interactive toggle.

## Accessibility contract

- The toggle is a **labeled button** exposing **`aria-expanded`** (and `aria-controls` for the panel).
- The menu is **fully keyboard operable**: open/close via the toggle, traverse the links, **Escape**
  closes an open panel and **returns focus** to the toggle; a visible focus indicator throughout.
- Every control/link presents a touch target **≥ 44×44px** on touch screens.
- All nav text/controls meet **WCAG AA** contrast (via the P7-R1 tokens).
- The active destination remains indicated (`aria-current="page"`), unchanged from feature 034.

## Invariants (unchanged from feature 034)

- Rendered from the **root layout on every page** (shared chrome) as `<nav aria-label="Site">`; the
  volunteer `<nav aria-label="Main">` renders beneath it when signed in and the two MUST NOT collide.
- Destinations come from the single hand-maintained `PUBLIC_NAV`; presentation only — the nav makes **no
  authorization decision** and issues no data fetch.
- No horizontal scrolling at 375px; the pattern stays tidy as `PUBLIC_NAV` grows to ~10 entries.

## Scope boundary

Presentation/layout only. No change to destinations, information architecture content, other pages, or the
admin/door surfaces beyond the shared bar they already render.
