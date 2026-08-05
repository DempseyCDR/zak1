# Contract: Public Listings — History + Series Filter

No HTTP API. The listing pages are server components reading the domain directly; the contract is the domain
functions, the pages' URL surface, and the two shared components.

## Domain functions (`src/server/domain/public/publicSchedule.ts`)

- `getPublicSchedule(db, from?: string, seriesKey?: string)` — **extended**: adds optional `seriesKey`
  (parameterized `eq(series.key, …)`). `from` default unchanged (`homeWindowStart(today())`); asc. Existing
  callers unaffected.
- `getPublicHistory(db, before?: string, seriesKey?: string)` — **new**: `event_date < before` (default
  `today()`), **descending**; optional `seriesKey`. Same `PublicScheduleItem[]` projection as `getPublicSchedule`.
- `listSeries(db): Promise<{ key: string; name: string }[]>` — **new**: all series, ordered by name (filter
  options).
- internal `listPublicEvents(db, { from?, before?, seriesKey?, order })` — shared builder; not exported for app
  use beyond the two readers.

## Pages (URL surface)

- `/whats-on?series=<key>` — reads `searchParams.series`; `getPublicSchedule(db, undefined, series)`; renders
  `<SeriesFilter basePath="/whats-on">` + `<ScheduleList>`. No `series` → all series (unchanged default window).
- `/what-was-on?series=<key>` — **new**; reads `searchParams.series`; `getPublicHistory(db, undefined, series)`;
  renders `<SeriesFilter basePath="/what-was-on">` + `<ScheduleList>`.
- Both link each row to `/whats-on/<eventId>` (unchanged detail page).
- Unknown `series` value → empty list (not an error).

## Components (`src/app/(public)/_components/`)

- **`ScheduleList`** — props `{ items: PublicScheduleItem[]; emptyMessage?: string }`. Renders the shared `<ul>`
  (date · start · activity · label · venue · price · cancelled) with each row linking to `/whats-on/<eventId>`;
  shows the empty message when `items` is empty. Server component.
- **`SeriesFilter`** — props `{ series: { key: string; name: string }[]; selected?: string; basePath: string }`.
  Renders an **All** link (`basePath`, active when `selected` is empty) plus one link per series
  (`basePath?series=<key>`), marking the selected one (`aria-current="page"`). Server component; plain links, no
  client JS.

## Navigation (feature 034)

- `PUBLIC_NAV` gains `{ href: "/what-was-on", label: "What was on" }` — the history page is now reachable from
  the public menu on every page. The data-driven `publicNav.test.tsx` stays green (asserts the rendered links
  equal `PUBLIC_NAV`).

## Non-contract (out of scope)

- No new endpoint, table, or migration; no client bundle.
- The per-dance detail page (`/whats-on/[eventId]`, `getPublicEventDetail`) — unchanged.
- History pagination — not included (assumed full list).
