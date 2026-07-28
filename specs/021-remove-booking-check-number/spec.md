# Feature Specification: Remove `bookings.check_number` — single home for performer-payment check numbers

**Feature Branch**: `021-remove-booking-check-number`

**Created**: 2026-07-28

**Status**: Draft

**Input**: User description: "Drop `bookings.check_number` (Phase 4, corrects feature 019) — make the performer-payment record the sole store of a performer-payment check number; the booking record must not carry a check number; the event-deletion safeguard and any check-entry/display that referenced the booking's check number move to the payment record; no check-number history is lost."

## Overview

Feature 019 introduced a dedicated performer-payment record as the authoritative store of what was actually
disbursed to a performer, **including the check number** — and the treasurer report already reads check
numbers from there. Yet a **second, redundant check-number field survived on the booking record**, written by
the door/gate check-entry path and read only by the event-deletion safeguard. Two homes for the same fact can
diverge and is an acknowledged error in 019. This feature removes the booking-side check number so the
**payment record is the single source of truth**, re-homes the event-deletion safeguard onto the payment
records, and removes the now-orphaned booking-side entry/display — losing no history. It is the first,
low-risk step of the Phase 4 financial-secretary work and unblocks the larger payments feature.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - One home for a check number (Priority: P1)

The booking record represents an *expectation* (who is booked and the expected pay); the payment record
represents the *actual money paid* (payee, amount, and its check number). A check number must live only with
the actual payment, never on the booking. After this change, no booking carries a check number and nothing in
the system records one there.

**Why this priority**: This is the core correction. Removing the duplicate eliminates the possibility of two
divergent check numbers for the same payment and establishes the single source of truth the rest of Phase 4
depends on.

**Independent Test**: Inspect a booking through every surface and confirm it exposes no check-number value or
field; confirm a performer's check number is recorded and retrieved only through the payment record.

**Acceptance Scenarios**:

1. **Given** a performer has been paid by check, **When** their booking is viewed, **Then** no check number
   appears on the booking (it appears only on the payment record).
2. **Given** any workflow that previously wrote a check number against a booking, **When** it runs after this
   change, **Then** it records the check number on the payment record (or that redundant path is removed) and
   never on the booking.
3. **Given** a performer is re-pointed to a substitute on an existing booking, **When** the re-point occurs,
   **Then** there is no booking-side check number to carry over or clear.

### User Story 2 - The event-deletion safeguard still protects paid events (Priority: P1)

An event that has recorded performer payments (checks) must remain protected from deletion, exactly as before —
but the safeguard must now consult the payment records rather than the booking's check field.

**Why this priority**: Removing the booking field without re-homing the safeguard would silently drop a
financial-integrity protection. This must ship together with US1.

**Independent Test**: Attempt to delete an event that has a recorded performer check and confirm it is blocked
with the same protection as before the change; attempt to delete an event with no recorded checks and confirm
it is not blocked by this safeguard.

**Acceptance Scenarios**:

1. **Given** an event with at least one recorded performer-payment check, **When** deletion is attempted,
   **Then** it is refused and the reason cites the recorded payment.
2. **Given** an event with no recorded performer-payment checks, **When** deletion is attempted, **Then** this
   safeguard does not block it (other unrelated safeguards still apply).

### User Story 3 - No check-number history is lost (Priority: P1)

Every check number that was previously recorded remains available after the change — no financial history is
erased by removing the booking-side field.

**Why this priority**: This is a correction to shipped data. Losing any historical check number would corrupt
the treasurer's records; the transition must be provably non-destructive.

**Independent Test**: Enumerate all check numbers recorded before the change and confirm every one is still
retrievable (via the payment records) afterward.

**Acceptance Scenarios**:

1. **Given** check numbers recorded before this change, **When** the change is applied, **Then** each of those
   check numbers is still retrievable through the payment records.
2. **Given** the treasurer report, **When** it is viewed after the change, **Then** it shows the same check
   numbers it showed before.

### Edge Cases

- **A booking carries a check number with no matching payment record.** Before the booking field is removed,
  the transition must guarantee that value is represented in the payment records (created if missing), so no
  number is lost. If none exist, this is a no-op.
- **The door/gate surface that entered/displayed a booking check number.** That entry/display is removed here;
  the proper check-entry-on-the-payment-record is delivered by the separate Financial-Secretary payments
  feature (Area B). The system is pre-rollout, so a temporary absence of gate check-entry is acceptable.
- **Reports and exports.** No report or export may reference the booking check number after removal; the
  treasurer report already reads the payment records and must be unaffected.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST store a performer-payment check number in exactly one place — the payment
  record — and the booking record MUST NOT retain, carry, accept, or expose a check number through any
  interface.
- **FR-002**: The event-deletion safeguard MUST continue to prevent deletion of an event that has recorded
  performer-payment check(s), determined from the payment records, preserving the protection that previously
  keyed on the booking field.
- **FR-003**: The transition MUST be non-destructive — every check number recorded before the change MUST be
  represented in the payment records before the booking-side field is removed; none may be lost.
- **FR-004**: Any workflow that previously recorded a check number against a booking MUST instead target the
  payment record, or be removed if it is now redundant.
- **FR-005**: Any surface that previously displayed a booking's check number MUST source it from the payment
  record, or be removed.
- **FR-006**: The performer re-point flow MUST NOT reference a booking-side check number (the prior
  "clear the booking check number on re-point" step becomes unnecessary and is removed).
- **FR-007**: The treasurer report MUST continue to show performer check numbers unchanged (it already sources
  them from the payment records).
- **FR-008**: No previously green automated check may regress; behavior that did not depend on the booking
  check number MUST be unaffected.

### Key Entities *(include if feature involves data)*

- **Booking**: The expectation that a performer will appear at an event, with an expected pay amount. After
  this change it holds **no** check number.
- **Performer payment**: The record of money actually disbursed to a payee for an event — payee, amount, and
  **check number**. The single, authoritative home of a performer-payment check number.
- **Event-deletion safeguard**: The protection that refuses to delete an event that still has recorded money;
  its check-related condition now reads the payment records.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A check number is present in exactly one record type (the payment record) and in **zero** places
  on the booking record.
- **SC-002**: 100% of check numbers recorded before the change remain retrievable afterward (no history lost).
- **SC-003**: An event that has a recorded performer-payment check is blocked from deletion in 100% of
  attempts — the same *protection* as before the change. (The user-facing *reason* text changes from
  "a paid booking (check number)" to "a recorded performer payment"; parity is on the block, not the wording.)
- **SC-004**: The treasurer, financial-secretary, and booker surfaces continue to operate with no loss of any
  check-number information they previously displayed, and the treasurer report shows identical check numbers
  before and after.

## Assumptions

- Feature 019's data backfill already mirrored booking-side check numbers into the payment records, so
  removing the booking field is non-destructive; the transition still guards against any residual value to
  guarantee FR-003.
- Recording a check on the door/gate is redirected to the payment record by the separate **Financial-Secretary
  payments feature (Area B)**; this feature removes the booking-side entry/display and does not build the
  replacement. Because the system is **pre-rollout**, a temporary gap in gate check-entry is acceptable.
- The payment record remains the store the treasurer report reads (unchanged by this feature).
- Solo-maintainer workflow (constitution v1.3.0): one atomic commit to `main`, full local gate suite as the
  reviewer. Data-schema change ships as one additive migration.
- Scope is limited to the check-number correction; no other 019 behavior (payment amounts, allocation, voids)
  is changed here.
