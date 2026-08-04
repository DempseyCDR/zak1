# UI Contract: Public Navigation Menu

This feature exposes **no HTTP API**. Its contract is the UI/component surface below.

## Component: `PublicNav`

- **File**: `src/app/PublicNav.tsx`
- **Directive**: `"use client"` (needs `usePathname`)
- **Props**: none. It reads `PUBLIC_NAV` and the current path internally.
- **Rendered by**: the root layout (`src/app/layout.tsx`), inside `<body>` before `{children}` — so it appears on
  **every** page (public, admin, door) as the topmost bar.

### Rendered structure (contract)

- A single navigation landmark: `<nav aria-label="Site">` (label distinct from the volunteer nav's
  `aria-label="Main"` so assistive tech can tell the two bars apart on staff pages).
- A **home affordance** first: the club wordmark (e.g. "Country Dancers of Rochester") as a link to `/whats-on`
  (FR-006).
- One link per `PUBLIC_NAV` entry, in array order, each linking to `entry.href` with text `entry.label`.
- The link matching the current section carries `aria-current="page"` and a visible active style (FR-004).
- Links are keyboard-focusable in DOM order (native `<a>`/`next/link`); the landmark role makes the bar
  discoverable to screen readers (FR-008).

### Behavioral contract

| Given (pathname) | Then active entry |
|------------------|-------------------|
| `/whats-on` | What's On |
| `/whats-on/<eventId>` | What's On (parent section) |
| `/join` | Join |
| `/gate`, `/checkin`, any staff page | none of the public entries (menu still renders) |

- **Presentation only** (FR-005): the component performs **no** authorization; it renders the same public
  entries regardless of sign-in state. Access to any destination is enforced by that destination, not here.
- **Idempotent to sign-in state**: identical entries whether or not a volunteer is authenticated (FR-001). On
  staff pages the volunteer `<Nav/>` renders **after** this component (a second bar); this component does not
  render or depend on it.

## Data module: `PUBLIC_NAV`

- **File**: `src/app/publicNav.ts`
- **Export**: `export const PUBLIC_NAV: readonly { href: string; label: string }[]`
- **Contract**: ordered, hand-maintained, no duplicate `href`. Adding/removing/reordering an entry here is the
  **only** change required for the menu to update site-wide (FR-003 / SC-003). No `"use client"` directive, so it
  is importable from server or client code.

## Non-contract (explicitly out of scope)

- No generated/auto-discovered entries (deferred — B44).
- No volunteer/second-bar menu (P6-R2).
- No new route, endpoint, or persisted record.
