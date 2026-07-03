# API Contracts: Series-Scoped Rate & Expense Parameters

Internal HTTP API (Next.js route handlers). Both endpoints already exist (features 003/005); this
feature changes their required fields and shared backing, not their general shape. Uniform error
shape `{ error: { code, message } }`.

## Rate parameters (Caller / Sound Tech / Musician, effective-dated, now per-series)

### POST /api/rate-parameters

Body: `{ seriesKey: string, kind: "caller"|"sound_tech"|"musician", amount: number, effectiveDate: string (YYYY-MM-DD) }`

- **Changed**: `seriesKey` is now required (previously rate parameters had no series concept);
  `kind` gains `"musician"`.
- 201 → `SeriesParameter` row (append-only); writes a `series_parameter_audit` row + pino audit.
- 404 `SERIES_NOT_FOUND` if `seriesKey` doesn't match an existing series.
- 422 `VALIDATION_ERROR` for a malformed body (unchanged pattern).

### GET /api/rate-parameters?seriesKey=&kind=&on=

- **Changed**: now requires `seriesKey` (previously `kind`+`on` only, since rates were global).
- 200 → `{ resolved: { seriesKey, kind, amount, effectiveDate } | null }` — the parameter in effect
  for (series, kind) on date `on` (defaults to today if omitted). Mirrors
  `GET /api/expense-parameters`'s existing response shape exactly.

## Expense parameters (Rent / Ongoing, per-series) — surface unchanged

### POST /api/expense-parameters

Body: `{ seriesKey: string, kind: "rent"|"ongoing", amount: number, label?: string, effectiveDate: string (YYYY-MM-DD) }`

- Unchanged request/response shape. Now backed by the shared `series_parameters` table and
  `seriesParameterService.ts` instead of a dedicated `series_expense_parameters` table/service.
- 201 → `SeriesParameter` row; writes a `series_parameter_audit` row + pino audit (previously:
  pino audit only — expense parameters gain the durable audit table rate parameters already had).
- 404 `SERIES_NOT_FOUND`.

### GET /api/expense-parameters?seriesKey=&kind=&on=

- Unchanged. 200 → `{ resolved: { seriesKey, kind, amount, effectiveDate } | null }`.

## Enums

- `ParameterCategory`: `rate | expense` (internal; not part of either request body — each endpoint
  implies its own category)
- `ParameterKind`: `caller | sound_tech | musician | rent | ongoing`

## Error codes

`SERIES_NOT_FOUND` (404, existing) · `VALIDATION_ERROR` (422, existing) — no new error codes.

## Notes

- No POST/GET route is merged — `/api/rate-parameters` and `/api/expense-parameters` remain two
  distinct endpoints (research Decision 6), even though both now read/write the same
  `series_parameters` table via one shared `resolveParameterCents`/creation service.
- The "general" series (this feature) is just another value for `seriesKey` in both endpoints — no
  special-cased request/response handling for it.
- Booking creation (`POST /api/events/:id/bookings`, feature 003) and the Organizer Report
  (`GET /api/organizer/:seriesKey/report`, feature 005) are unchanged at the contract level — they
  keep resolving pay/expenses internally, now via the shared resolver, using the event's existing
  `series_id`. No request/response shape changes there.
