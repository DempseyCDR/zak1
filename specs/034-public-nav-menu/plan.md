# Implementation Plan: Public Navigation Menu

**Branch**: `034-public-nav-menu` | **Date**: 2026-08-04 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/034-public-nav-menu/spec.md`

## Summary

Add a single, hand-maintained public navigation menu that renders at the **top of every page** of the site —
public and volunteer (admin/door) alike — as the topmost bar (Clarifications 2026-08-04, option A). It launches
with two entries, **What's On** (home) and **Join**, plus the club wordmark as the home affordance, marks the
current section active, is responsive and accessible, and is **presentation only** (never an access control).

Technical approach: render the menu once from the **root layout** (`src/app/layout.tsx`) — the only frame that
wraps every route group — so it appears everywhere by construction and, on staff pages, sits **above** the
existing volunteer `<Nav/>` with no change to the admin/door layouts. The menu is a small client component
(`"use client"`) because active-state needs the current path (`usePathname`); its entries come from one
hand-maintained typed array. The redundant wordmark header in the `(public)` layout is removed. No API, no
database, no migration.

## Technical Context

**Language/Version**: TypeScript 5.7 (strictest flags)

**Primary Dependencies**: Next.js 16.2.10 (App Router, RSC), React 19.2, `next/link`, `next/navigation`
(`usePathname`)

**Storage**: N/A — the entry list is a static, hand-maintained module (no DB, no migration; generation deferred
to backlog B44)

**Testing**: Vitest + React Testing Library / jest-dom in **jsdom** component tests (`tests/**/*.test.tsx`, the
feature-020 harness) — this is a pure UI feature, so no Postgres/integration test is needed

**Target Platform**: Web — server-rendered pages with a small client island for active-state

**Project Type**: Web application (single Next.js App Router project; not split frontend/backend)

**Performance Goals**: Negligible — static nav, no data fetch, no added request cycle

**Constraints**: Presentation only (non-authz, FR-005); responsive (all entries reachable on mobile, FR-008);
accessible (nav landmark, keyboard, `aria-current`, FR-008)

**Scale/Scope**: 2 entries today; a handful expected long-term. One new component + one entries module; edits to
the root layout and the `(public)` layout

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Test-First (NON-NEGOTIABLE)** — PASS. Component tests (jsdom/RTL) for `PublicNav` are written first:
  renders both entries + wordmark, active-state per `usePathname`, `aria-current`, keyboard/landmark a11y. Red →
  green → refactor. This mirrors the 020 component-test pattern.
- **II. Simplicity / YAGNI** — PASS. A hand-maintained typed array + one small component rendered from the root
  layout. **No** generation-from-source, **no** nav framework, **no** abstraction shared with the volunteer
  `Nav` (different concerns: capabilities vs. static public list — three-similar-lines over premature
  abstraction). Generation is explicitly deferred to B44.
- **III. Type Safety** — PASS. Entries are a typed `{ href: string; label: string }[]`. No external boundary is
  crossed (static data, no API/DB), so no Zod schema is required (Zod governs API boundaries, of which this adds
  none).
- **IV. Observability** — PASS (N/A). No new HTTP request/response cycle, no server mutation, no external call —
  nothing to log or trace. The component is a client render of static links.

**Result**: All gates pass. Complexity Tracking is empty (no violations).

## Project Structure

### Documentation (this feature)

```text
specs/034-public-nav-menu/
├── plan.md              # This file (/speckit-plan output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── public-nav.md    # Phase 1 output — UI/component contract
├── checklists/
│   └── requirements.md  # /speckit-specify output (spec quality)
└── tasks.md             # /speckit-tasks output (NOT created here)
```

### Source Code (repository root)

```text
src/app/
├── layout.tsx                 # EDIT — render <PublicNav/> in <body> before {children} (topmost, every page)
├── publicNav.ts               # NEW  — hand-maintained PUBLIC_NAV: { href, label }[] (single source, FR-003)
├── PublicNav.tsx              # NEW  — "use client" menu: wordmark + entries, active via usePathname, a11y
├── (public)/layout.tsx        # EDIT — remove the now-redundant wordmark header (PublicNav supplies it)
├── (admin)/layout.tsx         # UNCHANGED — <Nav/> volunteer menu now renders beneath the root PublicNav
└── (door)/layout.tsx          # UNCHANGED — same

tests/component/
└── publicNav.test.tsx         # NEW — jsdom/RTL: entries, wordmark, active-state, a11y (written FIRST)
```

**Structure Decision**: Single Next.js App Router project. The menu is injected once at the **root layout** so
"every page" (clarification A) is satisfied structurally rather than by touching each route group. `PublicNav` is
a client component solely because active-state reads `usePathname`; its data is a static typed array in
`publicNav.ts`. The `(admin)`/`(door)` layouts are deliberately **untouched** — their existing `<Nav/>` already
renders after the root menu, yielding "public bar on top, volunteer bar beneath" for free (the volunteer bar's
own rework is P6-R2).

## Complexity Tracking

> No Constitution Check violations — table intentionally empty.
