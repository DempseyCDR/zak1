# API Contracts: Organizer Report & Analytics

Internal HTTP API (Next.js route handlers). JSON; Zod-validated; uniform error shape
`{ error: { code, message } }`. Money serialized as dollar decimals; integer cents internally.

## Organizer report

### GET /api/organizer/:seriesKey/report?year=

Assembles the per-series report (the `tnc` report also includes its same-evening Community Dance events;
`ecd` separate). `year` optional (defaults to current calendar year for quarterly YTD/Last-Year).

- 200 → `{
    series: { key, name },
    perDanceRows: {
      eventId, date, series, caller, band, dancers,
      grossGate, merchandise, rent, performerTotal, ongoingExpense, miscExpenses,
      danceNet, danceNetNegative, avgTicket, breakEvenDancers | null,
      performers: { name, type, amount }[],   // per-performer drill-down of Performer Total (FR-007)
      fyi: { donations, memberships, futureEvent, giftCards, miscSales }
    }[],
    quarterlySummary: {
      quarters: { quarter, count, avgDancers, avgGross, avgMerchandise, avgRent,
                  avgPerformerTotal, avgOngoing, avgMisc, avgDanceNet, avgTicket,
                  fyi: {...} }[],   // Q1–Q4
      ytd: {...}, lastYear: {...}
    },
    trend: null | {
      weeks: number,               // 12..53
      danceNet: { date, value, negative }[],
      danceNetTrend: { date, value }[],   // 4-event rolling average
      attendance: { date, value }[],
      attendanceTrend: { date, value }[],
      points: { date, danceNet, dancers, caller, band }[]  // hover payload
    }
  }`
- `trend` is `null` when fewer than 12 weeks of data exist; otherwise a rolling window capped at 53 weeks.
- 404 `SERIES_NOT_FOUND`.

## Expense parameters (rent + ongoing, effective-dated)

### POST /api/expense-parameters

Body: `{ seriesKey: string, kind: "rent"|"ongoing", amount: number, label?: string, effectiveDate: string (YYYY-MM-DD) }`.

- 201 → `SeriesExpenseParameter` (append-only); writes an audit entry. 404 `SERIES_NOT_FOUND`.

### GET /api/expense-parameters?seriesKey=&kind=&on=

- 200 → `{ resolved: { seriesKey, kind, amount, label, effectiveDate } | null }` — the parameter in
  effect for (series, kind) on date `on`.

## Misc expenses (per event)

### POST /api/events/:id/misc-expenses

Body: `{ description: string, amount: number }`.

- 201 → `MiscExpense`. 404 `EVENT_NOT_FOUND`.

### GET /api/events/:id/misc-expenses

- 200 → `{ items: MiscExpense[], total: number }` (total excludes the card fee; the report adds it).

## Enums

- `SeriesExpenseKind`: `rent | ongoing`

## Error codes

`SERIES_NOT_FOUND` (404) · `EVENT_NOT_FOUND` (404) · `VALIDATION_ERROR` (422)

## Notes

- Read-only report; no persisted report rows. Dance Net, paying dancers, Avg Ticket, quarterly
  aggregation, and the rolling-window selection are pure functions (unit-tested); assembly is
  integration-tested against real Postgres.
- Admission/merchandise/FYI category totals come from the shared gate-breakdown module (feature 004).
