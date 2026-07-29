# Feature Specification: Booker amendments — lead cascade, band re-point, and the written-check discriminator

**Feature Branch**: `024-booker-amendments`

**Created**: 2026-07-29

**Status**: Draft

**Input**: User description: "booker amendments" — the booking-side amendments to feature 020, built on the
023 payment substrate: a band **lead's status cascades** to the band, a booker can **re-point a whole band**
to a different one, and removing/substituting a performer is governed by the **written-check discriminator**
(a paid booking is preserved as a no-show and the substitute is added as a new booking; an unpaid booking is
re-pointed/cleared cleanly). Consolidates Phase 4 Area A plus the booking-side of substitution that 023
deferred.

## Overview

Sean the Booker manages bands as units, but today each band member's booking moves independently, there is no
way to swap a whole band for another on an event, and re-pointing a slot silently overwrites it even after the
Financial Secretary has written a check. This feature makes the **lead drive the band** (a status change on
the lead moves the members that are still in lockstep), lets the booker **re-point an entire band** the way he
re-points one performer, and makes a **written check the discriminator** for what may be overwritten: before
any money is committed a slot is freely re-pointed or cleared; once a live check settles it, the booking is
**kept on the record** (as a no-show if the performer dropped) and the substitute is booked **fresh**, so the
person who actually played is always on the record. It depends on feature 023 (per-line payments + voids) for
"is this booking settled by a live payment?" and reuses the 023 void/reissue for the money side.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A band lead's status moves the band (Priority: P1)

Sean changes the booking **status of a band's lead** on an event (e.g. requested → confirmed). Every band
member on that event whose booking is **still in lockstep** with the lead moves to the same status in one
action. A member who has been deliberately moved off the group (e.g. already declined, with a sub arranged) is
**left untouched**.

**Why this priority**: A booked band is one decision; making the booker touch each member is error-prone and
was the first amendment requested.

**Independent Test**: Book a band, advance the lead's status, and confirm the lockstep members follow while a
member set to a different status beforehand does not change.

**Acceptance Scenarios**:

1. **Given** a band booked on an event with all members at the same status, **When** the booker advances the
   **lead's** status, **Then** every member's booking moves to the lead's new status (status only — pay,
   donated, and notes are unchanged).
2. **Given** a band where one member was individually **declined**, **When** the booker advances the lead's
   status, **Then** the declined member is **not** changed; the others follow.
3. **Given** a **non-lead** member, **When** the booker changes that member's status, **Then** no other
   member changes (only the lead cascades).

### User Story 2 - Re-point a whole band (Priority: P1)

Sean can swap the band booked on an event for a different band — the way he re-points a single performer's
slot. The event's band bookings are replaced by the new band's current roster, booked **fresh** (proposed
status, standard rates, the lead as the lead performer). The system does **not** try to reconcile members the
two bands share — the new band is simply booked from scratch (its pay may differ).

**Why this priority**: When a member drops and the remaining musicians are effectively a different band,
re-pointing the band is far faster and less error-prone than editing each slot.

**Independent Test**: Book band A on an event, re-point it to band B, and confirm the event now carries band
B's roster booked fresh, with A's (unpaid) bookings gone.

**Acceptance Scenarios**:

1. **Given** an event booked with band A, **When** the booker re-points it to band B, **Then** the event
   carries band B's current roster as fresh `proposed` bookings at standard rates, and band A's bookings that
   are **not settled by a live check** are removed.
2. **Given** band A had a member already settled by a live check, **When** the band is re-pointed, **Then**
   that paid member is **kept on the record** (per the written-check discriminator, US3), not silently
   dropped.

### User Story 3 - The written check decides: clean swap vs. preserved record (Priority: P1)

Whether a slot can be overwritten depends on whether a **live check** has settled it:

- **No live payment** on the booking → the slot may be **re-pointed** to a different performer or **cleared**
  outright, with no record of the outgoing performer kept (a clean swap). Available to both the **Booker** (on
  the report) and the **Financial Secretary** (on the gate).
- **A live check has settled** the booking → the slot **cannot** be re-pointed or cleared. Instead the outgoing
  performer is **kept as a no-show** on the record, and the substitute is added as a **new booking**. The
  check itself is handled on the money side (voided and reissued — feature 023).

**Why this priority**: This is the safety rule that protects written checks and keeps the historical record
honest; it governs both substitution and band re-point.

**Independent Test**: Attempt to re-point a booking with no payment (succeeds, clean) and one settled by a live
check (refused; the keep-no-show + new-booking path is offered instead).

**Acceptance Scenarios**:

1. **Given** a booking with no live payment, **When** the booker re-points it to a substitute, **Then** the
   slot becomes the substitute's fresh booking and the original performer is not retained.
2. **Given** a booking settled by a **live** check, **When** a re-point/clear is attempted, **Then** it is
   **refused**; the outgoing performer stays as a **no-show** and the substitute is added as a **separate new
   booking**.
3. **Given** a booking whose only settling check has been **voided**, **When** a re-point is attempted,
   **Then** it is **allowed** (a voided check no longer counts) — the clean-swap path applies.

### User Story 4 - Everyone who plays gets their own booking (Priority: P2)

A substitute (who replaced a no-show) and a **guest who sits in** with the band both get their **own booking**
on the event, so the person who actually performed is credited in the appearance and earnings records — not
hidden behind someone else's slot.

