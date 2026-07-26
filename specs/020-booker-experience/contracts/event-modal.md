# Contract: Event Modal (US4)

A client surface over the **existing** event API. `event.write` gates writes (Booker); a viewer without it
gets read-only (Close only). Advertised price is NOT in this modal (that's the Webmaster's field,
`event.public.write`) — out of scope here.

---

## Existing API reused

- `GET /api/events/:id` — current values (date, start time, venue, rent, label, description).
- `PATCH /api/events/:id` — edit `eventDate`, `startTime`, `venueId`, `rentCents`, `label`, `description`
  (all existing fields; feature 013/018/011). Field-level authority is unchanged (date/venue/label/etc. →
  `event.write`).
- `POST /api/events` — create a single event.
- Rent resolution via `rentService.resolveEventRentCents` (feature 011).

## New read for the create/rent flow

The modal needs two small reads (may be one endpoint or query params on existing routes):

1. **Prior-event defaults** — `priorEventDefaults(seriesId, beforeDate)` → `{ venueId, startTime }` of the
   latest event in the series with `event_date < beforeDate` (nulls if none). Used to pre-fill a **new**
   event (FR-018). Recurrence generation is exempt.
2. **Resolve rent for a chosen venue** — resolve the rent chain for a hypothetical `(series, venue, date)`
   so the modal can **show the default and re-compute it when Sean changes the venue** (FR-019), before
   saving.

---

## Rent semantics (FR-019, Option A) — the subtle part

- The rent field **always shows the resolved default** (per-event override → series-at-venue → venue default
  → 0) — never a blank.
- On **Save**: if the entered value **equals the currently-resolved default**, PATCH `rentCents: null`
  (store **no** override — the event keeps tracking the venue/series default). If it **differs**, PATCH the
  typed value as the per-event override.
- Changing the **venue** in the modal re-resolves and re-shows the default (read #2 above).

Tested: a no-op rent edit leaves `events.rent_cents` NULL; a changed value stores the override; changing the
venue changes the shown default.

---

## Modal behavior

| Shell | When | Buttons |
|---|---|---|
| edit | click an event date/label in the report | Save, Cancel |
| create | new event | Save, Cancel — venue + start time pre-filled from the prior event |
| read-only | viewer lacks `event.write` | Close only |

One Save commits all fields; Cancel discards; no save-on-close.
