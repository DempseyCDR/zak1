# Contract: the shared `EventSelector` component + the APIs it consumes

No new server endpoint. The "contract" here is the shared UI component's interface and the existing read APIs
it uses.

## Component `EventSelector` (new, client)

**Props**:

- `value: string` — the currently selected event id (page state; `""` when none).
- `onSelect: (eventId: string) => void` — called when the selector determines the event: **once** with the
  default on open (when `value` is empty and events exist), and again each time the user **picks** an event.
  Never called merely because a filter changed.

**Renders** (presentation contract):

- an event `<select aria-label="Event">` whose options are the filtered events, newest-first, each labeled
  `date · HH:MM · label` (start time normalized to `HH:MM`; empty pieces omitted);
- a **series** filter `<select>` (from `/api/series`), and **from/to date** inputs — these narrow the option
  list only;
- an **empty state** when the filtered list has no events (nothing selected, no `onSelect`).

**Guarantees**: default = most recent event with `date ≤ today`, else the soonest upcoming; filters narrow the
list but never commit a selection; identical behavior wherever it is used.

## Consumed APIs (existing, unchanged)

- `GET /api/events` — the newest-first event list (feature 025 ordering). Consumed to populate + filter.
- `GET /api/series` — `{ items: [{ id, key, name }] }` for the series filter.

## Surface wiring (existing pages, unchanged behavior)

- **check-in** `onSelect={setEventId}` (roster load keys off `eventId`).
- **gate** `onSelect={openDoorRecord}` (opens/loads the selected event's door record — D2).
- **payments** `onSelect={loadEvent}` (loads bookings/payments).
- **treasurer** (`/treasurer`, new single page) `onSelect={setEventId}` (loads the treasurer report; reloads on
  switch).

## Route change

- `src/app/(admin)/treasurer/[eventId]/page.tsx` → **removed**; `src/app/(admin)/treasurer/page.tsx` (new)
  hosts the selector + report. Nav `/treasurer/latest` → `/treasurer`. No per-event URL (deep links out of
  scope).

## Unchanged

- The bookings report (multi-event list) does not use this selector. No API, schema, or migration change.
