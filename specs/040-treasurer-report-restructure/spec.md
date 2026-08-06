# Feature Specification: Restructure the Treasurer Report to Mirror QBO Data Entry (+ comp / gift-card counts)

**Feature Branch**: `040-treasurer-report-restructure`

**Created**: 2026-08-05

**Status**: Draft

**Input**: User description: "P6-R8 and P6-R9"

## User Scenarios & Testing *(mandatory)*

The treasurer (Mike) books each dance into QuickBooks Online (QBO) by transaction type — first the **Sales
Receipts** (money in, to a customer), then any **Bills** (money owed to a vendor), then the **Performer
Payments** (checks written), then the **Deposit**, then informational **Fees**. Today the treasurer report is a
flat set of sections annotated with class; it no longer carries GL account codes (removed in feature 039). This
feature reshapes the report so it reads top-to-bottom in the exact order the treasurer enters the event into QBO,
and surfaces two reconciliation counts he currently has to look up elsewhere.

### User Story 1 - Report reads in QBO data-entry order (Priority: P1)

The treasurer opens the report for one event and sees it organized by QBO transaction type in data-entry order:
**Sales Receipts** (the gate/attendance receipt first, then named-customer receipts) → **Bills** (venue rent owed
to the landlord) → **Performer Payments** (the checks he wrote) → **Deposit** (to ESL Checking) → **Fees**
(informational). He works straight down the page, entering each section into QuickBooks in turn, with no need to
reorder or hunt.

**Why this priority**: This is the core of P6-R8 and the reason the treasurer asked for the rework — the report
should map 1:1 onto how he actually books the event. It delivers standalone value even without the R9 counts.

**Independent Test**: Generate the report for a seeded event with gate sales, named receipts, a venue with a
landlord and a resolved rent, and performer checks; confirm the sections appear in the order Sales Receipts →
Bills → Performer Payments → Deposit → Fees, the gate receipt precedes the named receipts, the rent bill names the
landlord with the event's rent amount, and every money total equals the pre-restructure report's total for the
same event.

**Acceptance Scenarios**:

1. **Given** an event with admission plus merchandise, gift-card, and misc-sales gate lines, **When** the
   treasurer views the report, **Then** the first Sales Receipt is the gate/attendance receipt to the series' gate
   customer (e.g. Contra Gate / English Gate), listing those lines with the card gross/fee verification.
2. **Given** the same event also has donation, advance-ticket (future_event), and membership sales tied to named
   contacts, **When** the treasurer views the report, **Then** those appear as named-customer receipts **after**
   the gate receipt, each to its named customer.
3. **Given** the event's venue has a landlord contact and a resolved rent, **When** the treasurer views the
   report, **Then** a Bills section shows the rent as a bill owed to that landlord, with the amount equal to the
   event's resolved rent, and **no** check/payment line (rent is paid outside the FS check workflow).
4. **Given** the treasurer wrote one check to Clara that settled bookings for both Clara and Micah, **When** he
   views the report, **Then** the Performer Payments section shows that single check (payee, amount, class, check
   number) with a per-booking breakdown naming both performers, voided checks shown distinctly, and the
   expected-vs-actual reconciliation.
5. **Given** a community-dance event (its own series), **When** the treasurer views the report, **Then** its gate
   receipt is addressed to that series' gate customer (Contra Gate) with no special-case handling.
6. **Given** any event, **When** the treasurer compares each money total on the restructured report to the same
   figure on the pre-restructure report, **Then** every total matches (the reshape reorders/relabels/groups and
   adds the rent bill; it changes no computed amount).

---

### User Story 2 - Comp-admission and gift-card-redemption counts (Priority: P2)

The treasurer sees, for the dance, how many admissions were **comped** (free) and how many **gift cards were
redeemed**, so he can reconcile the headcount against the paid gate.

**Why this priority**: P6-R9. A small, additive display that closes a reconciliation gap (why headcount exceeds
paid admissions). Independent of the restructure — valuable on its own — but lower priority than the reshape.

**Independent Test**: Generate the report for a seeded event whose door record has a non-zero comp count and a
non-zero gift-card-redemption count; confirm both counts appear on the report, and an event with zero of each
shows 0 (not hidden). No money figure changes.

**Acceptance Scenarios**:

1. **Given** an event whose door record records 3 comp admissions, **When** the treasurer views the report,
   **Then** the report shows a comp-admission count of 3.
2. **Given** an event whose door record records 2 gift-card redemptions, **When** the treasurer views the report,
   **Then** the report shows a gift-card-redemption count of 2.
3. **Given** an event with no comps and no gift-card redemptions, **When** the treasurer views the report,
   **Then** both counts show 0.

---

### Edge Cases

- **Venue has no landlord set**: the rent bill still shows the rent amount, with the vendor rendered as an
  explicit "(no landlord set)" placeholder rather than blank.
- **Event has no venue, or rent resolves to $0**: the Bills section shows a $0 rent line (consistent placement)
  rather than being silently dropped, so the treasurer can see rent was considered.
- **Multi-booking check stored with no check number (the real July-9 case)**: the report renders a dash for the
  check number. Fixing capture/edit so a real check number can be stored is **out of scope** (defect D3, a
  separate feature); this feature only guarantees correct display of a correctly-stored multi-line check.
- **No gate sales / empty named receipts**: the corresponding sub-section shows an empty/None state, not an error.
- **Comp or gift-card-redemption count of 0**: shown as 0, never hidden.

## Requirements *(mandatory)*

### Functional Requirements

#### Report structure (P6-R8)

