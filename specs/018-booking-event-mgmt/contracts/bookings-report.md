# Contract: Cross-event bookings report (B24)

`GET /api/bookings/report` — **NEW**. Auth: **`base`** (any authenticated **staff** member may see it —
confirmed by Rich 2026-07-17; per the feature-016 read model, booking status is not PII). This is a
staff-only report showing **all** booking statuses; the **public** site (`/whats-on`) is separate and shows
only `confirmed` bookings (FR-022) and never performer pay. Handler: `assembleBookingsReport`.

## Query parameters (all optional, combinable)

| Param | Meaning |
|---|---|
| `series` | series key — only that series' events |
| `from`, `to` | `YYYY-MM-DD` date range (inclusive); past and future both allowed |
| `caller` | performer id (or contact id) filtering to events with that caller |
| `band` | band id filtering to events using that band |
| `musician` | performer id filtering to events featuring that musician |

## Response

A list of per-event rows, ordered by date:

```jsonc
{
  "rows": [
    {
      "eventId": "<uuid>",
      "date": "2026-06-18",
      "series": "tnc",
      "caller": "Cal Caller",
      "band": "The Reels",           // null when not a named band
      "musicians": ["Bob Fabinski", "Jo Fiddle"],
      "soundTech": "Sam Sound",       // null when none
      "cancelled": false,             // cancelled events are included, flagged (FR-005)
      "bookings": [
        { "performer": "Cal Caller", "type": "caller", "status": "confirmed" }
      ]
    }
  ]
}
```

## Behaviour

- Read-across-events (unlike the per-event treasurer/organizer reports); read-only — never mutates a booking
  (FR-007). **Cancelled events are included** with `cancelled: true` (FR-005).
- Filters compose (e.g. `?series=tnc&musician=<id>&from=2026-01-01`), returning only matching events.
- Each booking row carries its **status** (B23), so the Booker can see proposed/requested/confirmed/declined.
- No PII (no emails/phones); performer/contact **names** are shown (names are not PII in this model).
