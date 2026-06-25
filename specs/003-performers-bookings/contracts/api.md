# API Contracts: Performers & Bookings

Internal HTTP API (Next.js route handlers). JSON; Zod-validated; uniform error shape
`{ error: { code, message } }`. Pay is dollar decimals at the boundary, integer cents internally.

## Performers

### POST /api/performers
Body: `{ displayName: string, contactId?: string, bio?: string, photoUrl?: string }`.
- 201 → `Performer`.

### GET /api/performers?q=
- 200 → `{ items: Performer[] }` (optional name filter).

### GET /api/performers/:id
- 200 → `Performer` + `appearanceCount` + `ytdEarnings` (dollars; excludes donations). 404 `PERFORMER_NOT_FOUND`.

### PATCH /api/performers/:id
Body: subset of `{ displayName, contactId, bio, photoUrl }`.
- 200 → `Performer`.

## Rate parameters

### POST /api/rate-parameters
Body: `{ kind: "caller"|"sound_tech", amount: number, effectiveDate: string (YYYY-MM-DD) }`.
- 201 → `RateParameter` (append-only new effective-dated row). Writes a rate-parameter audit entry (FR-011).

### GET /api/rate-parameters?kind=&on=
- 200 → `{ resolved: { kind, amount, effectiveDate } | null }` — the rate in effect for `kind` on date `on`.

## Bookings

### POST /api/events/:id/bookings
Body: `{ performerId: string, performerType: PerformerType, pay?: number, isDonated?: boolean, note?: string }`.
- Default pay = resolved rate for the role at the event date; supplying `pay` sets `is_overridden`.
- Server enforces: Sound Tech rejected for Community Dance → 422 `SOUND_TECH_NOT_ALLOWED`;
  Instructor/Open Band forced to $0/no-check; donated ⇒ $0/no-check.
- 201 → `Booking` (incl. derived `requiresCheck`). 404 `EVENT_NOT_FOUND` / `PERFORMER_NOT_FOUND`.

### GET /api/events/:id/bookings
- 200 → `{ bookings: Booking[], performerTotal: number }` (performerTotal in dollars = Σ pay; drill-down = bookings).

### PATCH /api/bookings/:id
Body: subset of `{ pay, isDonated, note }`. Re-derives `requires_check`; honors the same invariants.
- 200 → `Booking`.

## Event pick list (Bookings page)

The Bookings page sources events from feature 002's `GET /api/events`:
- Default request uses `from = (today − 1 month)` and orders results by event date **descending**
  (FR-012/013); the page shows an "include older events" toggle that re-requests without `from`.
- "New event" posts to `POST /api/events` (002) and selects the returned event (FR-014).
- This implies `GET /api/events` supports a `from`/`to` window (already) and descending-date ordering;
  ordering MAY be applied server-side or by the page.

## Enums

- `PerformerType`: `caller | lead_musician | open_band_musician | sound_tech | instructor`
- `RateKind`: `caller | sound_tech`

## Error codes

`PERFORMER_NOT_FOUND` (404) · `EVENT_NOT_FOUND` (404) · `BOOKING_NOT_FOUND` (404) ·
`SOUND_TECH_NOT_ALLOWED` (422) · `VALIDATION_ERROR` (422)
