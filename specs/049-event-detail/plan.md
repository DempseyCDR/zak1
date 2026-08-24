# Implementation Plan: Event detail page enrichment (P7-R5)

**Branch**: `049-event-detail` | **Date**: 2026-08-23 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/049-event-detail/spec.md`

## Summary

Turn `/whats-on/[eventId]` from a thin data dump into a real, shareable public event page, styled with the
P7-R1 tokens and **color-coded by series to match the R4 cards**: a hero image, the series + date/time, a venue
block (name + tappable map link), the price, the confirmed lineup (bands grouped with their members, plus
callers, with a "to be announced" empty state), and the description. Two small **projection additions** to
`getPublicEventDetail` — `seriesKey` (for the color treatment + hero, the query already joins `series`) and
`members` on each band block (the roster `getBand` already loads but the display grouping currently discards) —
carry the data the page needs. **No migration.** The hero is a **per-series default static asset** (a
`seriesHero` map parallel to R4's `seriesColor`), degrading to a clean header when a series has no image. The
directions note is deferred to R8; instruments are not in the data model today, so members render by name.

## Technical Context

**Language/Version**: TypeScript 5.7 (strict), React 19, Next.js 16 App Router (RSC).

**Primary Dependencies**: Next.js built-ins (`next/image`, `next/link`, CSS Modules); the existing
`getPublicEventDetail` read; R1 `EVENT_TYPE_COLORS` + the R4 `seriesColor` map (feature 048, present on this
stacked branch). **No new dependency.**

**Storage**: PostgreSQL — **no schema change / no migration**. `getPublicEventDetail` gains `series.key` in its
`SELECT`; each band block gains `members`, mapped from the roster `getBand` already returns inside
`groupEventBookingsForDisplay`.

**Testing**: Vitest — a **unit** test for the `seriesHero` map; jsdom **component** tests for the hero (image vs.
clean header) and the lineup (bands + members + callers + "to be announced"); an **integration** test (real
Postgres) proving `getPublicEventDetail` carries `seriesKey` and band `members` for a confirmed band, and that
confirmed-only still holds. The full-page render (async RSC reading the DB) is a **browser-preview** check.

**Target Platform**: Public website, mobile-first; the shareable event page behind every R4 card.

**Performance Goals**: Server component; the enrichment adds one selected column + reuse of an already-fetched
roster — no new query. `next/image` for the hero.

**Constraints**: WCAG AA (series color used as an accent, never behind normal text — R1/R4 rule); no horizontal
scroll at ~375px; exactly one H1; confirmed-bookings-only (018) and the cancelled marker (018/B25) retained.

**Project Type**: Web application (Next.js App Router). Public route group `(public)`.

**Scale/Scope**: Two projection additions (`seriesKey`, band `members`), a `seriesHero` map, three focused
presentational components (hero, venue block, lineup) composed by the enriched page, a richer stylesheet, and
1 unit + 2 component + 1 integration test.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment |
|-----------|------------|
| **I. Test-First (NON-NEGOTIABLE)** | PASS (planned). Tests first: unit — `seriesHero` map (mapped series → asset path; unmapped → null); component — the hero (mapped series renders an image; unmapped renders a clean header, no broken `<img>`), the lineup (a band with its members + a caller render; no confirmed lineup → "to be announced"; no `<h1>`); integration (real Postgres) — `getPublicEventDetail` carries `seriesKey` + band `members` and still excludes non-confirmed bookings. Full-page 375px/no-scroll/one-H1 is browser-verified. |
| **II. Simplicity / YAGNI** | PASS. Reuse `getPublicEventDetail` (+1 column, +members mapped from an already-loaded roster — **no new query, no migration**); a per-series code constant for the hero (no DB image storage, D-4); no upload substrate; no instrument field (not in the model — members render by name); directions note deferred to R8; no new pages. |
| **III. Type Safety** | PASS. `PublicEventDetail` gains typed `seriesKey: string`; `PublicBandBlock` gains `members: { name: string; isLead: boolean }[]`; the `seriesHero` map is typed; no `any`. |
| **IV. Observability** | N/A (honest). A read-projection tweak + presentation; no new write, request cycle, or external call. |

**Development Workflow**: Multi-contributor mode — developed on `049-event-detail`, **stacked on
`048-whats-on-cards`** (needs the R4 `seriesColor` map + PR #8 in flight), lands via a **reviewed PR** (no
self-merge) after the gate suite passes. No Complexity Tracking entries.

## Project Structure

### Documentation (this feature)

```text
specs/049-event-detail/
├── plan.md
├── research.md          # Phase 0 (projection additions, series-hero map, lineup shape, instruments/directions boundaries)
├── data-model.md        # Phase 1 (PublicEventDetail +seriesKey; PublicBandBlock +members; series→hero map; no migration)
├── quickstart.md        # Phase 1 (verify the enriched page at 375px, hero, lineup, color match)
├── contracts/
│   └── event-detail.md  # UI contract: the page's content/behavior + the extended projection
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
src/server/domain/public/
└── publicSchedule.ts                          # getPublicEventDetail: +series.key (seriesKey);
                                               #   PublicEventDetail += seriesKey; PublicBandBlock += members
src/server/domain/bands/
└── publicDisplay.ts                           # BandBlock += members (from the roster getBand already returns)

src/app/(public)/_components/
├── seriesHero.ts                              # NEW: per-series → committed static hero path (unmapped → null)
├── EventHero.tsx + EventHero.module.css       # NEW: hero image (next/image) or a clean series-colored header
├── VenueBlock.tsx + VenueBlock.module.css     # NEW: venue name + tappable map link (img or anchor); directions slot (R8)
└── Lineup.tsx + Lineup.module.css             # NEW: bands grouped w/ members + callers; "to be announced" empty state

src/app/(public)/whats-on/[eventId]/
├── page.tsx                                   # compose hero + meta (series color) + venue block + lineup + description
└── eventDetail.module.css                     # richer, token-based page styling

public/series/                                 # committed per-series hero assets (D-4), e.g. tnc.webp (curated)

tests/
├── unit/seriesHero.test.ts                    # NEW: map path per series + null default
├── component/eventHero.test.tsx               # NEW: image vs clean header
├── component/lineup.test.tsx                  # NEW: bands+members+callers + "to be announced"
└── integration/publicEventDetail.detail.test.ts # NEW: seriesKey + band members + confirmed-only
```

**Structure Decision**: Extract three small pure presentational components (`EventHero`, `VenueBlock`,
`Lineup`) so each is independently jsdom-testable, and compose them in the existing async server page (which
reads the DB and cannot be jsdom-rendered — browser-verified, as in 048). The `seriesHero` map mirrors R4's
`seriesColor` (a co-located typed constant, no DB storage). The only server change is the two additive
projection fields — both already available in tables the read joins/loads.

## Complexity Tracking

> No Constitution Check violations — table intentionally empty.
