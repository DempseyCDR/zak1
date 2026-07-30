# Contract: attendance corrections + selection reads

Three thin routes are added, one existing check-in payload is relaxed, and one existing read gains an order.
All correction routes are `attendance.write`-scoped (the Door Attendant's capability; the FS holds it too when
roles combine). Every mutation is audited.

## Correct one attendance record — `PATCH /api/attendance/[id]` (new)

`attendance.write`-scoped. Body has **at least one** field; each is applied and the denormalized head count /
door counts are kept exact:

- `{ childrenCount }` → set the record's children; `events.attendance_count += (new - old)`.
- `{ contactId }` → **reassign** an unmatched admission to that contact; **refused** if the contact is already
  on the event (no duplicate). Head count unchanged.
- `{ isOpenBand }` → toggle open-band; turning it **on** requires a **community_dance** event and a person who
  is **not** a booked performer (else refused); adjusts `door_records.open_band_count` by ±1. Head count
  unchanged.
- `{ eventId }` → **move** the admission to a **same-group sibling** event; refused when the target is not a
  real sibling (shared non-null `group_id`) **or when the dancer is already checked in on the target** (no
  duplicate). Source `attendance_count -= (1+children)`, target `+= (1+children)`. When an **open-band**
  admission is moved to a **non-community-dance** target, its `is_open_band` is cleared and the source event's
  `open_band_count` is decremented (open-band is community-dance-only).

Multiple fields may be combined in one call. Returns the updated record. Refusals are validation errors that
name the cause (already on roster / not a sibling / open-band only at a community dance).

## Clear one attendance record — `DELETE /api/attendance/[id]` (new)

`attendance.write`-scoped. Removes the record (a person recorded in error); `events.attendance_count -=
(1 + children)`. Works for matched and unmatched rows.

## Group siblings for the move — `GET /api/events/[id]/group-siblings` (new)

`attendance.write`-scoped (a door-correction read). Returns the **other** events sharing this event's non-null
`group_id`: `[{ id, eventDate, startTime, seriesKey, label }]`; **empty** when the event is ungrouped. The move
PATCH re-derives this set server-side and never trusts a client-supplied target.

## Adjust an aggregate door count — `POST /api/events/[id]/door-count` (new)

`attendance.write`-scoped. Body `{ count: 'comp' | 'gift', delta: 1 | -1 }`. Ensures the event's door record
and moves `comp_count` (comp) or `gift_card_redemption_count` (gift) by ±1, floored at 0. Nothing is stored per
person (decision B). The FS's aggregate gate override still supersedes for money.

## Relaxed — `POST /api/events/[id]/attendance` (existing)

The **unmatched** admission variant now also accepts `childrenCount` (previously rejected by a strict schema,
silently dropping the number). An unmatched admission with children now lands those children in
`events.attendance_count`. Open-band remains person-and-community-dance only. No other change to the check-in
payload.

## Ordered — `GET /api/events` (existing)

`listEvents` now returns events ordered by **date then start time, descending** (newest-relevant-first). No
shape change; the check-in selector uses this order and picks the default (most recent event on or before
today).

## Unchanged

- The check-in happy path (search → confirm), contact-tracing roster read shape, the organizer report's use of
  `events.attendance_count`, and the FS gate aggregate override are all unaffected.
- comp/gift/open-band remain counts-only and un-attributed (no per-person storage).
