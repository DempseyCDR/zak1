# Contract: Bookings Report (US1)

Modifies the existing cross-event bookings report ([`reportService.ts`](../../../src/server/domain/bookings/reportService.ts),
feature 018/B24). `requires: 'base'` — reading bookings/money is open to every volunteer (feature 016); the
report has always been staff-readable.

---

## `GET /api/bookings/report` (existing, extended)

**New query param**: `sort=asc|desc` (default `asc`). Existing filters unchanged: `series`, `from`, `to`,
`caller`, `musician`, `band`.

**Row shape** — additive only:

```jsonc
{
  "eventId": "uuid",
  "date": "2026-06-18",
  "series": "tnc",
  "venueShortName": "GH",        // NEW — from venues.short_name, else derived initials
  "hasSoundTech": true,          // NEW — the series' sound-tech flag; false for community_dance
  "caller": "Pat Caller",        // null if unfilled
  "band": "The Band",            // first named band, else null
  "musicians": ["Ann", "Bob"],   // stacked in the UI
  "soundTech": "Sam Tech",       // null if unfilled
  "cancelled": false,
  "bookings": [ { "performer": "Pat Caller", "type": "caller", "status": "confirmed" } ]
}
```

`bookings[].status` may now be `tentative` (US3) → the UI shows **T**.

**Empty role slots** are a UI concern derived from the row: expected roles (caller; sound-tech **only when
`hasSoundTech`**; booked musicians + one "add musician" slot) minus the filled ones. `hasSoundTech` MUST be
returned **on the row** — the `/api/series` list carries only `{id, key, name}`, so the report page cannot
read the flag from there (analyze G1).

**Unchanged**: cancelled events remain listed and flagged; all statuses appear (internal report), unlike the
public path which is confirmed-only.

---

## Status letters (presentation)

`P` proposed · `R` requested · `T` tentative · `C` confirmed · `D` declined. The **letter carries the
meaning**; color reinforces it via CSS (never color alone) — an accessibility requirement, not decoration.