**Why this priority**: Appearance history and earnings are booking-based; a performer with no booking never
shows as having played.

**Independent Test**: Add a substitute and a guest sit-in to an event and confirm each appears as their own
booking (and thus in the performer's appearance record).

**Acceptance Scenarios**:

1. **Given** a performer who substituted for a no-show, **When** they are added, **Then** they have their own
   booking on the event.
2. **Given** a guest who joined an intact band for one event, **When** they are added, **Then** they have
   their own booking (nobody is dropped).

### Edge Cases

- **Lead cascade legality**: because the followers share the lead's *previous* status, the move is always a
  legal status transition; a member who diverged is skipped, never forced through an illegal transition.
- **Re-point of the lead**: re-pointing the lead to a different performer is a slot change (US3 rules), **not**
  a status cascade — the two are distinct operations.
- **Band re-point with a paid member**: outgoing members with no live payment are removed; any settled by a
  live check are kept as a no-show (US3), so the check is never orphaned.
- **A band with no lead / multiple leads on an event**: the cascade keys on the booking marked as the band's
  lead for that event; if none, nothing cascades.
- **Band re-point scope**: it acts **only on the named outgoing band** — any other band on the event and
  non-band bookings (caller, sound tech) are untouched.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Changing a band **lead's** booking status on an event MUST propagate that status to the band's
  **sibling bookings on the same event that are in lockstep** with the lead's previous status; diverged
  members (a different status) MUST be left unchanged. The cascade is **status-only** (pay/donated/note
  preserved). The cascade applies **only to a booker's direct status change of the lead** — an internal status
  change made by another operation (the no-show `declined` set during substitution or band re-point, FR-005)
  MUST NOT cascade.
- **FR-002**: Changing a **non-lead** member's status MUST NOT change any other booking; only the lead
  cascades. Re-pointing the lead to a different performer MUST NOT trigger the cascade.
- **FR-003**: The booker MUST be able to **re-point an event's band** to a different band: the outgoing band's
  bookings (those not preserved by FR-005) are removed and the new band's current roster is booked **fresh**
  (proposed, standard rates, lead as lead performer). No automatic reconciliation of members shared by the two
  bands.
- **FR-004**: A booking with **no live payment** MAY be **re-pointed** (to a different performer, resetting to
  proposed/standard rate) or **cleared**; no record of the outgoing performer is retained.
- **FR-005**: A booking **settled by a live payment** MUST NOT be re-pointed or cleared; the outgoing performer
  MUST be **kept as a no-show** and the substitute added as a **new booking**. (The check is voided/reissued on
  the money side — feature 023.) Setting the outgoing performer to a no-show MUST NOT trigger the lead cascade
  (FR-001): substituting a no-show **lead** must leave the rest of the band as it was.
- **FR-006**: A booking whose settling payment(s) are all **voided** MUST be treated as unpaid for FR-004 — a
  re-point/clear is allowed.
- **FR-007**: A **substitute** and a **guest sit-in** MUST each get their **own booking** on the event.
- **FR-008**: The clean re-point/clear and the substitute-add MUST be available to **both** the Booker (booking
  report) and the Financial Secretary (gate surface).
- **FR-009**: All cascades, re-points, band re-points, clears, and substitute additions MUST be recorded
  through the existing audit path.

### Key Entities *(include if feature involves data)*

- **Booking**: a performer's slot on an event (status, pay, performer, band, lead-flag). Amended here by the
  cascade (status), re-point (performer + reset), and clear (removal).
- **Band / band membership**: the roster and which member is the **lead**; the source for a band re-point and
  for identifying the lead whose status cascades.
- **Live payment settlement**: whether a booking is settled by a non-voided check (from feature 023) — the
  **discriminator** for FR-004/FR-005.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A lead's status change updates all lockstep band members in a **single** action; a diverged
  member is unchanged — verifiable on a booked band.
- **SC-002**: Re-pointing a band replaces its roster in a **single** action; the new bookings are `proposed` at
  standard rates.
- **SC-003**: A booking settled by a live check is **refused** re-point/clear in 100% of attempts, and the
  keep-no-show + new-booking path is offered instead.
- **SC-004**: A booking with no live payment (or only voided payments) re-points/clears cleanly in 100% of
  attempts.
- **SC-005**: 100% of performers who played (substitutes and guests included) have their own booking, so they
  appear in the performer appearance record.
- **SC-006**: No regression — existing booking, band, report, and payment behaviors stay green.

## Assumptions

- **Builds on feature 023**: "settled by a live payment" uses 023's live (non-voided) per-line settlement
  (`settledCentsByBookingForEvent`); the money side of a substitution (void the wrong check, reissue to the
  substitute) is 023's void/reissue, **not** re-specified here.
- **Settled decisions** (Phase 4 draft): lead cascade = lockstep-only, status-only; band re-point = wholesale
  start-over with no overlap reconciliation; the **written check is the single discriminator** for
  overwrite-vs-preserve; substitutes and guests each get their own booking; a voided payment does not block
  re-point (tentative, confirmed here).
- **Band re-point** reuses the existing book-a-band roster mechanic (feature 008) for the incoming band.
- **Out of scope**: automatic recognition that a reduced band "is" another band; non-performer reimbursement
  (B42); any change to the 023 payment substrate or the treasurer/organizer reports.
- Money is integer cents. Solo-maintainer workflow (constitution v1.3.0): one atomic commit; full local gate
  suite as the reviewer.
