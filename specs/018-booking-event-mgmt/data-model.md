# Phase 1 Data Model: Booking & Event Management

Additive only. Migration `0023_booking_event_mgmt.sql`. Two new enums, four new columns; no drops, no
backfill risk (safe defaults / nullable).

## Schema deltas

### `bookings` (feature 003; extended)

| Column | Type | Default | Notes |
|---|---|---|---|
| **`status`** | `booking_status` `NOT NULL` | `'proposed'` | **B23.** Lifecycle state (below). New bookings default `proposed`; **existing bookings are backfilled to `confirmed`** by the migration (they predate the lifecycle and were treated as final — see FR-022, so the public display doesn't regress). |

New enum: `booking_status = ('proposed', 'requested', 'confirmed', 'declined')`.

### `events` (feature 002/007/013; extended)

| Column | Type | Default | Notes |
|---|---|---|---|
| **`status`** | `event_status` `NOT NULL` | `'scheduled'` | **B25.** `cancelled` is a retained, public-visible state. |
| **`advertised_price_cents`** | `integer` (nullable) | `NULL` | **B27.** Public display price; **never** an accounting input. Independent of `charges_admission`. |

New enum: `event_status = ('scheduled', 'cancelled')`.

### `venues` (feature 007; extended)

| Column | Type | Default | Notes |
|---|---|---|---|
| **`landlord_contact_id`** | `uuid` (nullable) FK → `contacts(id)` `ON DELETE SET NULL` | `NULL` | **B22.** Optional single landlord; degrades gracefully on contact delete/merge. |

## State machines

### Booking status (B23)

```text
                 re-point (new performerId) ─┐
                                             ▼
  (create) ─▶ proposed ─▶ requested ─▶ confirmed
                 ▲            │             │
                 │            ▼             ▼
              declined ◀──────┴─────────────┘   (any non-terminal → declined)
                 │
                 └─▶ proposed   (revive)
```

- **create / bookBand** → `proposed`.
- `proposed → requested → confirmed` (forward only; skipping a step is rejected).
- any of `proposed`/`requested`/`confirmed` `→ declined`.
- `declined → proposed` (revive); **re-point** (change `performerId`) forces `→ proposed` for the new
  performer, keeping the same booking row (its check number etc. are cleared with the pay reset as today).

### Event status (B25)

```text
  (create) ─▶ scheduled ⇄ cancelled      (cancel / revive; both event.write, Booker-scoped)
              delete allowed here ─────▶ (removed)   only when NO door record / attendance / checked-paid booking
```

## Derivations & rules

- **Delete guardrail (B25 / FR-010)**: `DELETE /api/events/[id]` is refused (409) when **any** of these
  exist for the event — a `door_records` row, ≥1 `attendance` row, or ≥1 `bookings` row **with a check
  number** (`check_number IS NOT NULL` = an actual recorded payment). A non-zero `pay_cents` is **not** a
  trigger — it is just the booked rate present on nearly every booking, so keying on it would block delete
  for any event with a performer (the rejected "block on any booking" option). Otherwise the event and its
  dependent rows are removed.
- **Recurrence (B26 / FR-012/FR-014)**: dates = `firstDate + k·(everyNWeeks·7 days)` for k = 0,1,… while
  `≤ lastDate`; `everyNWeeks ≥ 1` (default 1). Count `0` → create nothing; count `> 60` → refuse (422). Each
  generated row is a normal independent event (series, start time, no group link unless specified).
- **Public shows only confirmed bookings (B23 / FR-022)**: the public read model
  (`getPublicSchedule`/`getPublicEventDetail` + band/performer display) filters bookings to
  `status = 'confirmed'`. Internal reports (treasurer/organizer + the B24 cross-event report) are unaffected
  — they include all statuses. Performer **pay** is never in the public model.
- **Advertised price (B27 / FR-018)**: read only by the public schedule/detail; **not** referenced by
  `computeEventGate`, the treasurer report, or the organizer report.
- **Cancelled events in reports**: retained everywhere (a state, not a deletion); the public schedule shows
  them **marked cancelled** rather than hiding them (FR-009/FR-011).

## Validation (Zod boundaries)

### `bookingPatchSchema` (extended — `src/server/validation/performers.ts`)

- add `status?: 'proposed' | 'requested' | 'confirmed' | 'declined'` (transition validated in-service).
- add `performerId?: uuid` (re-point; forces status → `proposed`).
- existing `pay` / `isDonated` / `note` unchanged.

### `assignVenueSchema` (extended — `src/server/validation/venues.ts`; the event PATCH body)

- add `eventDate?: YYYY-MM-DD` (reschedule) → mapped to `event.write` in `EVENT_FIELDS`.
- add `status?: 'scheduled' | 'cancelled'` → `event.write`.
- add `advertisedPriceCents?: int ≥ 0 | null` → `event.public.write`.

### `recurringEventsSchema` (new — `src/server/validation/venues.ts` or an events schema module)

```text
{ seriesKey: string, firstDate: YYYY-MM-DD, lastDate: YYYY-MM-DD,
  everyNWeeks: int ≥ 1 (default 1), startTime?: HH:MM, groupId?: uuid, chargesAdmission?: bool }
```

### `venuePatchSchema` (extended — `src/server/validation/venues.ts`)

- add `landlordContactId?: uuid | null`.

## Entity relationships (unchanged shape, new links)

```text
series 1──* events *──1 event_groups
events.status (scheduled|cancelled) · events.advertised_price_cents
events 1──* bookings   (bookings.status: proposed|requested|confirmed|declined)
bookings *──1 performers *──0..1 contacts
venues 1──* events ; venues.landlord_contact_id ──▶ contacts (nullable, SET NULL)
```

No new tables — four scalar columns on three tables plus two enums.

## Migration outline (`0023_booking_event_mgmt.sql`)

```sql
CREATE TYPE booking_status AS ENUM ('proposed', 'requested', 'confirmed', 'declined');
CREATE TYPE event_status   AS ENUM ('scheduled', 'cancelled');

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS status booking_status NOT NULL DEFAULT 'proposed';
-- FR-022: pre-lifecycle bookings were final → confirmed, so the public display doesn't regress.
-- New bookings keep the 'proposed' default.
UPDATE bookings SET status = 'confirmed';
ALTER TABLE events   ADD COLUMN IF NOT EXISTS status event_status   NOT NULL DEFAULT 'scheduled';
ALTER TABLE events   ADD COLUMN IF NOT EXISTS advertised_price_cents integer;
ALTER TABLE venues   ADD COLUMN IF NOT EXISTS landlord_contact_id uuid
  REFERENCES contacts(id) ON DELETE SET NULL;
```

Additive and safe on the persistent `zak1_dev`; auto-applied to `zak1_test`.
