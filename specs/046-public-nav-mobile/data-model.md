# Phase 1 Data Model: Public nav, small-screen pattern

**No database schema changes.** No tables, columns, enums, or migrations. This feature is presentation only.

## Existing data (unchanged)

- **`PUBLIC_NAV`** (`src/app/publicNavItems.ts`): the hand-maintained, ordered list of public destinations
  `{ href, label }[]`. **Unchanged** — this feature does not add, remove, reorder, or regroup entries
  (FR-008). The home/wordmark affordance remains component-rendered (not a list entry), and detail routes
  are not entries.

## Transient UI state (client, not persisted)

- **`open: boolean`** — whether the mobile disclosure panel is expanded. Local `PublicNav` state; default
  `false`. Reflected to assistive tech via the toggle's `aria-expanded`. Transitions:
  - toggle click / Enter / Space → flip `open`
  - Escape (when open) → `open = false`, focus returns to the toggle
  - route change (`usePathname` change) → `open = false`
  Above the 768px breakpoint the state is visually irrelevant (CSS shows the inline bar regardless).

## Presentation states (CSS, driven by viewport + `open`)

| Viewport | State | Presentation |
|----------|-------|--------------|
| < 768px | closed (default) | compact bar: wordmark + labeled toggle; panel hidden |
| < 768px | open | compact bar + flat destination panel revealed |
| < 768px | no-JS | panel revealed (noscript fallback) — reachable without the toggle |
| ≥ 768px | any | inline bar (wordmark + destinations); toggle hidden |

## Validation rules (enforced by tests)

- The toggle exposes `aria-expanded` matching `open`; it is a labeled control.
- All `PUBLIC_NAV` links + the wordmark are present in the DOM in every state (kept queryable; 034 test).
- Escape closes an open panel and returns focus to the toggle; a route change closes it.
- Active-destination indication (`aria-current`) is preserved (unchanged from 034).
