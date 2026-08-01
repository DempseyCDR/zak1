# Contract: `GET /api/bookings/report` — `sort` parameter (default flip)

Feature 029 changes **only the default** applied when `sort` is absent. The endpoint's shape, auth, filters,
and row payload are unchanged (feature 018/020/024).

## Query parameter

| Param  | Values          | Before (020)         | After (029)           |
|--------|-----------------|----------------------|-----------------------|
| `sort` | `asc` \| `desc` | absent/other → `asc` | absent/other → `desc` |

- `sort=asc` → rows ordered by `event_date` ascending (oldest first). **Unchanged.**
- `sort=desc` → rows ordered by `event_date` descending (newest first). **Unchanged.**
- **`sort` absent (or an unrecognized value)** → **descending** (was ascending). **This is the whole change.**

All other query params (`series`, `from`, `to`, `caller`, `band`, `musician`) and the response body
(`{ rows: BookingsReportRow[] }`) are exactly as before.

## Service-level contract

`assembleBookingsReport(db, filters)`:

- `filters.sort === "asc"` → ascending.
- `filters.sort === "desc"` → descending.
- `filters.sort` **undefined** → **descending** (was ascending).

## Consumer contract (report page)

- The `/bookings-report` page's initial sort state is `"desc"`, so its first request carries `sort=desc`.
- The existing sort toggle continues to switch between `desc` and `asc` in both directions; only the starting
  direction changed.
