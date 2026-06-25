# Phase 1 Data Model: Door Attendance & Gate Capture

Storage: PostgreSQL 16. Money is `integer` cents. Timestamps `timestamptz`. IDs are UUID. Builds on
feature 001 (`contacts`).

## Entity: Series

| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| key | text UNIQUE NOT NULL | e.g. tnc, ecd, community_dance |
| name | text NOT NULL | display name |
| has_sound_tech | boolean NOT NULL default true | Community Dance = false (informs feature 003) |
| created_at | timestamptz | |

- Seeded with TNC, ECD, Community Dance.

## Entity: EventGroup

| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| name | text NOT NULL | e.g. "Spring Dance Weekend 2026", "Double Dance 2026-05" |
| kind | event_group_kind NOT NULL | double_dance \| weekend \| jane_austen_ball \| other |
| created_at | timestamptz | |

- Groups ≥2 related events (Double Dance, multi-day weekend festival, JAB prep + ball).
- **Future (deferred, 007):** a single ticket purchased once and redeemable as admission across all
  events in the group. The entity is added now so events can be grouped; group-ticket purchase and
  redemption are out of scope for this phase.

## Entity: Event

| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| series_id | uuid FK→Series NOT NULL | |
| group_id | uuid FK→EventGroup NULL | non-null when the event belongs to a group |
| event_date | date NOT NULL | |
| charges_admission | boolean NOT NULL default true | false for free events (instructor-led, Fringe). Informational only — does NOT block a door record. |
| created_at | timestamptz | |

- **Index**: (series_id, event_date).
- A same-evening Community Dance is its own Event (separate door record).
- Free events (`charges_admission = false`) still support attendance and MAY record donations; a door
  record is permitted for them (no paid admission is collected). The UI hides the admission entry but
  allows donations.

## Entity: DoorRecord

| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| event_id | uuid FK→Event NOT NULL UNIQUE | 0-or-1 door record per event; created only when money is collected (always for paid events; for free events only if donations) |
| pos_transaction_count | integer NOT NULL default 0 | card-transaction count read from POS app by volunteer |
| pc_gross_cents | integer NOT NULL default 0 | **entered** total card via processor (was `pos_gross_cents`) |
| pos_fee_cents | integer NOT NULL | computed from card-txn count + pc_gross; NEVER returned to door UI (FR-007) |
| gross_cash_cents | integer NOT NULL default 0 | **entered** total cash counted (incl. seed float) |
| seed_float_cents | integer NOT NULL default 1500 | default $15, overridable |
| cash_paid_out_cents | integer NOT NULL default 0 | |
| cash_paid_out_reason | text | required when cash_paid_out_cents > 0 |
| deposit_cents | integer NOT NULL | computed = gross_cash − seed_float − cash_paid_out |
| gift_card_redemption_count | integer NOT NULL default 0 | gift cards redeemed for admission |
| created_at / updated_at | timestamptz | |

- **Validation**: `CHECK (cash_paid_out_cents = 0 OR cash_paid_out_reason IS NOT NULL)`.
- pos_fee_cents and deposit_cents are recomputed by the service on every write.

## Entity: GateSale

| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| door_record_id | uuid FK→DoorRecord ON DELETE CASCADE NOT NULL | |
| category | gate_category NOT NULL | enum (7 values) |
| payment_method | payment_method NOT NULL | cash \| card |
| amount_cents | integer NOT NULL default 0 | |
| contact_id | uuid FK→contacts NULL | required for named categories (donation/future_event/membership); null for anonymous |

- **Enum `gate_category`**: admission, merchandise, donation, future_event, membership,
  gift_card, misc_sales. (`admission` is the account-mapping/report key only; it is never stored as a
  gate-sale line — admission income is derived in the report.)
- **Enum `payment_method`**: cash, card.
- No uniqueness constraint (named categories may have several lines per category, one per contact);
  `putGateSales` uses replace-set semantics.

## Entity: Attendance

| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| event_id | uuid FK→Event ON DELETE CASCADE NOT NULL | attendance attaches to the event, not the door record |
| contact_id | uuid FK→contacts NULL | null = unmatched (declined) |
| created_at | timestamptz NOT NULL default now() | drives 90-day purge |

- **Index**: (event_id), (created_at) for purge scans.
- Attendance is independent of money: every event (free or paid) can have attendance with no door
  record. A contact created at the door is flagged for review (see contacts extension below).

## Entity: QuarterlyAttendanceCount (permanent aggregate)

| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| series_id | uuid FK→Series NOT NULL | |
| year | integer NOT NULL | |
| quarter | smallint NOT NULL CHECK (1..4) | |
| attendee_count | integer NOT NULL default 0 | cumulative, survives purge |

- **Unique**: (series_id, year, quarter). Counts for >90-day attendance are added here in the same
  transaction that purges those rows, so the rollup is idempotent (no per-event tracking flag needed).

## Entity: DoorRecordAudit (append-only)

| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| door_record_id | uuid FK→DoorRecord ON DELETE CASCADE NOT NULL | |
| action | text NOT NULL | created \| updated |
| actor | text | who (header-supplied until login lands) |
| details | jsonb | changed fields / summary |
| created_at | timestamptz NOT NULL default now() | |

- Satisfies FR-012 (auditable creation/edits of door financial records), mirroring feature 001's
  `status_change_audit` / `merge_audit` pattern.

## Extension to feature 001: Contact review flag

| Field | Type | Notes |
|---|---|---|
| needs_review | boolean NOT NULL default false | true when created at the door (FR-003) |
| source | text | e.g. 'door' for door-created contacts |

- Added to `contacts` via this feature's migration; surfaces door-created contacts in the admin queue.

## Relationships

- Series 1—N Event; Event 1—0..1 DoorRecord (door record only when money is collected)
- EventGroup 1—N Event (an event optionally belongs to one group)
- DoorRecord 1—N GateSale
- Event 1—N Attendance; Attendance N—0..1 Contact (null = unmatched)
- Series 1—N QuarterlyAttendanceCount (rolled up from attendance via the event's date)

## Derived / non-persisted

- Dance Gate, Net Gate, Avg Ticket etc. are computed in features 004/005 from these rows — not stored
  here.
- pos_fee_cents is stored but excluded from all door-facing responses.
