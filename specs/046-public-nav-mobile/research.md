# Phase 0 Research: Public nav, small-screen pattern

Format per decision: **Decision / Rationale / Alternatives**. The three UX choices (pattern, IA,
breakpoint) were settled in `/speckit-clarify` and are recorded in the spec; this file resolves the
*implementation* unknowns.

## R1. Disclosure mechanism — React-controlled button, not native `<details>`

**Decision**: Implement the mobile menu as a **React-controlled disclosure**: a labeled `<button>` with
`aria-expanded` + `aria-controls`, toggling local open state; the destination list is **always rendered in
the DOM** (a `<ul>`/`<nav>` panel) and shown/hidden via CSS. `PublicNav` is already a client component, so
this adds no new client boundary.

**Rationale**: The requirements need precise control the native element does not give cleanly — Escape to
close, focus return to the toggle, and close-on-route-change (FR-004). Crucially, native `<details>` hides
its content from the accessibility tree when closed, which would (a) break the existing feature-034
`publicNav.test.tsx` (it asserts every link is queryable) and (b) fight the "force inline at ≥768px"
override. Keeping the list in the DOM and hiding via CSS means jsdom (which applies no CSS) still sees all
links, so 034's tests stay green, and the responsive override is a plain media query.

**Alternatives**: `<details>`/`<summary>` (rejected — closed content leaves the a11y tree → 034 test
breakage + awkward ≥768 override, and no native Escape/focus-return); a hand-rolled ARIA `menu`/`menuitem`
widget (rejected — YAGNI; a disclosure of links is a navigation region, not an application menu, so a
button + list is the correct, simpler pattern); CSS checkbox hack (rejected — non-semantic toggle).

## R2. Responsive switch at 768px — CSS media query, mobile-first

**Decision**: Mobile-first CSS in `PublicNav.module.css`: the default (small) styles render the compact bar
(wordmark + toggle) with the panel collapsed unless open; a `@media (min-width: 768px)` block hides the
toggle and shows the destination list **inline** regardless of open state (the desktop bar). The switch is
pure CSS — no JS reads the viewport.

**Rationale**: The breakpoint (768px, clarified) is presentational; doing it in CSS avoids hydration
mismatches and viewport-measuring JS, and keeps the desktop bar working with no interactivity.

**Alternatives**: JS `matchMedia` to branch markup (rejected — SSR/hydration mismatch risk + needless
complexity); container queries (rejected — the nav spans the viewport; a media query is the right tool).

## R3. No-JS / pre-hydration reachability (FR-005)

**Decision**: Because the list is always in the DOM (R1), destinations are present without JS. Add a
`<noscript>` style that reveals the panel (so a no-JS visitor sees the full flat list expanded), and at
≥768px the inline bar shows regardless. Navigation therefore never depends solely on the interactive
toggle.

**Rationale**: Satisfies FR-005 with a standard progressive-enhancement fallback; the toggle is an
enhancement over an already-reachable list. Pre-hydration, the list exists and becomes toggleable once
hydrated.

**Alternatives**: SSR-open-then-collapse-with-JS (rejected — flashes open on load or needs an inline
script); depend on hydration only (rejected — fails FR-005 for no-JS).

## R4. Token scope — the shared nav consumes app-wide tokens

**Decision**: `PublicNav.module.css` styles the bar/toggle/panel/links from the **app-wide `:root` tokens**
defined in R1's `globals.css` (`--link`, `--text`, `--surface`/`--ground`, `--hairline`, `--font-*`,
`--space-*`). `PublicNav` renders from the **root** layout (outside R1's public element-scope), which is
fine because the tokens are global; only R1's element *styling* is scoped to `(public)`. The bar is shared
chrome, so its tokenized look now also appears atop admin/door pages — intended (spec FR-009, edge case).

**Rationale**: Single source of design values; no duplication; consistent with R1. The nav is deliberately
the one shared surface R1 left alone (R1 scoped element styles to public and deferred the nav to this
feature).

**Alternatives**: Hard-code colors in the nav CSS (rejected — off-token, drift); apply R1's public wrapper
to the nav (rejected — it is not inside `(public)` and must render on all pages).

## R5. Testing approach

**Decision**: New jsdom component test `tests/component/publicNav.mobile.test.tsx` (RTL, mocking
`next/navigation` + `next/link` as the 034 test does): the toggle button starts `aria-expanded="false"`,
click sets it `true`, Escape sets it back and focus returns to the toggle, and rendering with a changed
`usePathname` collapses it. The existing `publicNav.test.tsx` is kept unchanged and green (links always in
the DOM). Touch-target size (≥44px), the 768px switch, no-scroll at 375px, and the two-bar stack are
**browser-preview** checks (jsdom has no layout/CSS engine), documented in quickstart.

**Rationale**: Tests what jsdom can prove (state/ARIA/focus/behavior) and defers layout facts to the real
browser — the same split used successfully in R1.

**Alternatives**: jsdom assertions on computed sizes/media queries (rejected — jsdom applies no CSS, so
such assertions are meaningless).
