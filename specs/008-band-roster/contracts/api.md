# API Contracts: Reusable Band Roster

Internal HTTP API (Next.js route handlers). Uniform error shape `{ error: { code, message } }`
(existing `apiError.ts` convention). No authentication in this build (`actor` currently always null/
`"admin"` header, same as every other feature).

## Bands directory

### GET /api/bands

Lists active (non-archived) bands for the pick list and directory.

- 200 → `{ items: { id, name, memberCount, leadPerformerName }[] }` (archived bands excluded).

### POST /api/bands

Body: `{ name: string, bio?: string, photoUrl?: string, members: { performerId: string, isLead: boolean }[] }`

- Exactly one `members[].isLead === true` is required; all `performerId`s must exist; ≥1 member (the lead).
- 201 → the created `Band` with its roster. Writes a `band.created` audit event.
- 404 `PERFORMER_NOT_FOUND` if any `performerId` is unknown.
- 422 `VALIDATION_ERROR` (malformed body; zero or multiple leads; empty roster).

### GET /api/bands/:id

- 200 → `{ id, name, bio, photoUrl, archivedAt, members: { performerId, performerName, isLead }[] }`.
- 404 `BAND_NOT_FOUND`.

### PATCH /api/bands/:id

Body (all optional): `{ name?, bio?, photoUrl?, members?: { performerId, isLead }[] }`

- If `members` is supplied it replaces the roster (still exactly one lead, ≥1 member). Edits are
  current-state and apply to future bookings only; already-created bookings are untouched (FR-002).
- 200 → the updated `Band`. Writes a `band.updated` audit event.
- 404 `BAND_NOT_FOUND` / `PERFORMER_NOT_FOUND`; 422 `VALIDATION_ERROR` (zero/multiple leads).

### DELETE /api/bands/:id

Soft-delete (sets `archived_at`). Does not delete/alter any performer or booking (FR-011).

- 1. Writes a `band.deleted` audit event. Idempotent-ish: deleting an already-archived band → 204.
- 404 `BAND_NOT_FOUND`.

## Book a band onto an event

### POST /api/events/:id/book-band

Body: `{ bandId: string, memberPay?: { performerId: string, amount: number }[] }`

- Creates one booking per current roster member **not already booked on the event** (FR-003c), each
  linked to the band (`band_id`). Per-member pay: an amount from `memberPay` if given (override),
  else the series `musician` rate default (feature 009), else 0. Runs in one transaction.
- 201 → `{ createdCount: number, skippedCount: number, bookings: Booking[] }`.
- 404 `EVENT_NOT_FOUND` / `BAND_NOT_FOUND`.
- The propose-the-first-amount UI convenience (FR-003b) is computed client-side; the server receives
  only the confirmed per-member amounts (or none, to take the default).

## Enums / error codes

- New error code: `BAND_NOT_FOUND` (404). Reuses existing `PERFORMER_NOT_FOUND`, `EVENT_NOT_FOUND`,
  `VALIDATION_ERROR`.

## Notes

- No public-site endpoint is added here. The band-grouping read model
  (`groupEventBookingsForDisplay`) is an internal function feature 007 will consume when it builds the
  public event listing (see plan Scope note); it is exercised by integration tests, not exposed as a
  route in this feature.
- FR-012/FR-013 (series-scoped `musician` rate; Lead == Musician treatment) are already delivered by
  feature 009 — no new endpoint or rate handling here; the book-band flow simply resolves the existing
  `musician` rate.
