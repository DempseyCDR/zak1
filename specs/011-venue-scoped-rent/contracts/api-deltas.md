# Phase 1 Contracts: API Deltas

One new endpoint, two changed endpoints. New route → dev route index must be updated (`/venue-rents`,
`/api/venue-rents`).

## `GET /api/venue-rents?venueId=<uuid>` — list a venue's rents (NEW)

Returns the venue's rent rows (both default and series-at-venue), newest effective-date first:

```jsonc
{ "items": [
  { "id": "...", "venueId": "...", "seriesId": null,   "amountCents": 8000, "effectiveDate": "2026-01-01" },
  { "id": "...", "venueId": "...", "seriesId": "<tnc>", "amountCents": 6000, "effectiveDate": "2026-01-01" }
] }
```

## `POST /api/venue-rents` — set a venue default or series-at-venue rent (NEW)

```jsonc
// venue default (applies to any series at this venue without its own rate)
{ "venueId": "<uuid>", "amount": 80, "effectiveDate": "2026-01-01" }
// series-at-venue override
{ "venueId": "<uuid>", "seriesKey": "tnc", "amount": 60, "effectiveDate": "2026-01-01" }
```

- Body: `venueRentCreateSchema` (venueId uuid; seriesKey optional; amount ≥ 0; effectiveDate YYYY-MM-DD).
- Inserts a `venue_rents` row (+ `venue_rent_audit`). 404 if `seriesKey`/`venueId` unknown. 201 on success.
- Acceptance: FR-001, FR-002, SC-001.

## `PATCH /api/events/[id]` — set/clear per-event rent override (CHANGED)

Existing endpoint (feature 007, sets `venueId`) gains `rentCents`:

```jsonc
{ "rentCents": 10000 }   // override this event's rent to $100.00
{ "rentCents": null }    // clear the override → fall back to series-at-venue / venue default / 0
```

- Schema adds `rentCents: number(int ≥ 0) | null` (optional). Writes the event's audit (existing path).
- Acceptance: FR-003, FR-004, SC-002, SC-003.

## `POST /api/expense-parameters` — now ongoing-only, label required (CHANGED)

```jsonc
// Before: kind ∈ {rent, ongoing}, label optional
// After:  kind = "ongoing" only, label REQUIRED
{ "seriesKey": "tnc", "kind": "ongoing", "label": "Equipment loan", "amount": 25, "effectiveDate": "2026-01-01" }
```

- `kind` no longer accepts `rent` (422). `label` required (422 if missing/blank). Multiple ongoing rows
  per series (distinct labels) are allowed; a later `$0` for a label ends that charge.
- Acceptance: FR-008, FR-009, FR-010.

## `GET /api/expense-parameters?seriesKey=&on=` — ongoing-only, returns the labeled sum (CHANGED)

- The `kind` query param narrows to `ongoing` (rent is no longer a valid expense-parameter kind).
- Instead of a single resolved amount, the endpoint reports the **sum of all ongoing charges in effect**
  on `on` (via `resolveOngoingTotalCents`); the admin page uses this for its "currently in effect"
  total and to list the labeled charges.
- Acceptance: FR-008 (feeds the ongoing-only admin surface, T020).

## Unchanged contracts (regression guardrails)

- **`GET /api/organizer/[seriesKey]/report`**: same shape; each event's `rent` now comes from
  `resolveEventRentCents` and `ongoing` from `resolveOngoingTotalCents`. Existing figures unchanged after
  migration (FR-007, SC-004, SC-006).
- **Rate parameters, bookings, misc expenses**: unchanged (FR-011).
