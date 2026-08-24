# Phase 1 Data Model: Event detail page enrichment (P7-R5)

**No database schema change / no migration.** The two new projection values already exist in tables the read
joins/loads (`series.key`; the band roster from `getBand`). This feature projects them into the public event
detail and adds a code-level series→hero map.

## `PublicEventDetail` — one field added

`getPublicEventDetail` (`src/server/domain/public/publicSchedule.ts`) gains:

| Field | Type | Source | Notes |
|-------|------|--------|-------|
| `seriesKey` | `string` | `series.key` (inner join, already present) | drives the page's series color (via R4 `seriesColorVar`) and the hero (`seriesHeroSrc`); matches the card |

Unchanged: `eventId`, `date`, `activity` (= `series.name`), `venue` (`{ name, address, mapUrl }` \| null),
`label`, `startTime`, `description`, `cancelled`, `advertisedPrice`, `performers`.

## `PublicBandBlock` — one field added

Each band block (in `PublicEventDetail.bandBlocks`) gains:

| Field | Type | Source | Notes |
|-------|------|--------|-------|
| `members` | `{ name: string; isLead: boolean }[]` | `getBand(...).members` (roster already loaded) | mapped in `groupEventBookingsForDisplay`, which currently discards the roster; lead may sort first / be labelled. Empty array when a band has no roster. |

Unchanged: `name`, `bio`, `photoUrl`. **No instrument** — `performers`/`band_members` carry none (research R4);
"instruments when available" degrades to names.

The intermediate `BandBlock` (`src/server/domain/bands/publicDisplay.ts`) likewise gains `members` (populated
from `getBand`'s roster), which `getPublicEventDetail` maps through to `PublicBandBlock`.

## Series → hero image map (code constant, not stored)

`src/app/(public)/_components/seriesHero.ts`:

- `seriesHeroSrc(seriesKey: string): string | null` — a per-series map to a **committed static asset** under
  `public/series/` (e.g. `tnc` → `/series/tnc.webp`); any unmapped series → **`null`**.
- Curated, committed, low-churn (D-4); **no DB image column, no upload**. Parallel to R4's `seriesColor`.
- `null` is a first-class state: the page renders a clean series-colored header with no `<img>`.

## Presentation structure (new components)

- **`EventHero`** (`(public)/_components/EventHero.tsx`): given `seriesKey` (+ `activity` for `alt`), renders a
  `next/image` hero from `seriesHeroSrc` when non-null, else a clean series-colored header (no broken image).
  No `<h1>`.
- **`VenueBlock`** (`(public)/_components/VenueBlock.tsx`): given the projection's `venue`, renders the name +
  the tappable map link (image when `mapUrl` is a static-map URL, else an anchor). Leaves a directions slot for
  R8 (`venues.directions`); renders nothing when `venue` is null.
- **`Lineup`** (`(public)/_components/Lineup.tsx`): given `bandBlocks` (+ `members`) and `performers`, renders
  each band with its members (lead first) and the callers/other performers; renders **"Lineup to be announced"**
  when both are empty. No `<h1>`. Confirmed-only is upstream.

## Validation rules (enforced by tests)

- `getPublicEventDetail` carries `seriesKey` and each band block carries `members` with correct values
  (integration); non-confirmed bookings are still excluded (integration).
- `seriesHeroSrc` returns the mapped path per series and `null` for an unknown key (unit).
- `EventHero` renders an `<img>` for a mapped series and a clean header (no `<img>`) for an unmapped one; no
  `<h1>` (component).
- `Lineup` renders a band with its members and a caller, and "Lineup to be announced" for an empty lineup; no
  `<h1>` (component).
