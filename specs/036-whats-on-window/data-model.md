# Phase 1 Data Model: What's On — Home Page Window

No persisted data changes — no table, no column, no migration. Only the **read window** over existing events
changes.

## Entity: Public schedule item (existing, unchanged)

The shape `getPublicSchedule` already returns, reused as-is:

| Field | Type | Notes |
|-------|------|-------|
| `eventId` | `string` | |
| `date` | `string` | `event_date` (calendar DATE) |
| `activity` | `string` | series name |
| `venueName` | `string \| null` | |
| `label` | `string \| null` | |
| `startTime` | `string \| null` | display-formatted wall-clock |
| `cancelled` | `boolean` | shown with a marker |
| `advertisedPrice` | `number \| null` | dollars; null = not shown |

## Derived: the home-page window (the only change)

| Name | Type | Rule |
|------|------|------|
| `HOME_WINDOW_LOOKBACK_DAYS` | `number` (const) | `2` — the fixed lookback (FR-003) |
| `homeWindowStart(today)` | `(string) → string` | `today − HOME_WINDOW_LOOKBACK_DAYS` calendar days (UTC); the inclusive lower bound |

- **Query rule (FR-001/FR-002/FR-004)**: list events where `event_date >= homeWindowStart(today())`, ordered
  **ascending** by `event_date`. Events older than the bound are excluded (they belong to the P6-R4 history
  page).
- **Boundary**: inclusive at `homeWindowStart` (two days ago shows; three days ago does not).
- **Validation**: none at runtime — pure string→string date math, no external boundary (no Zod).

## Relationships

None new. The window is a lower bound on the existing public schedule query; the detail path
(`getPublicEventDetail`) is untouched.
