# Contract: Public Schedule (home-page window)

No HTTP API changes. `/whats-on` is a server-rendered page reading the domain function directly. The contract is
the domain function's window behavior.

## Function: `getPublicSchedule`

- **File**: `src/server/domain/public/publicSchedule.ts`
- **Signature (unchanged)**: `getPublicSchedule(db, from?: string): Promise<PublicScheduleItem[]>`
- **Change**: the **default** `from` becomes `homeWindowStart(today())` (= today − 2 calendar days), was
  `today()`. Callers passing an explicit `from` are unaffected.
- **Behavior**: returns events with `event_date >= from`, ordered **ascending** by `event_date`, with the
  public-safe projection (activity/series, venue, start time, cancelled marker, advertised price). Cancelled
  events within the window are included with their marker.

## Function: `homeWindowStart` (new)

- **File**: `src/server/domain/public/publicSchedule.ts`
- **Signature**: `homeWindowStart(today: string, lookbackDays?: number): string`
- **Contract**: pure; given a `YYYY-MM-DD` calendar date, returns the date `lookbackDays` (default
  `HOME_WINDOW_LOOKBACK_DAYS = 2`) calendar days earlier, in `YYYY-MM-DD`, computed in UTC (correct across month
  and year boundaries).

| Input `today` | Output (lookback 2) |
|---------------|---------------------|
| `2026-08-04` | `2026-08-02` |
| `2026-03-01` | `2026-02-27` |
| `2026-01-01` | `2025-12-30` |

## Page: `/whats-on`

- **File**: `src/app/(public)/whats-on/page.tsx`
- **Change**: none required (it calls `getPublicSchedule(db)` with no `from`, so it inherits the new default).
  **Optional**: reword the empty-state message to fit recent + upcoming.

## Non-contract (out of scope)

- No new endpoint, table, or migration.
- History page (`/what-was-on`, P6-R4) and series filter (P6-R5) — separate features.
- The dance detail page / `getPublicEventDetail` — unchanged.
