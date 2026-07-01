# Quickstart & Validation: Organizer Report & Analytics

End-to-end validation guide. Implementation details live in `tasks.md`. Builds on features 002/003/004.

## Prerequisites

- Features 001–004 applied; Postgres running
- `pnpm install`; `.env` with `DATABASE_URL` / `TEST_DATABASE_URL`

## Setup

```bash
pnpm db:migrate     # applies 0009_organizer.sql (series_expense_parameters, misc_expenses; events.attendance_count)
pnpm db:seed        # optional; seeds sample rent/ongoing parameters
```

## Run

```bash
pnpm dev
# /organizer/tnc        — organizer report (rows + quarterly + trend charts)
# /expense-parameters   — set rent / ongoing effective-dated rates per series
```

## Validation scenarios

Map to acceptance scenarios in [spec.md](spec.md); contracts in [contracts/api.md](contracts/api.md).

1. **Per-dance Dance Net** (US1): for a series with several completed events, `GET
   /api/organizer/:seriesKey/report` returns per-dance rows; Dance Net = admission + merchandise −
   rent − performer total − ongoing − misc, exact to the cent (FR-003/SC-001).
2. **Colors + Break-Even** (US1): positive Dance Net flagged black, negative red; `breakEvenDancers`
   present only when Dance Net < 0 (FR-004/005/SC-004).
3. **Paying dancers + Avg Ticket** (US1): dancers = attendance_count − distinct performers − 1;
   Avg Ticket = admission ÷ dancers (no fee subtraction) (FR-006/013).
4. **Count survives purge** (US1): after the 90-day attendance purge (feature 002), per-dance dancer
   counts remain (the persisted `events.attendance_count`) (FR-014).
5. **Rent + ongoing** (US1): `POST /api/expense-parameters` for rent and ongoing; a booking on/after
   the effective date picks up the in-effect amount; older events use the prior value (FR-008/015).
6. **Misc expenses** (US1): `POST /api/events/:id/misc-expenses`; the row's Misc Expenses = ad-hoc
   entries + the door card fee (FR-016).
7. **Quarterly summary** (US2): report includes Q1–Q4 + YTD + Last Year with averaged metrics and FYI
   totals (FR-010/SC-002).
8. **Trend window** (US3): with ≥12 weeks (≤53) of data, `trend` has Dance Net + attendance panels
   with a 4-event rolling average; with <12 weeks, `trend` is null (FR-011).
9. **TNC includes Community Dance; ECD separate** (edge): the `tnc` report contains its same-evening
   Community Dance events; `ecd` is its own report (FR-001).

## Test commands

```bash
pnpm test:unit          # Dance Net, paying-dancers, Avg Ticket, quarterly, rolling-window (pure)
pnpm test:integration   # report assembly, expense params, misc expenses — real Postgres
pnpm typecheck && pnpm lint
```

Expected: all green; Dance Net exact to the cent; charts hidden below 12 weeks; per-dance counts
survive the 90-day purge.
