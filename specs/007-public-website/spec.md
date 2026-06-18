# Feature Specification: Public Website & Online Sales

**Feature Branch**: `007-public-website`

**Created**: 2026-06-18

**Status**: Draft

**Input**: Derived from CDR_Project_Context_v1.2.md — replace WordPress site, public performer display, online advance tickets & memberships (PayPal), venue maps, dance activity schedule.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Browse dances and performers publicly (Priority: P1)

A prospective or returning dancer visits the public site to see upcoming dances, venue details with a map, and performer bios/photos, replacing the legacy WordPress site.

**Why this priority**: The public site is the club's front door and the artifact being replaced; it must inform the community about what's happening and where.

**Independent Test**: Load the public site and confirm upcoming dances, venue + map, and publicly-displayed performers render with the correct public-display rules.

**Acceptance Scenarios**:

1. **Given** scheduled dances, **When** a visitor views the site, **Then** upcoming events appear with date, activity, and venue.
2. **Given** a venue, **When** displayed, **Then** a location map is shown.
3. **Given** an event's performers, **When** displayed, **Then** Callers/Lead Musicians show full bio + photo, unpaid musicians show "Open Band", Sound Techs are hidden, and Instructors show name + short note.

---

### User Story 2 - Buy advance tickets and memberships online (Priority: P1)

A visitor purchases advance tickets to a special event or pays membership dues online, with the payment processed and recorded so it flows into the club's financials.

**Why this priority**: Online advance sales (e.g., weekend festivals, memberships) are a revenue stream the legacy stack handled poorly; capturing them correctly feeds membership status and the treasurer's books.

**Independent Test**: Complete an online membership purchase and an advance-ticket purchase in a test environment and confirm each is recorded with the correct category, fee, and linkage to a contact/member.

**Acceptance Scenarios**:

1. **Given** a special event with advance tickets, **When** a visitor pays online, **Then** the purchase is recorded as advance ticket proceeds linked to a contact.
2. **Given** a visitor paying dues online, **When** payment completes, **Then** a membership is recorded and the contact's membership status updates accordingly.
3. **Given** an online order, **When** processed, **Then** the online fee ($0.49/txn + 1.99%) is computed and revenue is recorded at gross.

### Edge Cases

- A buyer with no existing contact must result in a contact being created/linked (subject to admin dedup review).
- Fringe and other free events are listed publicly but have no purchase flow.
- Multi-day weekend festivals sell advance tickets ahead of the event.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST present a public website listing upcoming dance activities with date, activity type, and venue, replacing the legacy WordPress site.
- **FR-002**: System MUST display a venue location map for each venue.
- **FR-003**: System MUST render publicly-displayed performers per the public-display rules (full bio+photo for paid Caller/Lead Musician, "Open Band" for unpaid, Sound Tech hidden, Instructor name+note).
- **FR-004**: System MUST allow online purchase of advance tickets for special events, recorded as advance ticket proceeds.
- **FR-005**: System MUST allow online membership payment, creating a membership and updating the buyer's membership status.
- **FR-006**: System MUST link each online purchase to a contact, creating one (for admin dedup review) when none exists.
- **FR-007**: System MUST compute the online payment fee as $0.49/txn + 1.99% and record revenue at gross.
- **FR-008**: System MUST integrate with the club's existing online payment processor for online sales.
- **FR-009**: System MUST integrate with a maps provider to display venue locations.
- **FR-010**: System MUST list free events (e.g., Fringe) publicly without a purchase flow.
- **FR-011**: System MUST log auditable online transactions and their linkage to contacts/memberships.

### Key Entities *(include if feature involves data)*

- **Public Event Listing**: The public-facing view of a scheduled dance activity, including venue and performers.
- **Venue**: A location with address and map display.
- **Online Order**: An advance-ticket or membership purchase made online, linked to a contact, with computed fee and gross amount.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The public site fully replaces cdrochester.org's event, venue, and performer information.
- **SC-002**: A visitor can complete an online membership or advance-ticket purchase in under 3 minutes.
- **SC-003**: 100% of online purchases are recorded at gross with the correct computed fee and linked to a contact.
- **SC-004**: Online membership purchases update membership status with no manual step.
- **SC-005**: Public performer display matches the type-specific rules in 100% of cases.

## Assumptions

- WooCommerce is discarded entirely; the payment processor is the club's existing PayPal account (online advance tickets and memberships).
- The specific payment-processor SDK and maps provider are real-world integration constraints, configurable per club where feasible; requirements describe behavior, not a specific vendor lock-in beyond the existing account.
- Native iOS/Android apps and platform-sent automated email are deferred to future phases.
