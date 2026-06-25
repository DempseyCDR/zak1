# Phase 0 Research: Treasurer Report & QBO Hand-off

Stack fixed by build 1 (TS/Next.js + Postgres). Decisions below resolve feature-specific design.
No NEEDS CLARIFICATION remain.

## Decision 1 — Report is a computed read-model

- **Decision**: The Treasurer Report is assembled on demand from existing rows (event/series, door
  record + gate sales, bookings + performers) plus the mapping config. Nothing about the report is
  persisted; report *generation* is audited.
- **Rationale**: The report is a view for manual entry, not a system of record (the accounting system
  is). Persisting it would duplicate source data and risk drift (YAGNI).
- **Alternatives considered**: Snapshotting reports (needless; source data is immutable per event and
  already audited).

## Decision 2 — Configurable account/class mapping

- **Decision**: Two small config tables, seeded from CDR's chart of accounts:
  - `account_mapping`: app line key → accounting account code + name. Keys cover gate categories
    (today_admission→4210, merchandise→4700, donation→4100, future_event→4200, membership→4300,
    gift_card→2201 liability, misc_sales→4900), performer pay (caller→5320, lead_musician→5310,
    sound_tech→5330), rent→5420, fees→5810, deposit→1021.
  - `series_qbo_map`: series → gate customer ("Contra Gate"/"English Gate") + accounting class.
  Both are editable; edits are audited (FR-014).
- **Rationale**: FR-006 requires per-club configurable mapping; account numbers are real-world domain
  constraints (existing chart of accounts), so they are seeded, not hardcoded in logic.
- **Alternatives considered**: Hardcoding the map (fails FR-006 configurability); a single wide table
  (less clear than account-by-line + class/customer-by-series).

## Decision 3 — Named-customer receipts split

- **Decision**: The gate receipt is anonymous (customer from `series_qbo_map`). Memberships and
  advance tickets (gate categories `membership`, `future_event`) are pulled out into separate
  named-customer receipts and excluded from the gate receipt.
- **Rationale**: FR-004/005, SC-004 — these must never appear on the anonymous gate receipt.
- **Alternatives considered**: One receipt with mixed customers (violates the spec).

## Decision 4 — Fees: door fee reused, online fee calculator added

- **Decision**: The door POS fee is read from the door record's stored `pos_fee_cents` (computed in
  feature 002). An `onlineFeeCents(transactions, grossCents) = round(0.49×100×txns) +
  round(grossCents×0.0199)` calculator is added now (FR-008) but applied only to online orders, which
  arrive with feature 007; in Phase 1 the Fees section shows the door fee (online portion is 0 until
  007). Revenue is reported at gross; fees are informational only (FR-009).
- **Rationale**: Avoids recomputing the door fee (single source of truth) while still implementing the
  online formula the spec requires.
- **Alternatives considered**: Recompute door fee here (drift risk).

## Decision 5 — Check numbers on performer payments

- **Decision**: Add an optional `check_number` to bookings, entered by the treasurer (PATCH). The
  Performer Payments section lists each paid booking with payee (performer), amount, account (by
  performer type), class (by series), and the check number.
- **Rationale**: FR-011 requires presenting the check number; the number is assigned when the physical
  check is written, so it is treasurer-entered. Smallest change (one nullable column on the existing
  bookings table) vs. a separate payments table (YAGNI).
- **Alternatives considered**: Separate `performer_payment` table (more moving parts for one field).

## Decision 6 — Non-Dance Income & gift cards

- **Decision**: Non-Dance Income (account 4910) is captured as per-event `non_dance_income` entries
  (description, amount, date) and shown as its **own section** of the Treasurer Report — separate from
  dance income and never in gate totals or Dance Net (FR-010). The Organizer Report (005) ignores
  these rows. Gift-card sales map to the liability account 2201 (FR-007); the redemption→revenue
  journal entry is a manual treasurer action noted in the report, not automated.
- **Rationale**: The treasurer needs non-dance income in the books, but it must not distort dance
  metrics. Per-event entries keep the per-event report self-contained; the organizer view filters them
  out. Earlier the requirement wrongly excluded non-dance income from the treasurer report (corrected).
- **Alternatives considered**: A standalone non-dance ledger (doesn't fit the per-event report flow);
  free-form non-persisted entry (loses auditability and reuse for the books).

## Decision 7 — No accounting API

- **Decision**: Phase 1 produces a screen-first, printable report for manual copy/paste; no CSV import
  and no accounting-system API (FR-013).

**Output**: research complete; ready for data-model and contracts.
