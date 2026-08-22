# Implementation Plan: Public design tokens & mobile-first foundation (P7-R1)

**Branch**: `045-public-design-tokens` | **Date**: 2026-08-22 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/045-public-design-tokens/spec.md`

## Summary

Introduce the app's first styling layer: an **app-wide CSS-variable token set** (brand colors, type scale,
spacing, event-type colors) plus base element styling, delivered through a single global stylesheet and
brand fonts loaded via `next/font`. Apply it **public-first** — restyle the existing `(public)` pages and
their shared components onto the tokens using **CSS Modules**, removing today's ad-hoc inline styles —
while admin/door/volunteer surfaces stay visually unchanged. Bake the WCAG-AA floor into the tokens
themselves (link colors that pass on both the cream and steel-blue backgrounds, so the audit's
peach-on-blue combination is never shipped) and keep heading discipline (one H1 per page). Provide the
event-type color coding as single-source tokens + a typed map for later listing work (R4).

**No database, migration, or API changes** — this is a pure front-end foundation (delivery mechanism
decided in Clarifications: hand-rolled CSS variables + CSS Modules; Tailwind deferred).

## Technical Context

**Language/Version**: TypeScript 5.7 (strict), React 19, Next.js 16 App Router.

**Primary Dependencies**: Next.js built-ins only — native **global CSS** import + **CSS Modules**
(`*.module.css`) and **`next/font/google`** (Raleway, Open Sans). **No new dependency** (no Tailwind, no
PostCSS — App Router handles both CSS paths with zero config).

**Storage**: None. No schema change; the event-type→color mapping is a code constant (research R2), not a
DB column.

**Testing**: Vitest — `tests/unit/*` for pure token/contrast logic (WCAG ratios computed from the shipped
`:root` values), `tests/component/*.test.tsx` (jsdom, existing harness) for heading structure and that
restyled components use module classes rather than inline sizing. Visual/responsive proof via the browser
preview (375px screenshots).

**Target Platform**: Public website, mobile-first (~375px), progressive up.

**Project Type**: Web app (Next.js App Router); this feature touches the `src/app` presentation layer only.

**Performance Goals**: No JS added to the public bundle (tokens are CSS; components stay server
components). Fonts self-hosted via `next/font` (no external request; CSP-safe). Global CSS is a few KB.

**Constraints**: WCAG AA contrast for every text/UI token pair; no horizontal scroll at 375px; body text
≥16px; exactly one H1 per public page; admin/door/volunteer visually unchanged; no new public pages/content
(a real footer is R3, not here).

**Scale/Scope**: One global stylesheet, one font setup, one layout primitive, ~2 shared public components
(`ScheduleList`, `SeriesFilter`) + 4 public pages restyled, one typed color-map module, two test files.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment |
|-----------|------------|
| **I. Test-First (NON-NEGOTIABLE)** | PASS (planned). Tests written first: a **unit test parses the shipped `:root` tokens and asserts every text/UI pair meets WCAG AA** (≥4.5:1 normal, ≥3:1 large/UI) — directly encoding FR-005/SC-002, incl. link-on-cream and link-on-steel-blue; a unit test asserts the event-type color map is complete and single-source (FR-007). Component tests (jsdom) assert one H1 per public page (FR-006) and that restyled components carry module classes, not inline `maxWidth` (FR-009). |
| **II. Simplicity / YAGNI** | PASS. CSS variables + CSS Modules over a framework (Clarifications); no DB column for series color (a fixed brand constant, not admin-editable data — research R2); no footer built (deferred to R3); only existing public pages restyled. Tokens defined once, app-wide, so admin reuses them later with no rework. |
| **III. Type Safety** | PASS. Strict TS. The event-type→color map is a typed constant keyed by the event-type union; the contrast helper is a pure typed function. No `any`. |
| **IV. Observability** | N/A (honest). This feature adds no request/response cycle, no data writes, and no external calls — the observability provisions (structured request logs, error reporting, write metrics) have nothing to attach to. Existing logging is untouched; no ad-hoc logging is introduced. |

**Development Workflow**: Multi-contributor mode (constitution v1.3.0) — developed on `045-public-design-tokens`,
lands via a **reviewed PR** (no self-merge); the full gate suite (tests, tsc, lint, format, build,
Constitution Check) must pass first. No Complexity Tracking entries (no violations).

## Project Structure

### Documentation (this feature)

```text
specs/045-public-design-tokens/
├── plan.md              # This file
├── research.md          # Phase 0 output (D-2 series-color storage; footer/H1 scope; contrast pairs; single-source strategy)
├── data-model.md        # Phase 1 output (no schema; the token/color-map "model")
├── quickstart.md        # Phase 1 output (verify tokens/contrast/responsive/scoping)
├── contracts/
│   └── design-tokens.md  # The token vocabulary + Container primitive + event-type map that later pages consume
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
src/app/
├── globals.css                     # NEW: single source of :root tokens (colors, type scale, spacing, --type-*) + base element styles (body, headings, links, :focus-visible)
├── layout.tsx                      # import globals.css; load Raleway + Open Sans via next/font/google; set font CSS vars on <html>; drop the inline body font style
├── tokens.ts                       # NEW: typed EVENT_TYPE_COLORS map (event-type → "var(--type-*)") for later consumers (R4); no hex duplication
├── (public)/
│   ├── _components/
│   │   ├── Container.tsx + Container.module.css     # NEW layout primitive (mobile-first max-width/padding) replacing inline <main style={{maxWidth}}>
│   │   ├── ScheduleList.tsx (+ .module.css)         # restyle onto tokens/module classes
│   │   └── SeriesFilter.tsx (+ .module.css)         # restyle onto tokens/module classes
│   ├── whats-on/page.tsx                            # use <Container>; drop inline padding/maxWidth
│   ├── what-was-on/page.tsx                         # same
│   ├── whats-on/[eventId]/page.tsx                  # same
│   └── join/page.tsx                                # same
└── lib/contrast.ts                 # NEW: pure WCAG contrast-ratio helper (relative luminance) used by the token test

tests/
├── unit/designTokens.contrast.test.ts   # parse globals.css :root → assert AA on every text/UI pair; assert EVENT_TYPE_COLORS complete
└── component/publicDesign.test.tsx        # one H1 per public page; restyled components use module classes, not inline maxWidth
```

**Structure Decision**: Presentation-layer change under `src/app`. Tokens live once in `src/app/globals.css`
(imported by the root layout so they are in effect app-wide, satisfying the shared-with-admin intent) while
**visual application is confined to the `(public)` group**. Components use co-located CSS Modules; the
event-type color map is a typed constant in `src/app/tokens.ts`. No server/domain/db code is touched.

## Complexity Tracking

> No Constitution Check violations — table intentionally empty.
