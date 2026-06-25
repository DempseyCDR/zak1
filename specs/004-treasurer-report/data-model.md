# Phase 1 Data Model: Treasurer Report & QBO Hand-off

Storage: PostgreSQL 16. Money in integer cents. Builds on features 002 (`events`, `series`,
`door_records`, `gate_sales`) and 003 (`bookings`, `performers`). The report is **computed**, not
persisted; only mapping config + a booking `check_number` are new persistence.

## Entity: AccountMapping (config, editable)

| Field | Type | Notes |
|---|---|---|
| line_key | text PK | app line being booked (see keys below) |
| account_code | text NOT NULL | accounting account number, e.g. "4210" |
| account_name | text NOT NULL | e.g. "Program Service Revenue:Dance Gate" |
| updated_at | timestamptz | |

- **line_key** values (seeded): `today_admission`, `merchandise`, `donation`, `future_event`,
  `membership`, `gift_card`, `misc_sales`, `caller`, `lead_musician`, `sound_tech`, `rent`, `fees`,
  `deposit`, `non_dance_income`. (Maps gate categories, performer-pay kinds, the deposit/fees lines,
  and non-dance income to accounts; `non_dance_income` → 4910.)
- Edits append a `mapping_audit` row (FR-014).

## Entity: SeriesQboMap (config, editable)

| Field | Type | Notes |
|---|---|---|
| series_id | uuid PK FK→series | one row per series |
| gate_customer | text NOT NULL | "Contra Gate" or "English Gate" |
| qbo_class | text NOT NULL | accounting class for this series' lines |

- Seeded: TNC & Community Dance → "Contra Gate"; ECD → "English Gate"; class per series.
- Edits append a `mapping_audit` row (FR-014).

## Entity: MappingAudit (append-only)

| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| mapping_kind | text NOT NULL | "account" \| "series_qbo" |
| key | text NOT NULL | line_key or series_id |
| details | jsonb | new values |
| actor | text | who |
| created_at | timestamptz | |

- Satisfies FR-014 (auditable mapping edits).

## Entity: TreasurerReportAudit (append-only)

| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| event_id | uuid FK→events NOT NULL | |
| actor | text | who generated it |
| created_at | timestamptz | |

- Satisfies FR-014 (auditable report generation).

## Entity: NonDanceIncome (per-event entries)

| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| event_id | uuid FK→events NOT NULL | the event the entry is recorded against |
| description | text NOT NULL | e.g. "ESL bank interest", "Rochester arts grant" |
| amount_cents | integer NOT NULL | |
| entry_date | date NOT NULL | |
| created_at | timestamptz | |

- Booked to account 4910 (Other Miscellaneous Revenue) via `account_mapping` key `non_dance_income`.
- Surfaced as the report's **Non-Dance Income** section; never flows into gate totals or Dance Net
  (FR-010). The Organizer Report (005) ignores these rows entirely.
- **Index**: (event_id).

## Extension to feature 003: Booking check number

| Field | Type | Notes |
|---|---|---|
| check_number | text NULL | treasurer-entered when the check is written (FR-011) |

- Added to `bookings` via this feature's migration.

## Computed view: TreasurerReport (not persisted)

Assembled per event from source rows + mapping. Shape:

- **gateSalesSummary**: per gate category (excluding `membership`, `future_event` which are
  named-customer; excluding non-dance income), cash+card totals, mapped account + class, under the
  anonymous gate customer; plus a **POS verification line** (door record `pos_gross_cents` and, for
  reconciliation only, `pos_fee_cents`).
- **namedCustomerReceipts**: separate receipts for `membership` (acct 4300) and `future_event`
  advance tickets (acct 4200).
- **performerPayments**: each paid booking → { payee (performer name), amountCents, accountCode (by
  performer type), qboClass (by series), checkNumber }. Excludes $0/donated and unpaid roles.
- **deposit**: door record `deposit_cents` → account 1021 (checking).
- **fees** (informational): door fee (`pos_fee_cents`) + online fee (0 until feature 007); account 5810.
- **nonDanceIncome**: the event's `non_dance_income` entries → account 4910; a separate section,
  excluded from gate totals and Dance Net (FR-010).

All amounts integer cents internally; serialized as dollars at the API boundary.

## Relationships

- AccountMapping / SeriesQboMap are standalone config; MappingAudit & TreasurerReportAudit are
  append-only logs.
- The report reads Event→Series→SeriesQboMap, DoorRecord→GateSales, Bookings→Performers, AccountMapping.

## Derived / non-persisted

- The report is derived from source rows (now including `non_dance_income` entries). Gift cards book to
  liability (2201); the redemption→revenue journal entry is a manual treasurer action surfaced as a
  note, not stored. Non-Dance Income (4910) is its own section, never in gate totals or Dance Net.
