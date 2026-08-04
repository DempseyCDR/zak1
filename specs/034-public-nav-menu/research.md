# Phase 0 Research: Public Navigation Menu

All spec-level unknowns were resolved during `/speckit-clarify` (Session 2026-08-04). The remaining decisions are
technical, resolved below. No open `NEEDS CLARIFICATION` remain.

## R1 — Where to render the menu so it appears on every page

- **Decision**: Render `<PublicNav/>` once in the **root layout** (`src/app/layout.tsx`), inside `<body>` before
  `{children}`.
- **Rationale**: The root layout is the only frame that wraps **all** route groups — `(public)`, `(admin)`,
  `(door)`. Injecting there satisfies clarification A ("all pages, topmost bar") structurally, with no per-group
  edits, and cannot be forgotten when a new route group is added. On staff pages the existing `<Nav/>`
  (volunteer menu, rendered by the `(admin)`/`(door)` layouts) naturally falls **below** the root menu — the
  "public bar on top, volunteer bar beneath" outcome, for free.
- **Alternatives considered**:
  - *Add the menu to each route-group layout* — rejected: duplicates the render in three places and re-creates
    the D1 "forgot to update it" failure mode this feature exists to kill.
  - *Middleware / template* — rejected: unnecessary; layouts are the idiomatic App Router composition point and
    `postgres` is not edge-compatible (a constraint noted in feature 015).

## R2 — Server component vs. client component

- **Decision**: `PublicNav` is a **client component** (`"use client"`); its data (`PUBLIC_NAV`) is a plain typed
  module importable by either side.
- **Rationale**: Active-state (FR-004) requires the current path. In the App Router that is `usePathname()` from
  `next/navigation`, a **client** hook. The rest of the component is static. Keeping the entry array in a
  separate non-`"use client"` module (`publicNavItems.ts`) means a future server consumer (e.g. a generated menu,
  B44) can import it without pulling in the client boundary.
- **Alternatives considered**:
  - *Server component, no active-state* — rejected: FR-004 requires the current section be indicated.
  - *Pass pathname down from a server layout* — rejected: the layout is a server component and does not receive
    the pathname; `usePathname` in a small client island is the standard, minimal solution.

## R3 — Active-section matching rule

- **Decision**: An entry is active when `pathname === entry.href` **or** `pathname.startsWith(entry.href + "/")`.
- **Rationale**: Satisfies the edge case "on a listing's detail page, the parent section is active" — e.g. on
  `/whats-on/<eventId>` the **What's On** entry (`/whats-on`) is active. Exact-match alone would leave detail
  pages with nothing active; naive `startsWith(href)` would let `/joinX` match `/join`, so the trailing-slash
  guard (plus exact-match) is used.
- **Alternatives considered**: exact-match only (fails the detail-page edge case); `startsWith(href)` without the
  slash guard (false positives on sibling prefixes).

## R4 — Data shape and single-source property (FR-003)

- **Decision**: `export const PUBLIC_NAV: readonly { href: string; label: string }[]` in `src/app/publicNavItems.ts`,
  hand-maintained; the component maps over it. The **home/wordmark** affordance is rendered explicitly by the
  component (it is the club identity, not a list entry) linking to `/whats-on`.
- **Rationale**: One ordered array is the single edit point (FR-003, SC-003). `readonly` communicates it is
  static config. Keeping the wordmark separate from the entry list keeps FR-007 (detail routes / identity are not
  list entries) clean and matches the existing `(public)` layout's wordmark intent.
- **Alternatives considered**: encoding the home link as the first array entry (muddies "entries" vs. "identity"
  and complicates active-state for home); a DB/config table (explicitly deferred — B44, YAGNI).

## R5 — Testing approach

- **Decision**: A single **jsdom component test** (`tests/component/publicNav.test.tsx`), written first, using
  the feature-020 RTL harness. Mock `usePathname` from `next/navigation` per case to assert active-state.
- **Rationale**: This is a pure presentation feature with no server/DB surface; the component test is the right
  and only needed level (constitution I: test-first; the DB-no-mock rule governs integration tests, not UI). The
  "renders on every page" property is a structural guarantee of placing it in the root layout, not a per-page
  test.
- **Alternatives considered**: an integration/Postgres test (nothing to exercise); an e2e crawl of every page
  (out of proportion; the root-layout placement is the guarantee).

## R6 — Styling / responsiveness

- **Decision**: Inline styles consistent with the existing `Nav.tsx` / `(public)` layout (flex with
  `flexWrap: "wrap"`), so all entries remain reachable when they wrap on narrow screens (FR-008). No hamburger
  menu.
- **Rationale**: Two entries plus a wordmark never overflow a phone width; `flex-wrap` keeps every destination
  reachable without a collapse control (YAGNI — a hamburger is unwarranted at this scale). Matches the repo's
  current inline-style approach; no CSS framework is introduced.
- **Alternatives considered**: a collapsing hamburger menu (premature for two entries — revisit if the list
  grows, likely with B44).
