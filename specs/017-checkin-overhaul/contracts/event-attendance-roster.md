# Contract: Event attendance roster — enriched read

`GET /api/events/[id]/attendance` — **existing endpoint, enriched response + new sort param.** Auth: `base`
(unchanged). Handler: `listEventAttendance`.

## Query parameters

| Param | Values | Default | Notes |
|---|---|---|---|
| `sort` | `first` \| `last` | `last` | **NEW (B33).** Order the roster by first or last name; the other name is the tiebreak. Unmatched placeholders (no contact) sort last. |

## Response (`EventAttendanceView`, extended)

```jsonc
{
  "count": 12,
  "attendees": [
    {
      "id": "<uuid>",
      "contactId": "<uuid|null>",
      "firstName": "Jane",        // NEW (B33): structured, from feature 012
      "lastName": "Smith",        // NEW (B33): may be null
      "displayName": "DJ Jane",   // retained (unchanged)
      "childrenCount": 2,         // NEW (B35): guests on this check-in
      "isOpenBand": false,        // NEW (B36): open-band musician marker
      "createdAt": "<iso8601>"
    }
  ]
}
```

## Behaviour

- Selects `first_name`/`last_name`/`children_count`/`is_open_band` in addition to the existing `display_name`.
- Ordering applied in SQL by the `sort` field, then the other name, with nulls last.
- After the 90-day purge there are no rows → `count: 0`, `attendees: []` (unchanged).

## Compatibility

- `count` and `displayName` are retained. The only existing programmatic consumer,
  `contactTracingService`, reads `count` only → unaffected.
- New fields are additive; the `/checkin` roster panel consumes them.
