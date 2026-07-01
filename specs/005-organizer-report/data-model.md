# Phase 1 Data Model: Organizer Report & Analytics

Storage: PostgreSQL 16. Money in integer cents. Builds on features 002 (`events`, `series`,
`door_records`, `gate_sales`, `attendance`) and 003 (`bookings`, `performers`). The report itself is
computed; only new parameters/expenses + a persisted counter are added.

## Enum

- `series_expense_kind`: `rent`, `ongoing`

## Entity: SeriesExpenseParameter (append-only, effective-dated)

| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| series_id | uuid FK→series NOT NULL | |
| kind | series_expense_kind NOT NULL | rent \| ongoing |
| amount_cents | integer NOT NULL | per-event amount applied in Dance Net |
| label | text NULL | ongoing-expense name (e.g., "Equipment Depreciation"); null for rent |
| effective_date | date NOT NULL | applies to events on/after this date |
| created_at | timestamptz | |

- **Index**: (series_id, kind, effective_date DESC).
- **Resolution**: for an event, pick the row of matching (series_id, kind) with the greatest
  `effective_date ≤ event.event_date`; none → 0. (FR-008 ongoing, FR-015 rent.)
- Changes are append-only; each is audited (mirrors 003 rate-parameter audit).

## Entity: MiscExpense (per event)

| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| event_id | uuid FK→events ON DELETE CASCADE NOT NULL | |
| description | text NOT NULL | |
| amount_cents | integer NOT NULL | |
| created_at | timestamptz | |

- Misc Expenses total for an event = Σ these rows + the door record's `pos_fee_cents` (card fee). (FR-016)
- **Index**: (event_id).

## Extension to feature 002: persisted attendance count

| Field | Type | Notes |
|---|---|---|
| attendance_count | integer NOT NULL default 0 | on `events`; incremented by the attendance service on each check-in |

- Survives the 90-day contact-tracing purge (the purge deletes `attendance` rows but never decrements
  this counter). Source for paying dancers. (FR-014)

## Computed view: OrganizerReport (not persisted)

Assembled per series (TNC report also includes its Community Dance events; ECD separate).

- **perDanceRows**: one row per event (ordered by date), each with:
  - date, series, caller, band (from bookings: caller name; band = lead musicians / "Open Band"),
  - **dancers** = `attendance_count − distinct booked performers − 1`, floored at 0 (FR-013),
  - grossGate (admission), merchandise, rent, performerTotal, ongoingExpense, miscExpenses,
  - **danceNet** = admission + merchandise − rent − performerTotal − ongoingExpense − miscExpenses (FR-003),
  - **avgTicket** = admission ÷ dancers (FR-006; no fee subtraction),
  - **breakEvenDancers** = shown only when danceNet < 0 (FR-005),
  - FYI columns: donations, memberships, future_event, gift_cards, misc_sales (excluded from Dance Net, FR-009),
  - danceNetSign (for black/red coloring, FR-004).
- **quarterlySummary**: per series, Q1–Q4 + YTD + Last Year — count + averages (dancers, gross,
  merchandise, rent, performer total, ongoing, misc, Dance Net, Avg Ticket) + FYI quarter totals (FR-010).
- **trend**: rendered only for 12 ≤ weeks ≤ 53 (rolling window capped at 53 weeks); two series —
  Dance Net and attendance — each with per-event points + a 4-event rolling-average line; Dance Net
  point signs for coloring; hover payload {date, danceNet, dancers, caller, band} (FR-011/012).

All amounts integer cents internally; serialized as dollars at the API boundary.

## Relationships

- Series 1—N SeriesExpenseParameter; Event 1—N MiscExpense
- Report reads: Series→Events→(DoorRecord→GateSales, Bookings→Performers, MiscExpenses,
  events.attendance_count) + SeriesExpenseParameter (rent/ongoing by date)

## Derived / non-persisted

- The whole report (rows, quarterly, trend) is derived. Admission/merchandise/gate-category totals come
  from the shared `domain/gate/eventMoney.ts` (extracted from feature 004). FYI categories are shown
  but never enter Dance Net.