- **FR-001**: The treasurer report MUST present a single event's finances in QBO data-entry order:
  **Sales Receipts → Bills → Performer Payments → Deposit → Fees**.
- **FR-002**: The Sales Receipts section MUST list the **gate / attendance receipt first**, addressed to the
  series' gate customer, covering admission (cash + card) plus the merchandise, gift-card, and misc-sales lines,
  with the card gross/fee verification.
- **FR-003**: After the gate receipt, the Sales Receipts section MUST list the **named-customer receipts** —
  donation, advance ticket (future_event), and membership — each addressed to its named customer.
- **FR-004**: The report MUST include a **Bills** section that shows the **venue rent as a bill owed to the
  venue's landlord** (the vendor), with the amount **derived** from the event's resolved rent. This section MUST
  NOT contain a check or payment line (rent is paid outside the Financial-Secretary check workflow).
- **FR-005**: The report MUST present **Performer Payments as a single section** — payee, amount, class, check
  number, and the per-booking allocation — with voided checks shown distinctly and the expected-vs-actual
  reconciliation. It MUST NOT be split into separate Bill and Bill-Payment sections.
- **FR-006**: The report MUST show the **Deposit** (to ESL Checking) covering cash + card.
- **FR-007**: The report MUST show **Fees** (card / PayPal processing) as **informational only**, NOT netted into
  the Deposit.
- **FR-008**: Every receipt/bill/payment MUST carry its **class** (from the series QBO mapping). **No GL account
  codes** appear anywhere on the report (removed in feature 039).
- **FR-009**: A **community-dance** event MUST yield its own gate sales receipt addressed to its series' gate
  customer (Contra Gate), achieved **without special-case code** — because the report is assembled per event and
  community dances are their own series.
- **FR-010**: The restructure MUST **not change any computed money figure** versus the pre-restructure report for
  the same event (gate amounts, named receipts, performer payments, reconciliation, deposit, fees). It reorders,
  relabels, and regroups, and adds the derived rent bill; it alters no amount.
- **FR-011**: The report's print/handoff affordance MUST be retained (the existing Print action still works over
  the restructured layout).

#### Reconciliation counts (P6-R9)

- **FR-012**: The report MUST display the event's **comp-admission count** (free admissions).
- **FR-013**: The report MUST display the event's **gift-card-redemption count**.
- **FR-014**: The comp and gift-card-redemption counts are **display-only reconciliation aids** and MUST NOT
  alter any money figure on the report.

### Key Entities *(include if feature involves data)*

- **Treasurer report (per event)**: the assembled view. Gains a **Bills** grouping (rent → landlord) and two
  **counts** (comp admissions, gift-card redemptions); loses no data. Sections are ordered by QBO transaction
  type.
- **Gate / attendance sales receipt**: the existing gate summary, re-presented as the first Sales Receipt to the
  series' gate customer.
- **Named-customer receipt**: existing donation / advance-ticket / membership sales to a named contact.
- **Venue rent bill**: new on this report — amount = the event's resolved rent (the dynamic-rent value already
  used by the organizer report); vendor = the venue's landlord contact. Currently rent appears only on the
  organizer report.
- **Performer payment**: existing — the checks written, with per-booking allocation, voids, and reconciliation;
  presented as one section.
- **Comp-admission count / gift-card-redemption count**: existing door-record counts, surfaced on the treasurer
  report for the first time.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The report's sections always appear in the order Sales Receipts → Bills → Performer Payments →
  Deposit → Fees, and the treasurer can enter the event into QuickBooks working straight down the page with no
  reordering.
- **SC-002**: For every event, each money total on the restructured report equals the corresponding total on the
  pre-restructure report (100% figure parity — nothing computed changes).
- **SC-003**: The gate / attendance sales receipt appears **before** the named-customer receipts in 100% of
  events that have gate sales.
- **SC-004**: For every event with a venue, the Bills section shows the rent as a bill to the landlord with an
  amount equal to that event's rent on the organizer report.
- **SC-005**: The report shows a comp-admission count and a gift-card-redemption count for every event, including
  events where either count is 0.

## Assumptions

- **"Comp admissions" = the raw comp count** (`door_records.comp_count`), **not** effective comps
  (`comp_count + open_band_count`). Open-band comps are comped *musicians*, a distinct concept the organizer
  report handles separately; the treasurer wants the free-admission count. (Flagged "confirm" in the requirements
  — confirmable at `/speckit-clarify`.)
- **Gift-card-redemption count = `door_records.gift_card_redemption_count`** (gift cards *used* for admission),
  which is distinct from the gate receipt's gift-card *sales* line (gift cards *purchased*).
- **Rent amount** uses the same resolved event rent as the organizer report (the feature-020 dynamic-rent value);
  the **landlord** is the venue's landlord contact (feature 018). No manual entry.
- **The community-dance series' gate customer is already "Contra Gate"** in the QBO mapping, so its gate receipt
  names Contra Gate with no code change (FR-009 falls out of per-event assembly).
- **Print/handoff format** is retained via the existing Print action; only the on-page section structure changes.
- **The Bills section lists rent only** for now; organizer-expense reimbursement bills (backlog B42) remain
  deferred and out of scope.
- **Defect D3 is out of scope** — the inability to capture/edit a check number on a multi-booking payment is a
  separate defect; this feature only guarantees correct *display* of a correctly-stored multi-line check.
- **Prerequisites already shipped**: feature 038 removed non-dance income (P6-R6) and feature 039 removed the GL
  account-code annotation (P6-R7); this feature builds on both. No schema change is expected — it is a report
  reshape (assembly logic + page + tests) plus surfacing existing rent and door-record counts.
