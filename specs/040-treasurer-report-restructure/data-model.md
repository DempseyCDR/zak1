# Phase 1 Data Model: Treasurer Report QBO Restructure (+ counts)

Adds three fields to one assembled type; **no database change**. All inputs are existing columns.

## Type changes: `TreasurerReport` (`domain/treasurer/reportService.ts`)

### Added

| Field | Type | Source | Notes |
|-------|------|--------|-------|
| `bills` | `{ vendor: string; class: string; amount: number }[]` | `resolveEventRentCents(db, event)` + venue landlord | One entry: the venue **rent** bill. `amount` in dollars (cents→dollars like every figure). `vendor` = landlord display name, else `"(no landlord set)"`. `class` = series `qboClass`. **No payment/check line** (FR-004). Array for future bills (B42) though only rent today. |
| `compCount` | `number` | `door_records.comp_count` (raw) | Free-admission count (Decision 4). Reconciliation aid only (FR-014). |
| `giftCardRedemptionCount` | `number` | `door_records.gift_card_redemption_count` | Gift cards **redeemed** for admission (distinct from the gate `gift_card` **sales** line). |

### Unchanged (figure parity — FR-010 / SC-002)

`gateSalesSummary` (customer, posVerification, lines), `namedCustomerReceipts`, `performerPayments` (+ `lines`),
`voidedPerformerPayments`, `performerReconciliation`, `deposit`, `fees` — **identical values**. The reshape adds
fields; it changes none of these.

## Presentation order (treasurer page — the QBO handoff)

The page renders the report in QBO data-entry order (FR-001); the report type supplies the data:

1. **Sales Receipts**
   1. **Gate / attendance receipt** (`gateSalesSummary`) — FIRST; customer = series gate customer; admission +
      merchandise + gift-card + misc-sales lines; card gross/fee verification.
   2. **Named-customer receipts** (`namedCustomerReceipts`) — donation · advance ticket · membership.
2. **Bills** (`bills`) — the rent bill (vendor = landlord, class, amount); no check line.
3. **Performer Payments** (`performerPayments` + `voidedPerformerPayments` + `performerReconciliation`) — one
   section: payee · amount · class · check# + per-booking allocation; voided distinct; reconciliation.
4. **Deposit** (`deposit`) → ESL Checking (cash + card).
5. **Fees** (`fees`) — informational; not netted into Deposit.

The **comp-admission** and **gift-card-redemption** counts are shown as reconciliation figures on the report
(e.g. near the gate receipt or in a small counts line), both always visible (0 shown, not hidden).

## Entities read (no writes beyond the existing audit)

- **`events`** — `rent_cents`, `venue_id`, `series_id`, `event_date` (feeds `resolveEventRentCents`).
- **`venues`** — `landlord_contact_id` → **`contacts`** `display_name` (the bill vendor).
- **`venue_rents`** — consulted inside `resolveEventRentCents` (dynamic rent).
- **`door_records`** — `comp_count`, `gift_card_redemption_count` (already loaded in assembly).
- **`series_qbo_map`** — `qbo_class` (class on the rent bill, unchanged source).

## Relationships / invariants

- Rent bill amount **equals** the organizer report's rent for the same event (both call `resolveEventRentCents`).
- Adding fields cannot alter existing figures — the new reads (rent, landlord, counts) feed only the new fields.
- No FK, index, or table change; nothing is written that was not written before (the report-generation audit row
  is unchanged).
