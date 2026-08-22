# Implementation Plan: Public nav, small-screen pattern (P7-R2)

**Branch**: `046-public-nav-mobile` | **Date**: 2026-08-22 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/046-public-nav-mobile/spec.md`

## Summary

Give the shared public navigation (`PublicNav`) a mobile presentation: below **768px** a compact bar
(site wordmark + a labeled disclosure toggle) reveals the full destination list as a **flat** panel; at
≥768px it stays the inline bar. Styled from the P7-R1 design tokens via a CSS Module, fully keyboard- and
screen-reader-operable (`aria-expanded`, Escape, focus return, close-on-navigate), with ≥44px touch
targets and no horizontal scroll at 375px. The signed-in volunteer bar continues to render beneath it and
must not collide. **Presentation only** — the hand-maintained `PUBLIC_NAV` destination list is unchanged;
**no DB, API, or migration.** Stacked on the (unmerged) P7-R1 work (feature 045) for the tokens.

## Technical Context

**Language/Version**: TypeScript 5.7 (strict), React 19, Next.js 16 App Router.

**Primary Dependencies**: Next.js built-ins only — CSS Modules + the existing `next/navigation`
(`usePathname`) already used by `PublicNav`. **No new dependency.**

**Storage**: None. `PUBLIC_NAV` (`src/app/publicNavItems.ts`) is a static hand-maintained array, unchanged.

**Testing**: Vitest jsdom component tests (RTL) for disclosure behavior; the existing feature-034
`tests/component/publicNav.test.tsx` (link presence, active-state, single-source) MUST stay green. Touch
sizing, the 768px switch, and no-scroll are browser-preview checks (no layout engine in jsdom).

**Target Platform**: Public website, shared chrome on every page, mobile-first.

**Performance Goals**: No new client dependency; `PublicNav` is already a client component. Menu open/close
is local state, no network.

**Constraints**: WCAG AA (via R1 tokens); ≥44px targets; one compact row at 375px, no horizontal scroll;
keyboard + screen-reader operable; destinations reachable without JS; admin/door still render the shared
bar (its new look is intended, spec FR-009).

**Scale/Scope**: One component restyle (`PublicNav.tsx` + a new CSS Module), a small client disclosure
(open state, Escape, close-on-route-change, focus return), one new component test file; the existing 034
test is preserved.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment |
|-----------|------------|
| **I. Test-First (NON-NEGOTIABLE)** | PASS (planned). New jsdom component test written first: toggle is a labeled button that starts collapsed (`aria-expanded=false`), opens on click (`aria-expanded=true`), Escape closes it and returns focus to the toggle, and a route change (changed `usePathname`) closes it. The 034 test (all links present, active-state, single-source) is kept green. Sizing/responsive/no-scroll are browser-verified (quickstart). |
| **II. Simplicity / YAGNI** | PASS. A React-controlled disclosure over a hand-rolled ARIA menu widget; a **flat** list (no grouping); reuse `PUBLIC_NAV` + R1 tokens + existing `usePathname`; native CSS media query for the 768px switch; no new dependency. |
| **III. Type Safety** | PASS. Strict TS; typed component + nav item type unchanged; no `any`. |
| **IV. Observability** | N/A (honest). Presentation only — no request cycle, data write, or external call for the observability provisions to attach to. |

**Development Workflow**: Multi-contributor mode — developed on `046-public-nav-mobile` (stacked on `045`),
lands via a **reviewed PR** (no self-merge) once its gate suite passes. Because it is stacked, its PR
targets `main` after R1 merges (or is rebased). No Complexity Tracking entries.

## Project Structure

### Documentation (this feature)

```text
specs/046-public-nav-mobile/
├── plan.md
├── research.md          # Phase 0 (disclosure mechanism, 768px switch, no-JS, token scope, testing)
├── data-model.md        # Phase 1 (no schema; the nav's transient UI state + unchanged PUBLIC_NAV)
├── quickstart.md        # Phase 1 (verify disclosure a11y, 375px/≥768px, both bars)
├── contracts/
│   └── public-nav.md    # UI contract: presentation states + disclosure a11y + no-JS reachability
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
src/app/
├── PublicNav.tsx                  # restyle: compact bar + disclosure toggle <768; inline ≥768; open state,
│                                  #   Escape, close-on-route-change, focus return; styled via CSS Module + tokens
├── PublicNav.module.css           # NEW: nav bar, toggle (≥44px), panel, 768px media query, :focus-visible
└── publicNavItems.ts              # UNCHANGED (destinations + single source)

tests/component/
├── publicNav.test.tsx             # feature 034 — kept green (links present, active-state, single-source)
└── publicNav.mobile.test.tsx      # NEW: disclosure behavior (toggle/aria-expanded/Escape/close-on-nav/focus)
```

**Structure Decision**: A single shared component (`PublicNav.tsx`) restyled with a co-located CSS Module
that consumes the app-wide `:root` tokens from R1 (the tokens are global; only R1's *element* styling is
public-scoped, so the root-rendered nav uses them directly). No server/domain/db code is touched; the
volunteer `Nav`/`VolunteerNav` are not modified (only the CSS must let the two bars stack without collision).

## Complexity Tracking

> No Constitution Check violations — table intentionally empty.
