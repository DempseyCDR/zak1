# Contract: Treasurer Report (restructured response)

This feature **widens** one existing response and reorders its on-page presentation. No new endpoint, no request
change.

## Endpoint (unchanged shape of request)

- `GET /api/events/[id]/treasurer-report` — auth `base` (money is open to all volunteers). Still returns the
  assembled `TreasurerReport` for the event; the **response body grows** by three fields.

## Response — added fields

```jsonc
{
  // ...all existing fields UNCHANGED (gateSalesSummary, namedCustomerReceipts, performerPayments,
  //    voidedPerformerPayments, performerReconciliation, deposit, fees, event) ...

  "bills": [
    { "vendor": "Faith Lutheran Church", "class": "TNC", "amount": 250 }
    // exactly the rent bill today; vendor === "(no landlord set)" when the venue has no landlord;
    // amount === resolveEventRentCents(event) in dollars; NO check/payment line
  ],
  "compCount": 3,                 // raw door_records.comp_count
  "giftCardRedemptionCount": 2    // door_records.gift_card_redemption_count
}
```

## Guarantees (test contract)

- **Rent bill amount** === `resolveEventRentCents(db, event)` (dollars) — equals the organizer report's rent for
  the same event (SC-004).
- **Rent bill vendor** === the venue landlord's `display_name`; === `"(no landlord set)"` when the event has no
  venue or the venue has no `landlord_contact_id`.
- **Rent bill has no payment/check line** (FR-004).
- **`compCount`** === `door_records.comp_count` (raw); **`giftCardRedemptionCount`** ===
  `door_records.gift_card_redemption_count`; both present even when 0.
- **Figure parity (FR-010 / SC-002)**: every pre-existing money total (gate line totals, named receipts, performer
  amounts, reconciliation expected/actual/delta, deposit, fees) is **byte-for-byte unchanged** versus the
  pre-restructure report for the same seeded event.
- **Class present** on the rent bill (FR-008); no GL account code anywhere (already removed in feature 039).

## Presentation contract (treasurer page — proven by the component test)

- Sections render in order: **Sales Receipts → Bills → Performer Payments → Deposit → Fees**.
- Within Sales Receipts, the **gate / attendance receipt precedes** the named-customer receipts (SC-003).
- The rent bill row shows vendor + amount and **no** check-number control.
- The comp-admission count and gift-card-redemption count are both visible (including 0).
- The existing **Print** action still works over the restructured layout (FR-011).

## Out of scope (contract explicitly does NOT change)

- Capturing/editing a check number on a multi-booking payment (**defect D3**) — the display already renders a
  correctly-stored multi-line check; a NULL check number still shows a dash.
- Any non-rent bill (organizer reimbursement, **B42**).
