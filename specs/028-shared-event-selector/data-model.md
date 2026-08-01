# Data Model: Shared filterable event selector

**No persistent schema change, no migration.** This is a UI feature over existing data; it introduces no table
or column and no new server domain code.

## Entities used (unchanged, read-only)

- **Event** (`events`): `id`, `event_date`, `start_time`, `label`, `series_id`. Read via `/api/events`
  (already ordered newest-first: date desc, start time desc — feature 025). The selector orders, labels
  (`date · HH:MM · label`), filters (series + date range), and defaults from these; it writes nothing.
- **Series** (`series`): `id`, `key`, `name`. Read via `/api/series` to populate the series filter.

## Client state (per surface, not persisted)

- **Selected event** — `eventId` held as **page state** on each surface (check-in, gate, payments, treasurer).
  Set by the shared selector: the **default** on open, or the user's in-page pick. **Not** encoded in the URL
  (deep links are out of scope — clarification). Consumed by each surface's own effect (roster load, door
  record open, payments load, report load).

## `EventSelector` internal model

| Piece | Meaning |
|---|---|
| `events` | the fetched list (descending); filtered client-side for display |
| `series` | the fetched series list (for the filter dropdown) |
| filter: `seriesKey` | narrow the list to one series (empty = all) |
| filter: `from` / `to` | narrow the list to a date range (empty = unbounded) |
| default rule | first event with `event_date ≤ today` in the current list, else the last (soonest upcoming); computed **once** when `value` is empty → `onSelect(defaultId)` |
| pick | choosing an option in the event `<select>` → `onSelect(id)` (the confirm; filters never call `onSelect`) |

## Behavior invariants

- **Default on open**: when a surface mounts with no selection, the selector reports the default per the rule
  above (or nothing when there are no events).
- **Filters narrow, never commit**: changing series/from/to reshapes the option list only; the selected event
  changes solely on an explicit pick (FR-005).
- **Empty state**: when the (filtered) list is empty, no event is selected and no follow-on action fires;
  relaxing the filter restores choices.
- **Consistency**: identical default/order/label/filter behavior on all four surfaces (one component).
