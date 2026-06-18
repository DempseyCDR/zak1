# Feature Specification: Performers & Bookings

**Feature Branch**: `003-performers-bookings`

**Created**: 2026-06-18

**Status**: Draft

**Input**: Derived from CDR_Project_Context_v1.2.md — Performer Types, $0 bookings, Rate Parameters (caller/sound tech pay), public display rules.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Book performers for an event (Priority: P1)

An organizer books the performers for an event — caller, lead musician(s), sound tech, open band, or instructor — applying the correct pay rules for each performer type.

**Why this priority**: Performer pay is a core input to the Dance Net calculation and the Treasurer Report's check-writing workflow; bookings define what each event costs.

**Independent Test**: Book one of each performer type to an event and confirm each carries the correct paid/check/public-display behavior and default pay rate.

**Acceptance Scenarios**:

1. **Given** an event, **When** the organizer books a Caller, **Then** the caller is paid, requires exactly one check, and is publicly displayed with full bio + photo.
2. **Given** an event, **When** the organizer books an Open Band Musician, **Then** they are unpaid, require no check, and are shown publicly only as "Open Band".
3. **Given** an event, **When** the organizer books a Sound Tech, **Then** they are paid and require a check but are not listed publicly, and Sound Tech is unavailable for Community Dance.
4. **Given** an event, **When** the organizer books an Instructor, **Then** they are always free, never require a check, and are shown by name with a short note.

---

### User Story 2 - Handle donated ($0) bookings (Priority: P2)

An organizer books a performer who is donating their fee, recording the booking at $0 with no check while still counting the appearance.

**Why this priority**: Donated fees are common and must not distort earnings or trigger check-writing, but the appearance must still count for history and public credit.

**Independent Test**: Book a caller at $0 (donated), confirm no check is generated, the appearance is in their history, and the amount is excluded from year-to-date earnings.

**Acceptance Scenarios**:

1. **Given** a performer donating their fee, **When** booked at $0, **Then** no check is required.
2. **Given** a $0 booking, **When** appearance history is viewed, **Then** the appearance is counted.
3. **Given** a $0 booking, **When** year-to-date earnings are computed, **Then** the donated amount is excluded.

---

### User Story 3 - Manage standard pay rates over time (Priority: P2)

An administrator maintains standard pay rates (caller, sound tech) with effective-date history so the correct rate is applied based on event date, with per-booking override.

**Why this priority**: Rates change over time; bookings must reflect the rate in effect on the event date, while allowing exceptions.

**Independent Test**: Set a rate effective from a date, book events before and after that date, and confirm each booking defaults to the rate in effect, with the ability to override.

**Acceptance Scenarios**:

1. **Given** a rate with effective dates, **When** an event is booked, **Then** the default pay reflects the rate in effect on the event date.
2. **Given** a default pay, **When** the organizer overrides it, **Then** the booking uses the overridden amount.

### Edge Cases

- A performer may appear in multiple roles over time; public display depends on the role for that booking.
- Community Dance: paid Caller + 1–2 paid Lead Musicians + Open Band, with no Sound Tech.
- An instructor leading a free pre-dance event is never paid under any circumstance.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST support performer types Caller, Lead Musician, Open Band Musician, Sound Tech, and Instructor, each with its paid/check/public-display rules.
- **FR-002**: System MUST require exactly one check per event for a Caller and per musician for Lead Musicians (when paid > $0).
- **FR-003**: System MUST display Caller and Lead Musician with full bio and photo, label unpaid musicians as "Open Band", hide Sound Tech from public listings, and show Instructor by name with a short note.
- **FR-004**: System MUST prevent assigning a Sound Tech to a Community Dance.
- **FR-005**: System MUST treat Instructors as always free with no check, with no exceptions.
- **FR-006**: System MUST support $0 (donated-fee) bookings that require no check, count in appearance history, and are excluded from year-to-date earnings.
- **FR-007**: System MUST maintain standard caller pay and standard sound tech pay as rate parameters with effective-date history.
- **FR-008**: System MUST default each booking's pay to the rate in effect on the event date and allow a per-booking override.
- **FR-009**: System MUST provide a combined performer total per event with a drill-down breakdown by performer.
- **FR-010**: System MUST maintain per-performer appearance history and year-to-date earnings (excluding $0 donations from earnings).
- **FR-011**: System MUST log auditable changes to rate parameters (who/what/when, effective date).

### Key Entities *(include if feature involves data)*

- **Performer**: A person who appears at events; carries type-specific rules, public bio/photo where applicable, appearance history, and YTD earnings.
- **Booking**: A performer assigned to an event in a role, with a pay amount (possibly $0/donated) and optional override.
- **Pay Rate Parameter**: A standard rate (caller, sound tech) with effective-date history.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of bookings apply the pay rate in effect on the event date unless explicitly overridden.
- **SC-002**: Donated ($0) bookings appear in appearance history and never in YTD earnings, in 100% of cases.
- **SC-003**: No check is ever generated for Open Band, Instructor, or $0 bookings.
- **SC-004**: The combined performer total per event equals the sum shown in its drill-down breakdown.

## Assumptions

- Cross-club shared performer directory is deferred to a future phase.
- Public bio/photo content management is part of this feature for performers who are publicly displayed; broader public-site rendering lives in the Public Website feature.
