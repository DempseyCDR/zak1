# Phase 1 Contracts: API Deltas

No new endpoints or routes (dev route index unchanged). Two event endpoints gain fields; the public read
surfaces gain fields.

## `POST /api/events` — create (CHANGED body)

```jsonc
// Before
{ "seriesKey": "tnc", "eventDate": "2026-06-18", "chargesAdmission": true, "groupId": "..." }
// After (three new optional fields)
{ "seriesKey": "tnc", "eventDate": "2026-06-18", "chargesAdmission": true, "groupId": "...",
  "label": "Evening", "startTime": "19:30", "description": "Contra with the Wednesday Band." }
```

- `label` (optional trimmed text), `startTime` (optional `HH:MM`), `description` (optional trimmed text).
  Response event row includes `label`, `startTime` (stored `time`), `description`.
- Acceptance: FR-001, FR-003, FR-005, FR-007.

## `PATCH /api/events/[id]` — edit (CHANGED body)

Existing endpoint (venueId/rentCents from 007/011) gains the three fields:

```jsonc
{ "label": "Afternoon" }                 // set / rename the label
{ "startTime": "14:00" }                 // set the start time; { "startTime": null } clears it
{ "description": "..." }                  // set; { "description": null } clears it
```

- Each field optional and nullable (value sets, `null` clears). Applied alongside `venueId`/`rentCents`.
- Acceptance: FR-007.

## Public read surfaces — behavior change (same routes)

- **`GET` public schedule** (`/whats-on`, via `getPublicSchedule`): each item gains `label` and a
  display-formatted `startTime` (e.g. "7:30 PM"), or `null`. *(FR-002, FR-004, SC-001, SC-002)*
- **`GET` public event detail** (`/whats-on/[eventId]`, via `getPublicEventDetail`): gains `label`,
  formatted `startTime`, and `description` (or `null`). Description block omitted when null. *(FR-004,
  FR-006, SC-002, SC-003)*

Start time is always the venue-local wall-clock value, never adjusted for the viewer's time zone.

## Unchanged (regression guardrails)

- Events with none of the three fields set return `null` for them and render exactly as today (FR-008,
  SC-004). No change to admission, gate money, attendance, bookings, or reports.
