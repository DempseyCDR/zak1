# Quickstart & Validation: Treasurer Report & QBO Hand-off

End-to-end validation guide. Implementation details live in `tasks.md`. Builds on features 002/003.

## Prerequisites

- Features 001/002/003 applied; Postgres running
- `pnpm install`; `.env` with `DATABASE_URL` / `TEST_DATABASE_URL`

## Setup

```bash
pnpm db:migrate     # applies 0006_treasurer.sql (account_mapping, series_qbo_map, mapping_audit, treasurer_report_audit; +bookings.check_number)
pnpm db:seed        # seeds the CDR chart-of-accounts mapping + series gate customers/classes
```

## Run

```bash
pnpm dev
# /treasurer/<eventId> — printable per-event report
# /qbo-mapping         — edit account/class mapping
```

## Validation scenarios

Map to acceptance scenarios in [spec.md](spec.md); contracts in [contracts/api.md](contracts/api.md).

1. **Five sections** (US1): `GET /api/events/:id/treasurer-report` returns Gate Sales Summary,
   Named-Customer Receipts, Performer Payments, Deposit, and Fees. (FR-001)
2. **POS verification + deposit** (US1): gate summary includes the POS gross verification line;
   deposit shows the door record's deposit → account 1021. (FR-003/012)
3. **Account/class mapping** (US2): each category lands on its configured account; the gate customer is
   "Contra Gate" for TNC/Community Dance and "English Gate" for ECD; gift-card sale → liability 2201.
   (FR-004/006/007, SC-003)
4. **Named-customer split** (US2): membership and advance-ticket (future_event) lines appear as
   separate named-customer receipts and never on the gate receipt. (FR-005/SC-004)
5. **Same-evening events** (US2): a Community Dance + TNC produce two gate receipts, both "Contra Gate".
6. **Fees at gross** (US3): revenue reported at gross; door fee = $0.09×txns + 2.29%×gross shown in the
   Fees section only; online fee calculator = $0.49×txns + 1.99%×amount (0 until feature 007). (FR-008/009)
7. **Performer checks** (US1): `PATCH /api/bookings/:id/check` sets a check number; the Performer
   Payments section shows payee, amount, account (by type), class, check number. (FR-011)
8. **Non-Dance Income** (edge): `POST /api/events/:id/non-dance-income` records an entry; the report
   shows it as a separate Non-Dance Income section (account 4910) that never appears in the gate
   summary or any dance total. (FR-010)
9. **Audit** (FR-014): generating a report and editing a mapping each write an audit entry.

## Test commands

```bash
pnpm test:unit          # fee calculators + mapping resolution (pure-ish)
pnpm test:integration   # report assembly, mapping, named-customer split, exclusions — real Postgres
pnpm typecheck && pnpm lint
```

Expected: all green; revenue at gross; named-customer items never on the gate receipt; no fee figure
inflates revenue.
