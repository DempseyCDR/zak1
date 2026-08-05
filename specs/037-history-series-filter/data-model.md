# Phase 1 Data Model: Dance History Page + Series Filter

No persisted data changes — no table, column, or migration. New **reads** over existing `events` + `series`.

## Entity: Public dance listing item (existing, unchanged)

The shape both listings render (already returned by `getPublicSchedule`): `eventId`, `date`, `activity` (series
name), `venueName`, `label`, `startTime`, `cancelled`, `advertisedPrice`. Reused as-is by `getPublicHistory`.

## Reads (the changes)

| Read | Rule |
|------|------|
| `getPublicSchedule(db, from?, seriesKey?)` | `event_date >= from` (default `homeWindowStart(today())`), **asc**; optional `eq(series.key, seriesKey)`. Signature extended with optional `seriesKey` (backward compatible). |
| `getPublicHistory(db, before?, seriesKey?)` (new) | `event_date < before` (default `today()`), **desc**; optional `eq(series.key, seriesKey)`. |
| `listSeries(db)` (new) | all `series` as `{ key, name }`, ordered by `name`. Feeds the filter options (FR-009). |
| internal `listPublicEvents(db, { from?, before?, seriesKey?, order })` | shared query builder both readers delegate to (single projection + filter). |

- **Series filter**: an optional `seriesKey` (the `series.key`), applied as a parameterized equality. Unknown key
  → no rows → empty state (no error, no injection).
- **Boundary / overlap (FR-008)**: `/whats-on` = `event_date ≥ today − 2` asc; `/what-was-on` = `event_date <
  today` desc. The `[today−2, today)` overlap appears on both by design (no de-dup).
- **Validation**: none at runtime beyond the parameterized filter; `searchParams.series` is a `string |
  undefined` filter value, not decoded to a domain object (no Zod).

## UI entities (presentation)

| Component | Props | Renders |
|-----------|-------|---------|
| `ScheduleList` | `items: PublicScheduleItem[]`, empty message | the shared `<ul>` of rows, each linking to `/whats-on/<eventId>` |
| `SeriesFilter` | `series: {key,name}[]`, `selected?: string`, `basePath: string` | an "All" link + one `?series=<key>` link per series, current one marked |

## Relationships

None new. The history read is a second window over `events` (joined to `series` for the name + the filter). The
detail path (`getPublicEventDetail`, `/whats-on/[eventId]`) is unchanged and shared by both listings.
