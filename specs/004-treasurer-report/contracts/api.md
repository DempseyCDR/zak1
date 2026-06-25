# API Contracts: Treasurer Report & QBO Hand-off

Internal HTTP API (Next.js route handlers). JSON; Zod-validated; uniform error shape
`{ error: { code, message } }`. Money serialized as dollar decimals; integer cents internally.

## Treasurer report

### GET /api/events/:id/treasurer-report
Assembles and returns the five-section report for the event; writes a report-generation audit entry.
- 200 → `{
    event: { id, date, seriesKey },
    gateSalesSummary: { customer, posVerification: { gross, fee }, lines: { category, account, class, cash, card, total }[] },
    namedCustomerReceipts: { kind: "membership"|"future_event", account, class, amount }[],
    performerPayments: { payee, amount, account, class, checkNumber|null }[],
    deposit: { account, amount },
    fees: { account, doorFee, onlineFee, total },
    nonDanceIncome: { account, lines: { description, amount, date }[], total }
  }`
- 404 `EVENT_NOT_FOUND`; 404 `DOOR_RECORD_NOT_FOUND` if the event has no door record yet.
- `nonDanceIncome` is a separate section (account 4910) and never flows into `gateSalesSummary` or any
  dance total; `membership`/`future_event` never appear under `gateSalesSummary`.

## Account / class mapping (config)

### GET /api/qbo-mapping
- 200 → `{ accounts: { lineKey, accountCode, accountName }[], series: { seriesKey, gateCustomer, qboClass }[] }`.

### PUT /api/qbo-mapping/accounts/:lineKey
Body: `{ accountCode: string, accountName: string }`.
- 200 → updated row; appends a mapping audit entry. 404 `MAPPING_KEY_NOT_FOUND` for unknown lineKey.

### PUT /api/qbo-mapping/series/:seriesId
Body: `{ gateCustomer: string, qboClass: string }`.
- 200 → updated row; appends a mapping audit entry. 404 `SERIES_NOT_FOUND`.

## Non-Dance Income (per-event entries)

### POST /api/events/:id/non-dance-income
Body: `{ description: string, amount: number, entryDate: string (YYYY-MM-DD) }`.
- 201 → `NonDanceIncome`. 404 `EVENT_NOT_FOUND`.

### GET /api/events/:id/non-dance-income
- 200 → `{ items: NonDanceIncome[], total: number }`.

## Performer check numbers

### PATCH /api/bookings/:id/check
Body: `{ checkNumber: string | null }`.
- 200 → `Booking` with `checkNumber` set. 404 `BOOKING_NOT_FOUND`.

## Error codes

`EVENT_NOT_FOUND` (404) · `DOOR_RECORD_NOT_FOUND` (404) · `SERIES_NOT_FOUND` (404) ·
`MAPPING_KEY_NOT_FOUND` (404) · `BOOKING_NOT_FOUND` (404) · `VALIDATION_ERROR` (422)

## Notes

- No accounting-system API or CSV import (FR-013): this report is for manual copy/paste only.
- Online fee is computed by the same calculator the door uses for its formula, but online orders do
  not exist until feature 007; until then `fees.onlineFee` is 0.
