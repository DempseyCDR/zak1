# Feature Specification: Reusable Band Roster

**Feature Branch**: `008-band-roster`

**Created**: 2026-07-03

**Status**: Draft

**Input**: Derived from BACKLOG.md item B15 (reusable Band roster, deferred from feature 003), extended with two new requirements: the public website should display a registered Band as a unit in place of an ad hoc musician list, and a Band has its own photo distinct from each member's individual photo.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Define and maintain a reusable Band roster (Priority: P1)

An organizer creates a Band — a name, an optional bio and photo, one Lead Musician, and zero or more other Musicians, all drawn from the existing Performer directory — so the same lineup doesn't need to be re-entered for every event.

**Why this priority**: Without a persisted, reusable roster, nothing else in this feature is possible. This is the foundation.

**Independent Test**: Create a Band with a lead musician and two other musicians; confirm it's saved and appears in a Band directory that can be reopened and edited later.

**Acceptance Scenarios**:

1. **Given** no Bands exist yet, **When** an organizer creates a Band with a name, a Lead Musician, and two Musicians, **Then** the Band is saved and appears in a Band directory.
2. **Given** an existing Band, **When** an organizer adds or removes a Musician, or reassigns which member is the Lead Musician, **Then** the change is saved and applies to future bookings of that Band; events already booked from that Band are unaffected.
3. **Given** an existing Band, **When** an organizer edits its name, bio, or photo, **Then** the change is saved without affecting any member's own individual bio or photo.

---

### User Story 2 - Book an entire Band onto an event in one action (Priority: P1)

An organizer books a whole Band onto an event in a single action instead of adding each member's booking individually.

**Why this priority**: This is the direct payoff of having a reusable roster — the workflow savings B15 was written to capture.

**Independent Test**: With a 4-person Band already defined, book it onto an event in one action and confirm 4 individual performer bookings are created, each with the correct performer type and existing pay/check rules.

**Acceptance Scenarios**:

