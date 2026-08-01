# Data Model: Bookings report defaults to descending date (P5-R2)

**No persistent data-model change.** This feature adds no table, column, index, migration, or persisted
preference.

## The only "state" involved

- **Selected sort direction** — a **transient UI value** (`"asc" | "desc"`), held in the report page's
  component state and passed through the read-only report request. It is not saved per user and does not
  survive a reload; the reload re-applies the new default (`"desc"`).

## Touched contracts (shape unchanged)

- `BookingsReportFilters.sort?: "asc" | "desc"` (in `reportService.ts`) — **union unchanged**; only the
  default branch (when `sort` is absent) flips from ascending to descending.
- `GET /api/bookings/report` `?sort=` query param — **unchanged accepted values** (`asc` / `desc`); only the
  default applied when the param is absent flips to `desc`. See [contracts/bookings-report-sort.md](contracts/bookings-report-sort.md).

No entities, relationships, validation rules, or state transitions are added or altered.
