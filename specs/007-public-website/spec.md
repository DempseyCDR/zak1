# Feature Specification: Public Website & Online Sales

**Feature Branch**: `007-public-website`

**Created**: 2026-06-18

**Status**: Draft

**Input**: Derived from CDR_Project_Context_v1.2.md — replace WordPress site, public performer display, online advance tickets & memberships (PayPal), venue maps, dance activity schedule.

## Clarifications

### Session 2026-07-03

- Q: How much of the online payment (PayPal) integration should this feature build? → A: Defer payments entirely. This feature builds only the public browse site (User Story 1); the online-sales User Story 2 — and its FR-004–FR-008, FR-011, the Online Order entity, and SC-002/SC-003/SC-004 — move to a future phase. The purchase flow is not stubbed in the UI; free/browse content only.
- Q: How should venue data be modeled for the public site's venue + map (no Venue entity exists today)? → A: A structured Venue entity (name + address, optional coordinates), referenced by events via a nullable `venue_id`; the map is derived from the venue's address/coordinates. Resolves BACKLOG B12 for the venue attribute.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Browse dances and performers publicly (Priority: P1)

A prospective or returning dancer visits the public site to see upcoming dances, venue details with a map, and performer bios/photos, replacing the legacy WordPress site.

**Why this priority**: The public site is the club's front door and the artifact being replaced; it must inform the community about what's happening and where.

**Independent Test**: Load the public site and confirm upcoming dances, venue + map, and publicly-displayed performers render with the correct public-display rules.

**Acceptance Scenarios**:

1. **Given** scheduled dances, **When** a visitor views the site, **Then** upcoming events appear with date, activity, and venue.
2. **Given** a venue, **When** displayed, **Then** a location map is shown.
3. **Given** an event's performers, **When** displayed, **Then** Callers/Lead Musicians show full bio + photo, unpaid musicians show "Open Band", Sound Techs are hidden, and Instructors show name + short note.
4. **Given** an event with bookings created by booking a Band as a unit (feature 008), **When** displayed, **Then** those bookings render as a single Band block (band name/bio/photo) rather than individual musicians, while any non-band bookings on the same event render per the per-performer rules above.

---

### User Story 2 - Buy advance tickets and memberships online (Priority: P1) — DEFERRED

**Status**: Deferred to a future phase (2026-07-03 clarification). Retained here for continuity; NOT in scope for this feature. Its requirements (FR-004–FR-008, FR-011), the Online Order entity, and SC-002/SC-003/SC-004 are likewise deferred. Online advance tickets also depend on the deferred group-ticket work (BACKLOG B1).

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
- **FR-002**: System MUST display a venue location map for each venue, using a structured Venue entity (name + address, optional coordinates) that events reference via a nullable `venue_id`; the map is derived from the venue's address/coordinates. Events without a venue assigned are listed without a map.
- **FR-003**: System MUST render publicly-displayed performers per the public-display rules (full bio+photo for paid Caller/Lead Musician, "Open Band" for unpaid, Sound Tech hidden, Instructor name+note). For bookings created by booking a Band as a unit (feature 008), the system MUST render one Band block (band name/bio/photo) in place of the individual musicians, consuming feature 008's `groupEventBookingsForDisplay` read model; non-band bookings on the same event still render per the per-performer rules.
- **FR-004** *(Deferred with US2)*: System MUST allow online purchase of advance tickets for special events, recorded as advance ticket proceeds.
- **FR-005** *(Deferred with US2)*: System MUST allow online membership payment, creating a membership and updating the buyer's membership status.
- **FR-006** *(Deferred with US2)*: System MUST link each online purchase to a contact, creating one (for admin dedup review) when none exists.
- **FR-007** *(Deferred with US2)*: System MUST compute the online payment fee as $0.49/txn + 1.99% and record revenue at gross.
- **FR-008** *(Deferred with US2)*: System MUST integrate with the club's existing online payment processor for online sales.
- **FR-009**: System MUST integrate with a maps provider to display venue locations.
- **FR-010**: System MUST list free events (e.g., Fringe) publicly without a purchase flow (in this phase, all public events are display-only — there is no purchase flow at all).
- **FR-011** *(Deferred with US2)*: System MUST log auditable online transactions and their linkage to contacts/memberships.

### Key Entities *(include if feature involves data)*

- **Public Event Listing**: The public-facing view of a scheduled dance activity, including venue and performers.
- **Venue**: A structured location (name + address, optional coordinates) referenced by events via a nullable `venue_id`; drives the public listing's venue label and map. New entity introduced by this feature (resolves the venue attribute from BACKLOG B12).
- **Online Order** *(Deferred with US2)*: An advance-ticket or membership purchase made online, linked to a contact, with computed fee and gross amount.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The public site fully replaces cdrochester.org's event, venue, and performer information.
- **SC-002** *(Deferred with US2)*: A visitor can complete an online membership or advance-ticket purchase in under 3 minutes.
- **SC-003** *(Deferred with US2)*: 100% of online purchases are recorded at gross with the correct computed fee and linked to a contact.
- **SC-004** *(Deferred with US2)*: Online membership purchases update membership status with no manual step.
- **SC-005**: Public performer display matches the type-specific rules in 100% of cases.

## Assumptions

- **Online payments (US2 + FR-004–008/011) are deferred to a future phase** (2026-07-03 clarification). This feature is the public browse site only: event listings, venue + map, and public performer/band display. WooCommerce remains discarded; when online sales are built later, the processor is the club's existing PayPal account. Online advance tickets also depend on the deferred group-ticket work (BACKLOG B1).
- A structured **Venue** entity is introduced by this feature (name + address, optional coordinates), referenced by events via a nullable `venue_id` (resolves the venue attribute of BACKLOG B12). Venues are managed by an admin; assigning a venue to an event is optional (unassigned events list without a map).
- The maps provider is a configurable integration constraint (the source doc names Google Static Maps); the requirement describes behavior — a location map derived from the venue's address/coordinates — not a specific vendor lock-in.
- Public performer display consumes existing read models: feature 003's per-performer public-display rules and feature 008's `groupEventBookingsForDisplay` for Band blocks. No new performer/booking data is introduced.
- Native iOS/Android apps and platform-sent automated email are deferred to future phases.