1. **Given** an event and an existing Band, **When** an organizer books that Band onto the event, **Then** one booking is created for the Lead Musician and one for each other current roster member, each following the existing performer-type pay and check rules (feature 003).
2. **Given** a Band already booked onto an event, **When** an organizer removes, substitutes, or adds an individual booking for that event (e.g., a member couldn't make it that night), **Then** only that event's bookings change — the Band's reusable roster is unaffected.
3. **Given** a Band already booked onto an event, **When** the organizer later edits the Band's roster elsewhere, **Then** that event's already-created bookings do not change retroactively.
4. **Given** a series with a standard Musician rate in effect, **When** an organizer books a Band in that series onto an event, **Then** every roster member's pay is pre-filled with that rate, and the booker may change any of them individually before saving.
5. **Given** a series with no standard Musician rate in effect, **When** the booker enters a pay amount for the first roster member, **Then** the system proposes that same amount as the default pay for each remaining member, and the booker may change any of them individually before saving.

---

### User Story 3 - Public site displays a booked Band as a unit (Priority: P2)

A visitor to the public website sees a registered Band's name, bio, and photo displayed as one unit for an event, instead of an ad hoc list of its individual musicians.

**Why this priority**: This is the new public-facing value requested alongside the roster itself; it depends on User Story 1 and 2 already producing a traceable Band booking.

**Independent Test**: Book a Band onto an event, load that event's public listing, and confirm it shows the Band's name/bio/photo as one block rather than listing each musician separately.

**Acceptance Scenarios**:

1. **Given** an event with bookings created by booking a Band as a unit, **When** the public event listing renders, **Then** it shows that Band's name, bio, and photo instead of listing its linked musicians individually.
2. **Given** the same event, **When** the Band's block is displayed, **Then** it shows the Band's own photo and bio, not any individual member's photo or bio.
3. **Given** an event whose musician bookings were added individually (not via booking a Band), **When** the public listing renders, **Then** it falls back to today's ad hoc per-musician display (feature 007).
4. **Given** an event with both a Band-linked booking set and a separately added ad hoc musician booking, **When** the public listing renders, **Then** the Band displays as one block and the ad hoc booking displays individually alongside it.
5. **Given** an event with bookings from two different Bands (e.g., an opener and a headliner), **When** the public listing renders, **Then** each Band displays as its own separate block.

### Edge Cases

- A Band is deleted after having been booked onto past events: those events' existing bookings and their public display are unaffected; the Band simply can no longer be selected for new bookings.
- A Band has no photo set: the public listing shows its name and bio without an image, consistent with how individual performers without a photo are already handled.
- A Band's roster changes after an event was booked from it: the previously created bookings for that event keep displaying as that Band (User Story 2, Scenario 3).
- A performer belongs to more than one Band (e.g., leads one, plays in another): this is expected and consistent with feature 003's existing per-booking role model.
- No standard Musician rate is configured for a series: booking a Band in that series falls back to first-entered-amount-propagates behavior (FR-003b) instead of pre-filling from a rate.
- The first roster member's pay is entered as $0 (donated), with no standard rate in effect: the system still proposes $0 for the remaining members, which the booker can raise individually for anyone who is actually paid.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow creating a Band with a name, one Lead Musician, and zero or more Musicians, all selected from existing Performers.
- **FR-002**: System MUST allow editing a Band's name, bio, photo, and roster (including reassigning the Lead Musician) at any time; edits apply only to future bookings of that Band, never retroactively to events already booked from it.
- **FR-003**: Organizers MUST be able to book an entire Band onto an event in one action, creating one booking per current roster member with each member's correct performer type and the existing pay/check rules (feature 003 FR-001/002/006/007/008).
- **FR-003a**: When booking a Band as a unit, each roster member's pay MUST default to the standard Musician rate in effect for the event's series and date (FR-012), when one exists; the booker MAY override any member's pay individually before saving.
- **FR-003b**: When no standard Musician rate exists for that series and date, the booker MUST specify pay for the first roster member manually, and the system MUST propose that same amount as the default for each remaining member; the booker MAY change any of them individually before saving.
- **FR-004**: Each booking created by booking a Band as a unit MUST retain traceability to that Band, so it continues to display as part of the Band (FR-007) even if that individual booking is later edited or the Band's roster subsequently changes.
- **FR-005**: Organizers MUST be able to add, remove, or substitute individual bookings for a specific event after booking a Band as a unit, without altering the Band's reusable roster.
- **FR-006**: A Performer MUST be able to belong to more than one Band, consistent with feature 003's existing per-booking role rules.
- **FR-007**: The public website MUST display a Band's name, bio, and photo as a single unit in place of listing its linked bookings individually.
- **FR-008**: The public website MUST continue to display any booking not linked to a Band using today's ad hoc per-musician rules (feature 007 FR-003), even on an event that also has Band-linked bookings.
- **FR-009**: A Band's photo and bio MUST be stored and displayed independently of, and MUST NOT overwrite or be overwritten by, any roster member's own individual photo and bio.
- **FR-010**: System MUST provide an admin-facing way to create, view, and edit Bands (name, bio, photo, roster), independent of the existing Performer directory.
- **FR-011**: System MUST allow deleting a Band; deleting a Band MUST NOT delete or alter any performer or any already-created booking.
- **FR-012**: System MUST support a standard Musician pay rate, effective-dated and scoped per series (extending the series-scoped rate-parameter design in BACKLOG.md B16), used to default pay for both Lead Musician and Musician bookings — whether booked individually (feature 003) or as part of a Band (this feature).
- **FR-013**: Lead Musician and Musician MUST share identical pay, check, and public-display treatment. "Lead Musician" designates only which roster member is the Band's point of contact for booking, not a distinct pay tier.

### Key Entities *(include if feature involves data)*

- **Band**: A reusable, named performer roster — one Lead Musician plus zero or more Musicians, drawn from existing Performers — with its own optional bio and photo, independent of any member's individual bio/photo. Persists across events; edits are current-state only (no effective-dated history) and never retroactively affect events already booked from it.
- **Booking → Band link**: An existing Booking (feature 003) gains an association to the Band it was created from, when created via "book as a unit." This association is what lets the public site group and brand those bookings as the Band (FR-007) and is unaffected by later roster edits.
- **Musician Standard Rate**: An effective-dated pay rate scoped per series, used to default pay for Lead Musician and Musician bookings when one exists for that series and date (FR-012). Extends feature 003's existing rate-parameter model (today limited to Caller and Sound Tech, and not series-scoped) to cover this shared role and to vary by series, per BACKLOG.md B16's design.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An organizer can book a Band of any size onto an event in a single action, regardless of how many musicians are in its roster.
- **SC-002**: 100% of events whose musician bookings were created by booking a Band display that Band's name, bio, and photo on the public site instead of an ad hoc list.
- **SC-003**: 100% of musician bookings not created via a Band continue to display exactly as they do today.
- **SC-004**: Editing a Band's roster, bio, or photo never changes how an already-booked past event is displayed.
- **SC-005**: A Band's photo and bio can be set and changed without affecting any roster member's individually displayed photo or bio, in 100% of cases.
- **SC-006**: Booking a Band whose members all share the same pay, with no standard rate configured, requires entering that amount only once — the booker fills in one pay field, not one per member.
- **SC-007**: When a standard Musician rate is in effect for a series, booking a Band in that series pre-fills every member's pay automatically, with zero manual entries required before saving (overrides remain optional).

## Assumptions

- Booking a Band as a unit does not change feature 003's existing check-requirement or public-display-type rules for individual performer types — no new "band check" concept is introduced. It does, however, retrofit feature 003's *pay-rate* model: Lead Musician and Musician bookings (individual or via a Band) now default from a standard, series-scoped Musician rate (FR-012/FR-013) the same way Caller and Sound Tech bookings already default from their standard rates — closing a gap where these two roles previously had no standard rate at all and always required manual entry.
- This feature depends on making rate parameters series-scoped, which today they are not (feature 003's `rate_parameters` — Caller/Sound Tech — is global, not per-series). BACKLOG.md B16 already designed this series-scoping (plus a new `general` series for joint/cross-series events) as part of consolidating `rateParameters` with `SeriesExpenseParameter`. This feature's planning should pick up B16's series-scoping design as a prerequisite, adding a `musician` rate kind to it rather than inventing a second, parallel rate mechanism.
- Lead Musician remains a useful designation for identifying the Band's booking point of contact; it is no longer (and per feature 003's actual current rules, never really was — both roles already share identical paid/check/display treatment in code) a distinct pay tier from Musician.
- Band roster membership is current-state only (no effective-dated history). This is sufficient because traceability for already-booked events is preserved via the per-booking link to the Band (FR-004), not by re-deriving membership from the roster at display time.
- A performer can belong to multiple Bands simultaneously, consistent with feature 003's existing "roles are per booking" model.
- No access-control distinction is introduced for who may create or edit Bands, consistent with this build's existing no-authentication model.
- A Band's photo/bio follow the same lightweight text/URL storage pattern already used for individual Performers (feature 003); no new media-upload pipeline is introduced.
- This feature builds on feature 003 (performers/bookings, already implemented) for the underlying Performer and Booking entities. Feature 007 (public website, spec drafted but not yet planned) will consume FR-007/FR-008 when it is planned; 007's existing performer-display requirement (FR-003) will need to reference this Band display rule at that time.
