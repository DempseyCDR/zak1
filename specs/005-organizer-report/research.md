# Phase 0 Research: Organizer Report & Analytics

Stack fixed by build 1 (TS/Next.js + Postgres). The `/speckit-clarify` session resolved the major
ambiguities (Dance Net composition, paying dancers, count persistence, rent, misc expenses, Avg
Ticket, chart window). Decisions below record the design. No NEEDS CLARIFICATION remain.

## Decision 1 — Report is a computed read-model

- **Decision**: Assemble the report on demand from events + door records + gate sales + bookings +
  expense parameters + misc expenses + the persisted per-event attendance count. Nothing about the
  report (rows/quarterly/trends) is persisted.
- **Rationale**: Inputs are immutable per closed event and already stored; recomputing avoids drift
  (YAGNI). Matches feature 004's approach.
- **Alternatives considered**: Materialized `dance_result` table (needless duplication + refresh logic).

## Decision 2 — Dance Net composition (from clarify Q1)

- **Decision**: `Dance Net = admission + merchandise − rent − performer total − ongoing expense − misc
  expenses`, all integer cents. Admission and merchandise come from the gate breakdown; performer total
  from bookings; rent + ongoing from the effective-dated parameters; misc from ad-hoc entries + the
  door card fee.
- **Rationale**: Confirmed by the organizer; merchandise (fundraising) offsets event cost. "Admissions
  only" was a treasurer/QBO classification rule, not Dance Net.

## Decision 3 — Shared gate/admission computation

- **Decision**: Extract the admission derivation (cash = gross cash − seed float − non-admission cash;
  card = card gross − non-admission card) and per-category totals from feature 004's `reportService`
  into `domain/gate/eventMoney.ts`; both 004 and 005 consume it.
- **Rationale**: Single source of truth for "what admission/merchandise/etc. is" avoids the two reports
  diverging. Constitution: reuse over duplication.
- **Alternatives considered**: Duplicate the logic in 005 (drift risk).

## Decision 4 — Paying dancers + persisted attendance count (clarify Q2/Q3)

- **Decision**: Add a persisted `attendance_count` integer on `events`, incremented by the attendance
  service on each check-in (insert only). The 90-day purge bulk-deletes attendance rows but does NOT
  touch this counter, so it survives. `paying_dancers = attendance_count − distinct booked performers −
  1 (door attendant)`, floored at 0.
- **Rationale**: A counter on the always-present `event` is the minimal persistent, non-identifiable
  source; survives the contact-tracing purge; no snapshot table needed (YAGNI).
- **Alternatives considered**: Snapshot table (heavier); compute live from attendance (blanks after 90
  days). Distinct performers via `bookings` (distinct performer_id for the event).

## Decision 5 — Rent + Ongoing Expense as one effective-dated table (clarify Q4, FR-008/015)

- **Decision**: `series_expense_parameters (series_id, kind ['rent'|'ongoing'], amount_cents, label
  NULL, effective_date)`. Resolution: greatest `effective_date ≤ event date` per (series, kind).
  `label` carries the ongoing-expense name (e.g., "Equipment Depreciation"); rent has none. Changes are
  append-only + audited (mirrors 003 rate parameters).
- **Rationale**: Rent and ongoing are both per-series, effective-dated, auto-selected by date — one
  mechanism. Rent is a venue stand-in until the deferred venue model (BACKLOG B12).
- **Alternatives considered**: Two separate tables (needless); per-venue rent (venue deferred).

## Decision 6 — Misc expenses (clarify Q5, FR-016)

- **Decision**: `misc_expenses (event_id, description, amount_cents)` per event; Misc Expenses total =
  Σ ad-hoc entries + the door card fee (`pos_fee_cents` on the door record).
- **Rationale**: Matches "ad-hoc + CC fees"; the card fee stays a single source of truth on the door
  record.

## Decision 7 — Avg Ticket (clarify correction)

- **Decision**: `Avg Ticket = admission (gross gate) ÷ paying dancers`; door card fees are NOT
  subtracted (no "Net Gate"). Card fees affect Dance Net only via Misc Expenses.

## Decision 8 — Quarterly summary & rolling trend window

- **Decision**: Quarters are calendar quarters (Phase 1). Quarterly summary = Q1–Q4 + YTD + Last Year
  with averaged metrics + FYI category totals, computed on read. Rolling trend charts render only when
  12 ≤ weeks of data ≤ 53 (window capped at the most recent 53 weeks; hidden below 12); two panels
  (Dance Net, attendance) with a 4-event rolling-average line; positive/negative Dance Net colors;
  hover/tap detail.
- **Rationale**: Direct from spec + clarify. Pure aggregation/selection functions → unit-testable.

## Decision 9 — Charts implementation

- **Decision**: Render charts client-side with lightweight SVG (or a small chart lib) in the report
  page; charting tech is an implementation detail (spec). No automated UI test (project-wide pattern);
  the chart *data* (series, rolling average, window selection) is unit-tested as pure functions.
- **Rationale**: Keeps deps light; the testable logic is the data prep, not the SVG.

**Output**: research complete; ready for data-model and contracts.
