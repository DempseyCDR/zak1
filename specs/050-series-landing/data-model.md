# Phase 1 Data Model: Series landing pages (P7-R6)

**No database schema change / no migration / no new query.** The only read is the existing
`getPublicSchedule(db, undefined, seriesKey)`. The landing copy is a **committed, typed content registry**, not
stored data.

## `StyleLanding` — the content model (code constant, not stored)

`src/app/(public)/dances/[style]/landingContent.ts`:

| Field | Type | Notes |
|-------|------|-------|
| `slug` | `string` | marketing slug + route param: `contra` \| `english` \| `community` |
| `seriesKey` | `string` | club series key for the color/hero/dance filter: `tnc` \| `ecd` \| `community_dance` |
| `title` | `string` | the page `<h1>` (e.g. "What is contra?") |
| `intro` | `string[]` | "what it is" paragraphs (the club's migrated voice) |
| `whyYoullLove` | `string[]` | "why you'll love it" paragraphs / testimonial voice |
| `whatToExpect` | `string[]` | "what to expect" list — MUST include **no partner needed**, **what to wear**, **etiquette**, and the **style-appropriate role/gendered-language note** (contra & community → gender-free Larks/Robins; English → traditional men's/women's terms, some callers moving toward positional) |

Exports:

- `LANDING_CONTENT: Record<string, StyleLanding>` — the three entries.
- `STYLE_SLUGS: string[]` — exactly `["contra", "english", "community"]` (drives `generateStaticParams`).
- `getStyleLanding(slug: string): StyleLanding | null` — the entry or `null` (drives `notFound()`).

Validation / invariants:

- Exactly three styles; each `seriesKey` is one of `tnc` / `ecd` / `community_dance` (no `general`).
- Every entry has a non-empty `title`, `intro`, `whyYoullLove`, and `whatToExpect`; `whatToExpect` includes the
  "no partner needed" reassurance.
- The copy is the club's migrated wording (voice preserved), edited only in this file.

## Series → color / hero (reused, not redefined)

- Color: `seriesColorVar(seriesKey)` (feature 048) — the title accent, matching the card + event page.
- Photo: `EventHero` (feature 049) via `seriesHeroSrc(seriesKey)` — the representative photo, or a clean
  series-colored header when absent.

## Presentation structure

- **Page** (`dances/[style]/page.tsx`, async server): resolves `getStyleLanding(style)`; `notFound()` if null.
  Renders `EventHero(seriesKey, title)`, one `<h1>` (title, series-color accent), `LandingSections(content)`,
  and the upcoming-dances section — `getPublicSchedule(db, undefined, seriesKey)` → `ScheduleList` (with an
  empty-state message). `generateStaticParams` → `STYLE_SLUGS`.
- **`LandingSections`** (`_components/LandingSections.tsx`, pure): renders `intro`, `whyYoullLove`, and
  `whatToExpect` as `<h2>`-headed sections (paragraphs + a list). No `<h1>`.

## Navigation (reused single source)

`PUBLIC_NAV` (`src/app/publicNavItems.ts`) gains three entries — Contra / English / Community → the three
`/dances/<slug>` routes (FR-006). Hand-maintained single source (034 FR-003); flat entries (046, no dropdowns).

## Validation rules (enforced by tests)

- `getStyleLanding` returns each style with the correct `seriesKey` and non-empty required sections (incl. "no
  partner needed"), and `null` for an unknown slug; `STYLE_SLUGS` is exactly the three (unit).
- `LandingSections` renders the prose (incl. "no partner needed") under `<h2>` headings and no `<h1>` (component).
- The page shows this-series-only upcoming cards + the empty state, the color matches the card, and the nav
  reaches the pages (browser).
