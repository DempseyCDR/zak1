# Implementation Plan: Series landing pages (P7-R6)

**Branch**: `050-series-landing` | **Date**: 2026-08-23 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/050-series-landing/spec.md`

## Summary

One rich, welcoming landing page per dance style (**contra**, **English**, **community/family**) that migrates
the club's own voice — what the style is, why you'll love it, what to expect (no partner needed, dress,
etiquette, and the style's role/gendered-language approach — contra/community use Larks/Robins, English uses
traditional men's/women's terms) — and then shows **that style's upcoming dances** using the shared
P7-R4 cards, with a representative photo (the P7-R5 `seriesHero`) and the series' color accent. A single dynamic
route `/dances/[style]` reads a typed, **committed content registry** (hand-built copy, clarified) keyed by
style; `generateStaticParams` publishes the three covered styles and `notFound()` guards the rest. The style's
upcoming dances come from the existing `getPublicSchedule(db, from, seriesKey)` — **no new query, no schema, no
migration**. Roster (R9), gallery (R11), and pricing/standing-schedule (R10) are out of scope; the page links to
them when they exist. Built on 045 tokens, 046 nav, 048 cards + `seriesColor`, and 049 `seriesHero`.

## Technical Context

**Language/Version**: TypeScript 5.7 (strict), React 19, Next.js 16 App Router (RSC).

**Primary Dependencies**: Next.js built-ins (dynamic route + `generateStaticParams`, CSS Modules); the existing
`getPublicSchedule` read; reused public components `EventHero` (049), `ScheduleList` (048), `Container` (045),
and the `seriesColor` map (048). **No new dependency.**

**Storage**: PostgreSQL — **no schema change / no migration**. The only read is `getPublicSchedule(db,
undefined, seriesKey)` (feature 037), already series-filterable. The landing copy is committed content, not
stored data.

**Testing**: Vitest — a **unit** test for the content registry (`getStyleLanding`: the three slugs, their
series-key mapping, required sections; unknown → null); a jsdom **component** test for the pure prose renderer
(`LandingSections` — renders what-it-is / why-you'll-love / what-to-expect incl. "no partner needed", no `<h1>`).
The full page (async RSC reading the DB for the schedule) is **browser-verified** (as in 048/049). The
series-filter read itself is already covered by `publicSchedule.test.ts`.

**Target Platform**: Public website, mobile-first; the newcomer growth-funnel pages.

**Performance Goals**: Server component; one series-filtered schedule read per page (reused). Statically
paramable (`generateStaticParams`) — the three pages can prerender.

**Constraints**: WCAG AA (series color as accent only); no horizontal scroll at ~375px; exactly one H1 per page;
the copy is migrated (voice preserved), not rewritten.

**Project Type**: Web application (Next.js App Router), public route group `(public)`.

**Scale/Scope**: A dynamic route + a typed content registry (3 styles), one pure prose component, three PUBLIC_NAV
entries, and reuse of the hero/cards/schedule read. 1 unit + 1 component test + browser verification.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment |
|-----------|------------|
| **I. Test-First (NON-NEGOTIABLE)** | PASS (planned). Tests first: unit — `getStyleLanding` returns the three styles with the right `seriesKey` (contra→tnc, english→ecd, community→community_dance) and the required sections, and `null` for an unknown slug; component — `LandingSections` renders the migrated prose (incl. "no partner needed", dress, etiquette, and the style's role terminology) and no `<h1>`. Full-page render, upcoming-dances wiring, nav reachability, 375px/one-H1 are browser-verified. |
| **II. Simplicity / YAGNI** | PASS. One dynamic route + a committed content registry (no CMS — clarified); reuse `getPublicSchedule` (series filter exists), `EventHero`, `ScheduleList`, `seriesColor` (**no new query, no schema, no migration**); three styles only (no `general`); no roster/gallery/pricing here (R9/R11/R10). |
| **III. Type Safety** | PASS. A typed `StyleLanding` content model + `getStyleLanding(slug): StyleLanding \| null`; `seriesKey` typed; no `any`. |
| **IV. Observability** | N/A (honest). Static content + one reused read; no new write, request cycle, or external call. |

**Development Workflow**: Multi-contributor mode — developed on `050-series-landing`, **stacked on
`049-event-detail`** (needs 048 cards + 049 `seriesHero`), lands via a **reviewed PR** (no self-merge) after the
gate suite passes. No Complexity Tracking entries.

## Project Structure

### Documentation (this feature)

```text
specs/050-series-landing/
├── plan.md
├── research.md          # Phase 0 (route/registry shape, content model, reuse, nav, testing)
├── data-model.md        # Phase 1 (StyleLanding content model + registry; no DB entity; no migration)
├── quickstart.md        # Phase 1 (verify the three pages, upcoming dances, color match, nav, 375px)
├── contracts/
│   └── series-landing.md # UI contract: the landing page's content/behavior
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
src/app/(public)/dances/[style]/
├── page.tsx                        # async server page: resolve style → content (else notFound);
│                                   #   EventHero + <h1> (series accent) + LandingSections + upcoming dances
│                                   #   (getPublicSchedule(db, undefined, seriesKey) → ScheduleList);
│                                   #   generateStaticParams → the three covered styles
├── landingContent.ts               # NEW: typed StyleLanding registry (slug → { seriesKey, title, intro,
│                                   #   whyYoullLove, whatToExpect }) + getStyleLanding(slug) + STYLE_SLUGS.
│                                   #   Hand-built committed copy (migrated voice), edited here without logic.
└── styleLanding.module.css         # page layout + title series-color accent (mirrors eventDetail)

src/app/(public)/_components/
└── LandingSections.tsx + .module.css # NEW: pure prose renderer (what-it-is / why-you'll-love / what-to-expect)

src/app/publicNavItems.ts            # add the three landing entries (Contra / English / Community) to PUBLIC_NAV

tests/
├── unit/styleLanding.test.ts         # NEW: registry — slugs, seriesKey mapping, sections; unknown → null
└── component/landingSections.test.tsx # NEW: prose renders (incl. "no partner needed"); no <h1>
```

**Structure Decision**: One dynamic route `/dances/[style]` driven by a typed committed content registry keeps
the three pages DRY and the copy editable in one data file without touching logic (the clarified "hand-built
committed content"). The hero reuses `EventHero` (same per-series photo + color as the event detail), and the
upcoming-dances section reuses `getPublicSchedule` + `ScheduleList` — so a style's card looks identical here,
on `/whats-on`, and on the event page. The pure `LandingSections` component isolates the migrated prose for a
jsdom test; the async page (DB read) is browser-verified, matching 048/049.

## Complexity Tracking

> No Constitution Check violations — table intentionally empty.
