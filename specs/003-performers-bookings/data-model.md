# Phase 1 Data Model: Performers & Bookings

Storage: PostgreSQL 16. Pay in integer cents. Builds on feature 001 (`contacts`) and 002
(`events`, `series`).

## Enums

- `performer_type`: `caller | lead_musician | musician | open_band_musician | sound_tech | instructor`
- `rate_kind`: `caller | sound_tech`

## Static rule table (not persisted) — `performerRules.ts`

| performer_type | paid | requiresCheck | publicDisplay |
|---|---|---|---|
| caller | yes | yes (per paid caller booking) | full_bio |
| lead_musician | yes | yes (per paid musician booking) | full_bio |
| musician | yes | yes (per paid musician booking) | full_bio |
| open_band_musician | no | no | open_band_label |
| sound_tech | yes | yes (per paid sound-tech booking) | hidden |
| instructor | no (always free) | no | name_note |

`requires_check` on a booking is derived: `rule.requiresCheck AND pay_cents > 0`.

## Entity: Performer

| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| display_name | text NOT NULL | |
| contact_id | uuid FK→contacts NULL | optional link to a club contact |
| bio | text NULL | public bio (for full_bio types) |
| photo_url | text NULL | public photo |
| created_at / updated_at | timestamptz | |

- A performer may be booked in different roles over time (role lives on the booking, not here).

## Entity: RateParameter (append-only, effective-dated)

| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| kind | rate_kind NOT NULL | caller \| sound_tech |
| amount_cents | integer NOT NULL | standard pay |
| effective_date | date NOT NULL | applies to events on/after this date |
| created_at | timestamptz | |

- **Index**: (kind, effective_date DESC).
- Resolution: for a booking, pick the row of matching `kind` with the greatest
  `effective_date <= event.event_date`. No row → default pay 0 (organizer overrides).

## Entity: Booking

| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| event_id | uuid FK→events NOT NULL | the event (feature 002) |
| performer_id | uuid FK→performers NOT NULL | |
| performer_type | performer_type NOT NULL | the role for this booking |
| pay_cents | integer NOT NULL default 0 | $0 for donated / unpaid roles |
| is_donated | boolean NOT NULL default false | true = fee donated (counts appearance, excluded from earnings) |
| is_overridden | boolean NOT NULL default false | true when pay differs from the resolved rate |
| requires_check | boolean NOT NULL | derived = rule.requiresCheck AND pay_cents > 0 |
| note | text NULL | short note (e.g., instructor) |
| created_at / updated_at | timestamptz | |

- **Validation / invariants** (enforced in service):
  - `sound_tech` rejected when the event's series has `has_sound_tech = false` (Community Dance).
  - `instructor` and `open_band_musician` forced to `pay_cents = 0`, `requires_check = false`.
  - `instructor` always free (no override to a paid amount).
  - `is_donated = true` ⇒ `pay_cents = 0`, `requires_check = false`.
- **Index**: (event_id), (performer_id).

## Entity: RateParameterAudit (append-only)

| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| rate_kind | rate_kind NOT NULL | |
| amount_cents | integer NOT NULL | new value |
| effective_date | date NOT NULL | |
| actor | text | who |
| created_at | timestamptz | |

- Satisfies FR-011 (auditable rate-parameter changes).

## Relationships

- Performer 1—N Booking; Event 1—N Booking
- Performer 0..1—1 Contact (optional link)
- RateParameter has no FK (looked up by kind + date); RateParameterAudit records each change

## Derived / non-persisted

- **requires_check**: stored on the booking (derived at write) so the Treasurer Report (004) can list
  checks without recomputing.
- **Appearance history**: a performer's bookings (incl. $0/donated).
- **YTD earnings**: Σ `pay_cents` of the performer's bookings in the calendar year where
  `is_donated = false` and `pay_cents > 0`. Computed on read.
- **Performer total per event**: Σ `pay_cents` across the event's bookings; drill-down = booking list.
  Computed on read; consumed by features 004/005.
