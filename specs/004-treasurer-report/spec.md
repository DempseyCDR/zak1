# Feature Specification: Treasurer Report & QBO Hand-off

**Feature Branch**: `004-treasurer-report`

**Created**: 2026-06-18

**Status**: Draft

**Input**: Derived from CDR_Project_Context_v1.2.md — Gate Sales Model, Fee Structures, QBO Integration, QBO Account Reference, Dance Net inputs.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Produce a per-event Treasurer Report (Priority: P1)

The treasurer opens a formatted, per-event report that organizes the night's money into the sections needed to enter it into the accounting system by hand: gate sales summary, named-customer receipts, performer payments, deposit, and informational fees.

**Why this priority**: Manual accounting entry is a primary process this platform replaces; without a correct, copy/paste-ready report the treasurer cannot close out an event.

**Independent Test**: For a completed event, generate the report and confirm all five sections are present, populated from the door record, and formatted for screen (laptop) with print support.

**Acceptance Scenarios**:

1. **Given** a completed event, **When** the treasurer opens the report, **Then** it shows Gate Sales Summary, Named-Customer Receipts, Performer Payments, Deposit, and Fees (informational).
2. **Given** the gate sales summary, **When** displayed, **Then** it includes a payment-processor POS verification line for reconciliation.
3. **Given** performer payments, **When** displayed, **Then** each shows check number, payee, amount, accounting account, and class.
4. **Given** the deposit section, **When** displayed, **Then** it shows the cash deposit amount destined for the checking account.

---

### User Story 2 - Map categories to accounting accounts and receipts (Priority: P1)

The system books each money category to the correct accounting account and class and structures sales receipts correctly: one anonymous gate receipt per event, with memberships and advance tickets as separate named-customer receipts.

**Why this priority**: Correct account/class mapping is what makes the manual entry trustworthy and the books correct; this is the core accounting logic.

**Independent Test**: Configure the category→account/class mapping, run an event with mixed categories, and confirm the report assigns each line to the expected account and class and splits named-customer items onto separate receipts.

**Acceptance Scenarios**:

1. **Given** a TNC event, **When** the report is generated, **Then** the gate receipt customer is "Contra Gate" (or "English Gate" for ECD).
2. **Given** memberships or advance tickets collected at the door, **When** the report is generated, **Then** they appear as separate named-customer receipts, not on the gate receipt.
3. **Given** a Community Dance and TNC on the same evening, **When** reports are generated, **Then** there are two gate receipts, both to "Contra Gate".
4. **Given** a gift-card sale, **When** booked, **Then** it is recorded against the gift-card liability account.

---

### User Story 3 - Calculate and reconcile fees (Priority: P2)

The system calculates door and online payment fees per the fee formulas, reports revenue at gross, and presents fees informationally so the treasurer can reconcile against the payment processor.

**Why this priority**: Fees must be excluded from the organizer's net view but reconciled in the books; getting this wrong misstates both.

**Independent Test**: Enter transaction counts and gross amounts and confirm computed door and online fees match the formulas, are reported at gross, and appear only in the informational fees section / misc expenses.

**Acceptance Scenarios**:

1. **Given** a door POS total, **When** the fee is computed, **Then** it equals $0.09 × transactions + 2.29% × gross.
2. **Given** an online order, **When** the fee is computed, **Then** it equals $0.49 × transactions + 1.99% × amount.
3. **Given** any event, **When** revenue is reported, **Then** it is reported at gross with fees shown separately for reconciliation.

### Edge Cases

- Non-Dance Income (grants, bank interest) appears as its own section booked to account 4910; it never flows into gate totals or Dance Net.
- Gift cards booked to liability are moved to revenue by a manual journal entry on redemption.
- The accounting system is the system of record for fees; the app's figures support verification only.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST generate a per-event Treasurer Report with five sections: Gate Sales Summary, Named-Customer Receipts, Performer Payments, Deposit, and Fees (informational).
- **FR-002**: System MUST format the report screen-first for laptop dimensions and support printing.
- **FR-003**: System MUST include a payment-processor POS verification line in the gate sales summary.
- **FR-004**: System MUST produce one anonymous gate sales receipt per event with customer "Contra Gate" (TNC, Community Dance, Double Dance) or "English Gate" (ECD).
- **FR-005**: System MUST place memberships and advance tickets collected at the door on separate named-customer receipts, not the gate receipt.
- **FR-006**: System MUST assign an accounting account and class to each line item based on category and event type, using a per-club configurable mapping.
- **FR-007**: System MUST book gift-card sales to the gift-card liability account.
- **FR-008**: System MUST compute the door fee as $0.09 × transactions + 2.29% × gross and the online fee as $0.49 × transactions + 1.99% × amount. These are payment-processor (card/Venmo/PayPal) fees only — cash takes no fee. The formulas are fixed constants in Phase 1.
- **FR-009**: System MUST report all revenue at gross and present fees only informationally (rolled into misc expenses for the organizer view).
- **FR-010**: System MUST include Non-Dance Income (e.g., grants, bank interest; account 4910) as a **separate section** of the Treasurer Report, distinct from dance income — it MUST NOT flow into the gate receipt, gate totals, or Dance Net. (The Organizer Report, feature 005, still excludes Non-Dance Income entirely.)
- **FR-011**: System MUST present performer payments with check number, payee, amount, accounting account, and class.
- **FR-012**: System MUST compute the deposit amount destined for the checking account.
- **FR-013**: System MUST NOT import to or call the accounting system's API in Phase 1; output is for manual copy/paste.
- **FR-014**: System MUST log auditable generation of treasurer reports and any edits to the category→account/class mapping.

### Key Entities *(include if feature involves data)*

- **Treasurer Report**: A per-event, formatted view assembled from the door record, bookings, and rate parameters.
- **Account/Class Mapping**: Per-club configuration mapping app categories and event types to accounting accounts and classes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A treasurer can transcribe a completed event into the accounting system in under 10 minutes using only the report.
- **SC-002**: Computed door and online fees match the formulas in 100% of test cases.
- **SC-003**: Every money category lands in its correct account and class per the configured mapping in 100% of test events.
- **SC-004**: Named-customer items never appear on the anonymous gate receipt.
- **SC-005**: The app's POS verification line matches the payment processor's reported total for reconciled events.

## Assumptions

- No CSV import and no accounting-system API in Phase 1; manual copy/paste is the integration mechanism.
- The accounting system remains the system of record for fees.
- Account numbers/names are real-world domain constraints (existing chart of accounts), not implementation choices; the mapping is configurable per club.
