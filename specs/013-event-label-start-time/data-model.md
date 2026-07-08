# Phase 1 Data Model: Event Label, Start Time, Description

## Changed entity: `events`

### New columns (all nullable, additive)

| Column | Type | Notes |
|--------|------|-------|
| label | text NULL | short free-text label; distinguishes same-day group members (FR-001/FR-002) |
| start_time | `time` (without time zone) NULL | venue-local wall-clock; no time-zone data (FR-003) |
| description | text NULL | long-text public-detail blurb (FR-005) |

No change to existing columns; existing rows get `NULL` for all three and render exactly as today
(FR-008/SC-004).

## Display rule

- **Start time** is formatted by a pure helper `formatWallClock(t: string | null): string | null` —
  input `"19:30:00"`/`"19:30"` → `"7:30 PM"`; `null` → `null`. No `Date`, no UTC/offset math, so the
  output is identical regardless of server/viewer time zone (FR-004/SC-002).
- **Label** renders as-is wherever events are listed; absent when `null`.
- **Description** renders on the public event detail; the block is omitted when `null`.

## Public read model (`domain/public/publicSchedule.ts`) additions

| Type | Added fields |
|------|--------------|
| `PublicScheduleItem` | `label: string \| null`, `startTime: string \| null` (formatted) |
| `PublicEventDetail` | `label: string \| null`, `startTime: string \| null` (formatted), `description: string \| null` |

The read model formats `start_time` via `formatWallClock` so pages receive a display-ready string.

## Validation changes

- **`eventCreateSchema`** (`validation/door.ts`): add `label: z.string().trim().min(1).optional()`,
  `startTime: z.string().regex(/^\d{2}:\d{2}$/).optional()`, `description: z.string().trim().min(1).optional()`.
- **Event PATCH schema** (`assignVenueSchema` in `validation/venues.ts`): add the same three, each
  `.nullable().optional()` (a value sets it; `null` clears it).

## Migration `0018_event_label_time_description.sql`

```sql
ALTER TABLE events ADD COLUMN IF NOT EXISTS label text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS start_time time;      -- time without time zone (wall-clock)
ALTER TABLE events ADD COLUMN IF NOT EXISTS description text;
```

Non-destructive; no backfill.

## Requirements traceability

| Requirement | Model / display effect |
|-------------|------------------------|
| FR-001, FR-002 | `events.label`; shown in listings/read model |
| FR-003 | `events.start_time` as zoneless `time` |
| FR-004, SC-002 | `formatWallClock` (no Date/TZ) in the read model |
| FR-005, FR-006 | `events.description`; rendered on public detail when present |
| FR-007 | create + PATCH schemas/service accept all three |
| FR-008, SC-004 | all nullable; `NULL` ⇒ unchanged display |
