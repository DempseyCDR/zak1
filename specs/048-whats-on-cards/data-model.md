# Phase 1 Data Model: `/whats-on` mobile-first event cards

**No database schema change / no migration.** The two new values are already columns on joined tables
(`series.key`, `venues.short_name`); this feature only projects them into the public read.

## `PublicScheduleItem` — two fields added

The per-event public projection (returned by `getPublicSchedule` / `getPublicHistory` via
`listPublicEvents`) gains:

| Field | Type | Source | Notes |
|-------|------|--------|-------|
| `seriesKey` | `string` | `series.key` (inner join) | the stable series key used to pick the card's colour (never the display `activity` string) |
| `venueShortName` | `string \| null` | `venues.short_name` (left join) | nullable — card falls back to `venueName`, then omits the venue line |

Unchanged fields: `eventId`, `date`, `activity` (= `series.name`), `venueName` (full), `label`,
`startTime`, `cancelled`, `advertisedPrice`.

Validation / invariants:

- `seriesKey` is always present (every event has a series; inner join).
- `venueShortName` may be null (no short name, or no venue) → the card degrades (fallback / omit).
- The `?series=` filter and confirmed-only + cancelled rules are unchanged.

## Series → colour map (code constant, not stored)

`src/app/(public)/_components/seriesColor.ts`:

- `SERIES_COLOR: Record<string, string>` (or a `seriesColorVar(seriesKey): string` helper) mapping the
  series key to an R1 colour variable:
  `tnc`→`var(--type-contra)`, `ecd`→`var(--type-english)`, `community_dance`→`var(--type-special)`,
  `general`→`var(--type-assembly)`.
- Any unmapped key → the **neutral default** `var(--band)`.
- `meeting` (`var(--type-meeting)`) is reserved for future meeting events (no dance series maps to it).

## Presentation structure

- **`EventCard`** (`(public)/_components/EventCard.tsx`, pure, one `PublicScheduleItem`): a whole-card
  `<Link>` to `/whats-on/<eventId>` with a left accent stripe (`--card-accent` = the series colour),
  prominent date, time, venue short name (fallback), price (omitted when null), and a cancelled marker.
- **`ScheduleList`** maps items → `EventCard` and keeps the empty-state message; used unchanged by
  `/whats-on`, `/what-was-on`, and the home strip.

## Validation rules (enforced by tests)

- The projection carries `seriesKey` + `venueShortName` with correct values (integration).
- The series→colour map returns the right variable per key and the neutral default for an unknown key (unit).
- `EventCard` links the whole card to detail, shows date/time/venue-short(+fallback)/price, marks
  cancelled, sets `--card-accent` from the series, and renders no `<h1>` (component).
