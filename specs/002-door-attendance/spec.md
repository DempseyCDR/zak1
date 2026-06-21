# Feature Specification: Door Attendance & Gate Capture

**Feature Branch**: `002-door-attendance`

**Created**: 2026-06-18

**Status**: Draft

**Input**: Derived from CDR_Project_Context_v1.2.md — Door Attendance, Door Record, Gate Sales Model, Contact tracing retention.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Check dancers in at the door (Priority: P1)

A door volunteer types an arriving dancer's name, sees a ranked list of likely matches near-instantly, and records their attendance; if no one matches, the volunteer captures a name and email to create a new contact for admin review.

**Why this priority**: This is the core nightly workflow performed by volunteers under time pressure as a line forms; everything else about an event hangs off who attended.

**Independent Test**: Type a partial name, confirm ranked matches appear within the response target, select one to record attendance, and separately enter an unknown name+email to confirm a new contact is queued for admin review.

**Acceptance Scenarios**:

1. **Given** an existing contact, **When** the volunteer types part of their name, **Then** a ranked pick list of candidate matches appears within 300 ms.
2. **Given** a candidate in the pick list, **When** the volunteer selects them, **Then** that contact is recorded present for the event, and selecting the same contact again is rejected.
3. **Given** multiple similar matches, **When** the volunteer needs to disambiguate, **Then** email is shown to distinguish them.
4. **Given** no match, **When** the volunteer enters a name and email, **Then** a new contact is created and flagged for admin review.
5. **Given** a dancer who declines to give details, **When** the volunteer proceeds, **Then** the attendance is recorded as an unmatched attendance contact.

---

### User Story 2 - Record the door's money (Priority: P1)

A door volunteer records the evening's cash and card takings across the seven gate-sales categories and the cash reconciliation so the event's finances can be computed and deposited.

**Why this priority**: Accurate gate capture feeds both the Treasurer Report and Organizer Report; errors here propagate to the club's books.

**Independent Test**: Enter cash and card amounts per category plus seed float, payouts, and POS transaction count; confirm the deposit amount and POS fee are computed correctly without the volunteer seeing the fee.

**Acceptance Scenarios**:

1. **Given** an event, **When** the volunteer records gate sales, **Then** each of the seven categories is captured separately by cash and by card.
2. **Given** entered POS transaction count and gross, **When** the record is saved, **Then** the system computes the POS fee without displaying it to the volunteer.
3. **Given** gross cash, seed float, and payouts, **When** computed, **Then** deposit amount = gross cash − seed float − cash paid out.
4. **Given** a cash payout, **When** entered, **Then** a reason is required.

---

### User Story 3 - Support contact-tracing retention rules (Priority: P3)

The system retains identifiable attendance for a limited window for contact-tracing purposes while preserving anonymous counts permanently.

**Why this priority**: A privacy/compliance requirement that matters but does not block daily operation.

**Independent Test**: Record attendance, advance the clock past the retention window, and confirm identifiable attendee links are purged while quarterly counts remain.

**Acceptance Scenarios**:

1. **Given** attendee contacts on a door record, **When** 90 days have passed, **Then** the identifiable attendance links are purged.
2. **Given** purged attendance, **When** quarterly counts are queried, **Then** the aggregate counts persist permanently.

### Edge Cases

- A Community Dance held the same evening as TNC has its own separate door record and financials.
- Free events (e.g., instructor-led) still track attendance and MAY record donations, but collect no paid admission.
- Gift cards redeemed for admission are counted but are not a cash/card gate sale.
- Seed float defaults to $15 but is overridable per door record.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST let a volunteer find an existing contact by fuzzy name search returning a ranked pick list within 300 ms.
- **FR-001a**: System MUST record attendance for an event by linking a volunteer-selected existing contact, and MUST prevent recording the same contact twice for one event.
- **FR-002**: System MUST show email to disambiguate multiple matches.
- **FR-003**: System MUST allow creating a new contact (name + email) at the door, flagged for admin review.
- **FR-004**: System MUST support recording an unmatched attendance when a dancer declines to provide details.
- **FR-005**: System MUST capture gate sales in seven categories (today_admission, merchandise, donation, future_event, membership, gift_card, misc_sales), each separated by cash and card.
- **FR-006**: System MUST record per door record: POS transaction count, POS gross total, gross cash collected (incl. seed float), cash paid out with reason, seed float, and gift-card redemption count.
- **FR-007**: System MUST compute the POS fee from transaction count and gross total and MUST NOT display it to the door volunteer.
- **FR-008**: System MUST compute deposit amount as gross cash − seed float − cash paid out.
- **FR-009**: System MUST treat each event as having its own door record, including a same-evening Community Dance separate from TNC.
- **FR-010**: System MUST track attendance per event, independently of any door record, so every event (free or paid) can have attendance. A free event collects no paid admission; the system MUST allow it to record donations, in which case a door record is created. A door record is created only when money is collected (always for paid events; for free events only if donations).
- **FR-011**: System MUST purge identifiable attendee links 90 days after the event while persisting quarterly aggregate counts permanently.
- **FR-012**: System MUST log auditable creation and edits of door financial records (who/what/when).
- **FR-013**: System MUST support grouping related events into an event group (e.g., Double Dance, multi-day weekend festival, Jane Austen Ball prep + ball); an event MAY belong to at most one group.

### Key Entities *(include if feature involves data)*

- **Series**: A recurring dance program (e.g., TNC, ECD, Community Dance) that events belong to; informs reporting and some rules (e.g., Community Dance has no Sound Tech).
- **Event**: A dated instance of a series; the unit attendance and a door record attach to. May charge admission or be free, and may belong to an event group.
- **Event Group**: A named grouping of related events (Double Dance, weekend festival, JAB prep + ball). Added now so events can be grouped; a single ticket spanning a group is deferred (see Assumptions).
- **Door Record**: The financial record for one event instance (gate sales, cash, fee, deposit); 0-or-1 per event, created only when money is collected.
- **Gate Sale**: A sale line keyed by category × payment method (cash/card) under a door record.
- **Attendance**: A link between an event and a contact (or an unmatched placeholder), independent of the door record, subject to retention rules.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A volunteer can check in a returning dancer in under 10 seconds, with matches shown within 300 ms.
- **SC-002**: Computed deposit and POS fee match a manual recalculation in 100% of test events.
- **SC-003**: Door volunteers never see fee figures during check-in.
- **SC-004**: Identifiable attendance is fully purged after 90 days in 100% of records, with aggregate counts intact.
- **SC-005**: All seven gate categories reconcile to the totals used by the Treasurer and Organizer reports.

## Assumptions

- Gift cards (not punch cards) are the only stored-value instrument.
- The choice of fuzzy-matching technique is an implementation detail; the requirement is ranked results within 300 ms.
- POS card data is reconciled against the payment processor downstream (see Treasurer Report feature).
- **Group tickets are deferred**: this phase adds the Event Group entity (grouping of events) only. A single ticket purchased once and redeemable as admission across all events in a group is out of scope here and belongs to feature 007 (online sales) + door redemption, with revenue attribution handled in features 004/005.
