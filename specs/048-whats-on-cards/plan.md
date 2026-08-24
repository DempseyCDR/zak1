# Implementation Plan: `/whats-on` mobile-first event cards (P7-R4)

**Branch**: `048-whats-on-cards` | **Date**: 2026-08-22 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/048-whats-on-cards/spec.md`

## Summary

Restyle the shared public dance list from text rows into tappable **cards** — prominent date, start time,
venue short name, advertised price, a **whole-card link** to detail, a **series color accent** (P7-R1
palette), and the cancelled marker. Because the card needs data the public projection doesn't carry today,
add **two fields** to `PublicScheduleItem` (`seriesKey`, `venueShortName`) in the shared
`listPublicEvents` query — the series key already joined, the venue short name already on `venues`, so
**no migration**. Color comes from a **per-series → R1-color** code map (`tnc`→contra, `ecd`→english,
`community_dance`→special, `general`→assembly, unmapped→neutral). The `ScheduleList` change lands on
`/whats-on`, `/what-was-on`, and the home strip at once. Built on 045 (tokens) + 046 (nav), off `main`.

## Technical Context

**Language/Version**: TypeScript 5.7 (strict), React 19, Next.js 16 App Router.

**Primary Dependencies**: Next.js built-ins (CSS Modules, `next/link`), Drizzle (the existing
`listPublicEvents` query), the R1 `EVENT_TYPE_COLORS` map. **No new dependency.**

**Storage**: PostgreSQL — **no schema change / no migration**. `listPublicEvents` gains two columns in its
`SELECT` (`series.key`, `venues.short_name`) that are already present in the joined tables.

**Testing**: Vitest — a **unit** test for the series→color map; a jsdom **component** test for the card
(`EventCard`); an **integration** test (real Postgres) proving the projection carries `seriesKey` +
`venueShortName`; and an **update** to the existing `scheduleList.test.tsx` (fixtures gain the two fields;
assertions move to cards). Visual/responsive facts (above-the-fold, 375px, tap size) are browser-verified.

**Target Platform**: Public website, mobile-first, shared card everywhere the list renders.

**Performance Goals**: Server components (no client bundle added); the card is markup + CSS. One extra
join column each — negligible.

**Constraints**: WCAG AA (accent color used as border/marker, not behind text); ≥44px whole-card tap; no
horizontal scroll at 375px; one H1 per page (unchanged); `?series=` filter, cancelled marker, and
confirmed-only rule all retained.

**Scale/Scope**: One projection edit (+2 fields), a new `EventCard` (+ module) + a `seriesColor` map,
`ScheduleList` re-rendered as cards, and 3 new + 1 updated test. Applies to `/whats-on`, `/what-was-on`,
and the P7-R3 home strip via the shared component.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment |
|-----------|------------|
| **I. Test-First (NON-NEGOTIABLE)** | PASS (planned). Tests first: unit — the series→color map (`tnc`→contra … unmapped→neutral); component — `EventCard` renders a whole-card link to detail with prominent date/time/venue-short(+fallback)/price, cancelled marker, series accent via a CSS var, no `<h1>`; integration (real Postgres) — `getPublicSchedule` items carry `seriesKey` + `venueShortName`. The existing `scheduleList.test.tsx` is updated (kept green). Above-the-fold/375px/tap-size are browser-verified. |
| **II. Simplicity / YAGNI** | PASS. Reuse `listPublicEvents` + `ScheduleList` (no new query); **+2 projection fields, no migration**; a per-series code constant (no DB colour storage); lean card (no lineup — clarified); no video; neutral default for unmapped series reuses an existing token. |
| **III. Type Safety** | PASS. `PublicScheduleItem` gains typed `seriesKey: string` + `venueShortName: string \| null`; the series→color map is typed; no `any`. |
| **IV. Observability** | N/A (honest). Presentation + a read-projection tweak; no new request cycle, write, or external call. |

**Development Workflow**: Multi-contributor mode — developed on `048-whats-on-cards` (off `main`, which
now has 045/046/047), lands via a **reviewed PR** (no self-merge) after the gate suite passes. No
Complexity Tracking entries.

## Project Structure

### Documentation (this feature)

```text
specs/048-whats-on-cards/
├── plan.md
├── research.md          # Phase 0 (projection fields, series→color map, card structure/accent, testing)
├── data-model.md        # Phase 1 (PublicScheduleItem +2 fields; series→color map; no migration)
├── quickstart.md        # Phase 1 (verify cards, color, above-the-fold, 375px, all three surfaces)
├── contracts/
│   └── event-card.md    # UI contract: card content/behavior + the extended projection
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
src/server/domain/public/
└── publicSchedule.ts                       # listPublicEvents: +series.key, +venues.short_name in SELECT;
                                            #   PublicScheduleItem += seriesKey: string, venueShortName: string|null

src/app/(public)/_components/
├── seriesColor.ts                          # NEW: per-series → R1 color var (tnc→contra … ; unmapped→neutral --band)
├── EventCard.tsx + EventCard.module.css    # NEW: the card — accent stripe (series color), prominent date,
│                                           #   time, venue short (fallback to full), price, cancelled marker,
│                                           #   whole-card <Link> to /whats-on/<id>
├── ScheduleList.tsx                        # render <EventCard> per item; keep the empty-state message
└── ScheduleList.module.css                 # list wrapper (card stack/spacing)

tests/
├── unit/seriesColor.test.ts                # NEW: map correctness + neutral default
├── component/eventCard.test.tsx            # NEW: card content/behavior/accent
├── component/scheduleList.test.tsx         # UPDATE: fixtures += seriesKey/venueShortName; card assertions
└── integration/publicSchedule.cards.test.ts # NEW: projection carries seriesKey + venueShortName
```

**Structure Decision**: Extract a focused `EventCard` (pure, one item) so a single card is unit-testable;
`ScheduleList` maps items → `EventCard` and keeps its empty state, so `/whats-on`, `/what-was-on`, and the
home strip inherit cards with no per-page code. The series→color map is a small co-located code constant
consuming R1's `EVENT_TYPE_COLORS`. The only server change is two additive columns in the existing public
projection — no migration, no new query.

## Complexity Tracking

> No Constitution Check violations — table intentionally empty.
