# Phase 0 Research: Treasurer Report QBO Restructure (+ counts)

No NEEDS CLARIFICATION remained in Technical Context. This records the design decisions and the code they are
grounded in.

## Decision 1: Rent bill amount comes from the existing rent resolver

- **Decision**: The rent bill amount = `resolveEventRentCents(db, event)` — the **same** resolver the organizer
  report already calls, passing the event row directly.
- **Rationale**: The `event` row loaded at the top of `assembleTreasurerReport` already carries `rentCents`,
  `venueId`, `seriesId`, `eventDate` — exactly the `EventRentInput` shape `resolveEventRentCents` accepts. It
  honors the feature-020 dynamic-rent rule (typed override freezes; else latest series-at-venue rent, else venue
  default, else 0). Reusing it guarantees the treasurer's rent equals the organizer's rent for the same event
  (SC-004) with zero new logic.
- **Alternatives considered**: A bespoke rent lookup in the treasurer domain — rejected (duplicates
  `rentService`, risks the two reports disagreeing). Adding a `rent_cents` to `TreasurerReport` computed a second
  way — rejected for the same reason.

## Decision 2: Rent bill vendor = the venue's landlord contact display name

- **Decision**: Vendor = the display name of the contact referenced by `venues.landlord_contact_id` for the
  event's venue. When the event has no venue, or the venue has no landlord set, vendor = the literal
  `"(no landlord set)"`.
- **Rationale**: The landlord picker (feature 018) already stores `landlord_contact_id`; the report resolves it to
  a name for display. A missing landlord must not blank the vendor (edge case) — an explicit placeholder keeps the
  bill visible and tells the treasurer to fill it in.
- **Alternatives considered**: Omitting the bill when no landlord — rejected (the treasurer still owes rent; the
  bill should appear with the amount even if the vendor is unknown).

## Decision 3: The rent bill carries a class and has NO check/payment line

- **Decision**: The rent bill is `{ vendor, class, amount }` where class = the series `qboClass` (the same class
  on every other transaction, FR-008). No check number / payment line appears in the Bills section.
- **Rationale**: FR-004 — rent is paid **outside** the FS check workflow, so the report records the bill to enter
  in QBO but never a payment against it. QBO bills carry a class, so the treasurer needs it here too.

## Decision 4: "Comp admissions" = the RAW comp count (not effective comps)

- **Decision**: `compCount` on the report = `door_records.comp_count` (raw), **not** the organizer report's
  *effective* comps (`comp_count + open_band_count`).
- **Rationale**: Open-band comps are comped **musicians** (a performer-side concept the organizer report folds
  into "paying dancers" math); the treasurer's reconciliation aid is about **free admissions**. The source
  requirement (P6-R9) explicitly leans this way ("Likely raw compCount … confirm"). Documented as an assumption
  in the spec; `/speckit-clarify` can flip it to effective comps if the treasurer prefers, a one-line change.
- **Alternatives considered**: Effective comps — rejected as the default (conflates musicians with free
  admissions); left as the single confirmable knob.

## Decision 5: Gift-card-redemption count = `door_records.gift_card_redemption_count`

- **Decision**: `giftCardRedemptionCount` = `door_records.gift_card_redemption_count` (gift cards **used** for
  admission).
- **Rationale**: Distinct from the gate receipt's `gift_card` **sales** line (gift cards **purchased**, a
  liability). Both already live on the door record / gate; surfacing the redemption count closes the
  headcount-vs-paid-gate gap (the R9 "why").

## Decision 6: QBO ordering is realized on the page; existing report fields keep their names

- **Decision**: The five-section order (Sales Receipts → Bills → Performer Payments → Deposit → Fees) is rendered
  by the treasurer **page**. The report **type** keeps `gateSalesSummary` and `namedCustomerReceipts` as the two
  sales-receipt kinds (gate rendered first, then named, under one "Sales Receipts" heading); it **adds** `bills`,
  `compCount`, `giftCardRedemptionCount`.
- **Rationale**: YAGNI + minimal test churn — renaming/nesting the existing fields would rewrite every integration
  assertion (`body.gateSalesSummary`, `body.namedCustomerReceipts`, `body.deposit`, `body.fees`) for no
  functional gain. The ordering guarantee (SC-001/SC-003) is a display concern, proven by the component test;
  the API test proves the additive data. Figure parity (FR-010) is trivially preserved because nothing existing
  changes.
- **Alternatives considered**: A nested `salesReceipts: { gate, named }` type — rejected (churns all consumers +
  tests; the constitution favors the smaller change).

## Decision 7: No schema, no migration, no new endpoint

- **Decision**: Reads only. The GET `/api/events/[id]/treasurer-report` route is unchanged (it already returns
  `assembleTreasurerReport`); `base` auth stays (money is open to all volunteers).
- **Rationale**: Every input already exists in the schema. Adding fields to the assembled JSON needs no route or
  contract change beyond the widened response body.

## Out of scope (recorded, not researched)

- **Defect D3** — capture/edit of a check number on a multi-booking payment. The report *display* already handles
  a correctly-stored multi-line check; the July-9 dash is a data-capture gap fixed in a separate feature.
- **Backlog B42** — organizer-expense reimbursement bills. The Bills section holds rent only for now.
