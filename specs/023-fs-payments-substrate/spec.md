# Feature Specification: Financial-Secretary payments substrate

**Feature Branch**: `023-fs-payments-substrate`

**Created**: 2026-07-28

**Status**: Draft

**Input**: User description: "FS payments substrate" — how the Financial Secretary records the actual checks
written to performers (number, amount, allocation across the bills a check covers, discrepancy notes, and
voids/reissues), and how the treasurer and organizers read that money from opposite ends (check-written date
vs. performance date). Consolidates Area B of the Phase 4 requirements. Depends on feature 021 (which made the
performer-payment record the sole check store) and reuses the 019 payment tables.

## Overview

Today a performer's *expected* pay lives on the booking, and an *actual* payment record exists (feature 019)
that the treasurer report already reads — but there is no first-class way for the **Financial Secretary
(Mary)** to record the real checks the way she actually writes them: one check can pay several bills, an
amount can differ from what was expected (with an explanation), a check can be **voided and reissued**, and a
delayed check written at one event can settle a booking from an **earlier** event. This feature makes the
payment record carry that reality — **per-line allocation** of a check across the bookings it settles, and
**voids** — and re-keys the two consumer reports so each reads the money from the correct end: **Mike the
treasurer** enters QuickBooks by **check-written date** (with the check's covered lines), while **organizers**
see event costs on the **date the performer performed**. Non-performer expense reimbursement stays out of
scope (that is the treasurer's, backlog B42).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The FS records a check against the bills it pays (Priority: P1)

At the break, Mary reviews the performers owed for the event, writes the checks, and records each one: the
**check number**, the **actual amount**, and the **booking(s) it settles**, each with the portion of the check
applied to it. When the amount differs from what was expected, she adds a **note** explaining it. The check is
dated to the event she is working.

**Why this priority**: This is the core substrate. Without per-line allocation and the actual amount, neither
the treasurer's bill allocation nor the organizer's per-event cost can be correct.

**Independent Test**: Record a check for a performer's booking with an actual amount and a note; confirm the
payment stores the check number, the amount, the note, its event/date, and a line linking it to the booking
with the applied amount.

**Acceptance Scenarios**:

1. **Given** a performer with an expected-pay booking, **When** the FS records a check (number, amount) against
   that booking, **Then** a payment is stored with the check number, amount, and its event (the check-written
   date), linked to the booking with the amount applied to that line.
2. **Given** an actual amount different from the booking's expected pay, **When** the FS records it with a
   note, **Then** the note is stored on the payment and the difference is visible as a reconciliation delta,
   not an error.

### User Story 2 - One check settles several bills, including across events (Priority: P1)

A single check can cover more than one bill. Most often it is one check per performer; sometimes it is **one
check to the band's lead** covering the whole band; and when the FS runs out of checks, a check written at a
later event settles a performer's **unpaid booking from an earlier event** together with a current one. The
**payee** is whoever the check is written to (e.g. the lead), which may differ from the performers whose
bookings it settles. Each covered bill carries its **own applied amount**, and the amounts sum to the check.

**Why this priority**: Aggregation and cross-event settlement are real FS practice; the per-line amounts are
what let the treasurer and organizer reports stay correct when a check spans bills or events.

**Independent Test**: Record one check whose lines settle two bookings (from two different events) with
per-line amounts; confirm the payee, the total, and that each line carries its own amount and links to its
booking.

**Acceptance Scenarios**:

1. **Given** a band with several members' bookings, **When** the FS records one check to the lead covering all
   of them, **Then** the payment's payee is the lead and its lines settle each member's booking with per-line
   amounts summing to the check.
2. **Given** a performer with an **unpaid** booking from a past event, **When** the FS records a check at a
   later event that settles both that past booking and a current one, **Then** the payment is dated to the
   later (writing) event while each line still points to its own booking.

### User Story 3 - Void and reissue a check (Priority: P1)

When Mary writes a wrong amount, or a performer no-shows after she has written their check, she **voids** the
check and writes a **new** one. The voided check does not disappear — it remains recorded (the treasurer must
enter the void into QuickBooks) and is linked to its replacement.

**Why this priority**: Voids are a routine accounting event; silently deleting a written check would corrupt
the treasurer's records and hide the reissue.

**Independent Test**: Record a check, void it (with a reason), and record its replacement; confirm the voided
payment persists as voided, carries the reason, and is linked to the replacement, and that a voided check no
longer counts toward what a booking has been paid.

**Acceptance Scenarios**:

1. **Given** a recorded check, **When** the FS voids it and records a replacement, **Then** the original
   remains stored as **voided** (with a reason) and references its replacement, and the replacement is a
   normal live payment.
2. **Given** a booking whose only payment is voided, **When** its settlement is evaluated, **Then** the
   booking counts as **unpaid** (the void does not settle it).

### User Story 4 - Treasurer reads checks by written date, with each check's lines (Priority: P1)

Mike opens the per-event treasurer report to enter QuickBooks. It lists the checks **written at that event**
(their check-written date), each **expandable to the bills it covers** (each line's performer, booking, and
amount), so he can allocate the check against those bills. **Voided** checks are shown distinctly so he records
the void too.

**Why this priority**: QuickBooks entry is a bill-allocation by check and date; the treasurer needs the check,
its date, and its covered lines in one place, voids included.

**Independent Test**: With checks (including one voided and one cross-event) recorded at an event, open that
event's treasurer view; confirm it lists the checks written there with their per-line breakdown and marks the
voided one.

**Acceptance Scenarios**:

1. **Given** checks recorded at an event, **When** the treasurer views that event, **Then** each check appears
   with its number, written date (the event's date), total, and its covered lines (performer + amount).
2. **Given** a voided check at that event, **When** the treasurer views it, **Then** it is shown distinctly as
   voided (so the void is entered into QuickBooks), separate from the live checks.

### User Story 5 - Organizer sees costs on the date performed (Priority: P2)

An organizer evaluating an event's success sees performer costs attributed to **when the performer performed** —
each settled booking's own event date — not to when the check happened to be written. A delayed check's cost
lands on the past event it settled.

**Why this priority**: Event-success evaluation must charge each event with the cost actually incurred there;
otherwise a delayed payment distorts both events' results.

**Independent Test**: With a delayed check (written at a later event) that settles a past event's booking,
view the organizer costs for the **past** event; confirm the settled amount is charged there, not to the
writing event.

**Acceptance Scenarios**:

1. **Given** a check written at event B that settles a booking performed at event A, **When** organizer costs
   are computed, **Then** the settled amount is attributed to **event A** (the performance date).
2. **Given** an event with a mix of paid and still-unpaid bookings, **When** organizer costs are computed,
   **Then** the organizer's performer cost is the **single sum** of each paid booking's actual settled amount
   plus each unpaid booking's expected pay — with no paid/outstanding breakdown shown on the organizer view.

### Edge Cases

- **Diverging check numbers (historical)**: a booking that already had a check recorded before this feature is
  handled by 021's migration; nothing here re-opens it.
- **A check covering a bill plus an extra amount**: the most common discrepancy is a check that settles a
  booking **and** an additional obligation, explained in the note; the additional obligation, if it is a
  **non-performer reimbursement**, is out of scope (B42) — in-scope lines always settle a real booking.
- **Booked-but-unpaid**: a booking with no live payment line is a reconciliation gap (surfaced, not blocked),
  consistent with feature 019.
- **Deleting an event** with recorded payments remains blocked (feature 019 guardrail), **widened for
  cross-event**: the block also applies when any of the event's bookings is settled by a **live** payment
  recorded at *another* event — so a cross-event check's settled booking is never silently orphaned (FR-013).
- **A void with no replacement** (a performer simply drops, no reissue): the voided check still persists for
  the treasurer.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The FS MUST be able to record a performer-payment check with a **check number**, an **actual
  amount**, its **event** (the check-written date), an optional **note**, and a **payee** (who the check is
  written to).
- **FR-002**: A payment MUST allocate across the **booking(s) it settles**, each line carrying the **amount
  applied to that booking**; the line amounts of a check reconcile against its total.
- **FR-003**: One check MAY settle **multiple bookings**, and those bookings MAY belong to **different events**
  (a delayed check); the payment's date is the event it was written at, while each line points to its own
  booking's event.
- **FR-004**: The **payee** of a check MAY differ from the performers whose bookings it settles (e.g. one check
  to a band's lead).
- **FR-005**: The FS MUST be able to **void** a payment with a **reason**; a voided payment MUST persist
  (remain visible to the treasurer) and MUST NOT count toward settling any booking.
- **FR-006**: A **reissued** check MUST be linkable to the voided check it replaces.
- **FR-007**: When an actual amount differs from a booking's expected pay, the difference MUST be recordable
  with a **note** and surfaced as a reconciliation delta, not rejected.
- **FR-008**: The **per-event treasurer report** MUST present the checks **written at that event** (by
  check-written date), each expandable to its covered lines (performer, booking, amount), with **voided**
  checks shown distinctly from live ones.
- **FR-009**: **Organizer** performer-cost MUST be a **single figure by performance (incurred) date** — for
  each of the event's bookings, its **actual settled amount** if paid (from the live per-line amounts, dated to
  the booking's own event, not the check's written-at date), else its **expected pay** (still-outstanding),
  summed. The organizer view does **not** break out paid vs. outstanding — that split is surfaced only to the
  **treasurer / FS** (the reconciliation delta) and sometimes the **booker**.
- **FR-010**: A booking's **settled amount** MUST be derived from the live (non-voided) payment lines applied
  to it; a booking with none is unpaid.
- **FR-011**: The check-written date MUST derive from the payment's event (checks are always written on the
  event date) — no separate check-date input.
- **FR-012**: All payment writes and voids MUST be recorded through the existing audit path.
- **FR-013**: Deleting an event MUST be blocked when any of the event's bookings is settled by a **live**
  payment — **including a check recorded at a different event** (cross-event) — extending the feature-019
  guardrail so cross-event settlement can never silently orphan a paid line or break a check's line-sum total.

### Key Entities *(include if feature involves data)*

- **Performer payment (a check)**: what the FS actually wrote — payee (check recipient), total amount, check
  number, the event it was written at (its date), an optional note, and a **void** state (voided + reason +
  the replacement it points to). The sole store of a check number (per feature 021).
- **Payment line (allocation)**: the link between a check and one **booking** it settles, carrying the
  **amount applied** to that booking. One check has one or more lines; a booking is settled by at most one live
  line.
- **Booking**: the expectation (who plays, expected pay, at which event) — unchanged here; it is what a payment
  line settles and what dates the organizer's incurred cost.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The FS can record a check and its allocation across the bills it settles in one pass; 100% of
  recorded checks carry a number, amount, date, payee, and at least one settled-booking line.
- **SC-002**: For any check spanning multiple bills, the sum of its per-line amounts equals the check total in
  100% of cases (no unallocated remainder among in-scope lines).
- **SC-003**: A voided check remains visible to the treasurer in 100% of cases and never contributes to a
  booking's settled amount.
- **SC-004**: The per-event treasurer view lists every check written at that event with its covered lines and
  marks voided checks — verifiable for an event that has a normal check, a cross-event check, and a voided
  check.
- **SC-005**: For a delayed check, 100% of the settled cost is attributed to the performance event in the
  organizer figures, and none to the writing event.
- **SC-006**: Existing treasurer/organizer/public behaviors show no regression (the full existing suite stays
  green).

## Assumptions

- **Reuses the 019 payment tables** (the performer-payment record and its booking links) and feature 021's
  single-check-store correction; this feature adds **per-line allocation amounts** and **void** state, and
  **re-keys** the treasurer and organizer reports. It does not introduce a new payment concept.
- **Settled decisions** (from the Phase 4 requirements): a check's date derives from its event; the payee is
  the check recipient; aggregation is many-bookings-per-check including cross-event; every in-scope line
  settles a real booking (**no booking-less lines** — non-performer reimbursement is **B42**, out of scope).
- **Out of scope — the booking-side of substitution and the booker amendments**: adding a substitute's
  booking, keeping a no-show on the record, the "re-point blocked once a check exists" guardrail, and the
  lead-status cascade / band re-point are a **separate** feature that builds on this substrate. This feature
  provides only the payment operations (record, allocate, void, reissue) and the report re-keying.
- **Per-performer *actual* earnings under aggregation** (when one check pays the lead for the band) is a
  reporting-display question deferred to the report-validation pass; this feature stores the truth (per-line
  amounts + payee) needed to resolve it later.
- The FS records payments on the event's money surface; the existing payments detail surface remains available.
  Money is integer cents. Solo-maintainer workflow (constitution v1.3.0): one atomic commit; full local gate
  suite as the reviewer.
