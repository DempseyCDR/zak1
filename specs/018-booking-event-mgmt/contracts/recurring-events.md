# Contract: Recurring event generation (B26)

`POST /api/events/recurring` — **NEW**. Auth: `event.write` (scoped to the target series). Handler:
`generateRecurringEvents`.

## Request body (`recurringEventsSchema`)

```jsonc
{
  "seriesKey": "tnc",
  "firstDate": "2026-01-08",   // a Thursday
  "lastDate": "2026-05-28",
  "everyNWeeks": 1,             // default 1 (weekly); 2 = biweekly
  "startTime": "19:30",        // optional, applied to every generated event
  "groupId": "<uuid>",         // optional
  "chargesAdmission": true     // optional, default true
}
```

## Behaviour

- Generates one **independent** event per date `firstDate + k·(everyNWeeks·7 days)` for k = 0,1,… while the
  date `≤ lastDate`, all in the given series with the given start time.
- **Empty range** (last before first, or no occurrences) → creates nothing, returns an empty list (not an
  error).
- **Cap**: if the computed count would exceed **60**, the whole run is **refused** (422) — nothing is
  created.
- Scope: `assertEventScope(actor, "event.write", { seriesId })` — a Booker may only generate into their own
  series. Audited (`event.created` per row, or one `events.generated` summary).

## Response

`201` with the list of created events (id + date), or `422` on over-cap / invalid range.

## Notes

- Rows are ordinary events — thereafter each is independently editable, reschedulable, cancellable, and
  deletable with no effect on siblings (FR-013). There is no stored recurrence rule.
