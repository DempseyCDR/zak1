# Feature Specification: Contacts & Membership

**Feature Branch**: `001-contacts-membership`

**Created**: 2026-06-18

**Status**: Draft

**Input**: Derived from CDR_Project_Context_v1.2.md — People Model, ContactEmail, Membership Status, Deduplication.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Maintain the contact directory (Priority: P1)

An administrator maintains the single source of truth for everyone the club communicates with (~1,300 records), each with one or more email addresses carrying their own type, status, and marketing-consent flags.

**Why this priority**: Every other subsystem (door check-in, email export, membership, reporting) depends on a reliable contact record. Without it, nothing else has anyone to attach to.

**Independent Test**: Create, edit, and retrieve a contact with multiple emails; confirm each email's type/status/consent flags persist and that an email address cannot be reused across active records.

**Acceptance Scenarios**:

1. **Given** a new person, **When** the admin creates a contact with one email, **Then** the contact is stored with a stable unique identifier and the email is marked active with the "personal" purpose presented by default.
2. **Given** an existing contact, **When** the admin adds a second email tagged with the "booking" purpose, **Then** both emails are retained against the same contact.
3. **Given** an email, **When** the admin tags it with more than one purpose (e.g., personal and booking), **Then** all selected purposes are retained for that address.
4. **Given** an email already active on another contact, **When** the admin tries to add it, **Then** the system rejects it as a duplicate.

---

### User Story 2 - Track membership status automatically (Priority: P1)

A contact who pays dues becomes a member; the system classifies every contact's membership status (current / lapsed / long_lapsed / never) and keeps it accurate as memberships change and over time.

**Why this priority**: Membership status drives email segmentation, member benefits, and reporting. Manual tracking across spreadsheets is what this platform replaces.

**Independent Test**: Record a membership payment and confirm status becomes "current"; advance the clock past expiry and the configured lapse cycles and confirm the status transitions correctly without manual intervention.

**Acceptance Scenarios**:

1. **Given** a contact with no membership, **When** queried, **Then** status is "never" and they are excluded from the members list.
2. **Given** a member whose most recent expiry is in the future, **When** queried, **Then** status is "current".
3. **Given** a member lapsed within the configured number of lapse cycles, **When** queried, **Then** status is "lapsed" and they remain on the members list.
4. **Given** a member lapsed beyond the configured lapse cycles, **When** queried, **Then** status is "long_lapsed".

---

### User Story 3 - Review and merge duplicate contacts (Priority: P2)

An administrator works a review queue of suspected duplicate contacts surfaced by fuzzy name matching, confirming merges so related records consolidate under one canonical contact.

**Why this priority**: A 1,300-record directory accumulated from multiple sources will contain duplicates that corrupt counts and email lists, but merging is destructive so it must be human-confirmed.

**Independent Test**: Seed two similar contacts, confirm they appear as a suggested pair in the review queue, approve the merge, and verify all related records now point to the surviving contact.

**Acceptance Scenarios**:

1. **Given** two contacts with similar names, **When** the dedup process runs, **Then** they appear as a suggested merge in the admin queue.
2. **Given** a suggested pair, **When** the admin confirms the merge, **Then** one canonical identifier survives and all related records are re-linked to it.
3. **Given** a suggested pair, **When** no admin confirms, **Then** no merge occurs (no automatic merges).

### Edge Cases

- Two emails differing only by case or surrounding whitespace are treated as the same address.
- An email may carry multiple purposes at once (e.g., personal + booking); the purpose set must be non-empty.
- If more than one address carries the `public-profile` purpose, Phase 1 has no primary-email designation to disambiguate which is shown publicly — any public-profile address is treated as displayable; a primary designation is deferred.
- A contact may have zero login-enabled emails; in Phase 1 only volunteer/admin contacts have a login email.
- A merge must not silently discard the non-canonical contact's emails or marketing-consent flags.
- Read-only delivery-provider metadata on an email must never be edited by users.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST store a Contact for everyone the club communicates with, identified by a stable unique identifier.
- **FR-002**: System MUST allow a Contact to have one-to-many email addresses, each with a status (active / transition / inactive) and one or more purposes (personal / booking / public-profile / other) — a single address MAY carry multiple purposes simultaneously.
- **FR-002a**: When adding a new person, the system MUST default the email purpose to "personal" (the admin may change or add purposes before saving).
- **FR-003**: System MUST enforce that an email address is unique across all active and transition records globally.
- **FR-004**: System MUST record, per email address, a non-exclusive set of consent topics (the kinds of messages that address opts into): contra, English, open band, special events, Jane Austen Ball, contact tracing, and the overriding "Do Not Contact". The set defaults to contact tracing. "Do Not Contact", when present, MUST override all other topics so the address is never emailed. (These topics reconcile with feature 006's mailing lists; the "member" and "performer" lists there are derived audiences, not opt-in topics.)
- **FR-004a**: System MUST treat "Do Not Contact" as exclusive at send/export time regardless of any other topics stored on that address.
- **FR-005**: System MUST flag whether an email is a login credential; in Phase 1 only contacts marked as volunteers (in practice, administrators) may have a login email.
- **FR-005a**: System MUST allow a Contact to be marked a volunteer and to hold a non-exclusive set of volunteer roles (at minimum door attendant and administrator; the set expands in later features). Roles may only be assigned to volunteers.
- **FR-006**: System MUST store read-only delivery-provider metadata (set date, last-open, last-click) per email and prevent user edits to it.
- **FR-007**: System MUST classify each Contact's membership status as current, lapsed, long_lapsed, or never per the defined rules.
- **FR-008**: System MUST treat a club-configurable "long lapse cycles" threshold (default 3) as the boundary between lapsed and long_lapsed.
- **FR-009**: System MUST keep membership status accurate after any membership change and refresh it at least once daily.
- **FR-010**: System MUST surface suspected duplicate contacts in an admin review queue using fuzzy name matching.
- **FR-011**: System MUST require explicit admin confirmation for every merge and MUST NOT merge automatically.
- **FR-012**: On merge, system MUST select one canonical identifier and re-link all related records to it.
- **FR-013**: System MUST log an auditable record of every contact merge and membership-status change (who/what/when), per the observability principle.

### Key Entities *(include if feature involves data)*

- **Contact**: A person or organization the club communicates with; holds a stable unique identifier, materialized membership status, an is-volunteer flag, and a set of volunteer roles.
- **ContactEmail**: An email address belonging to a Contact, with one or more purposes (personal / booking / public-profile / other), a status, a non-exclusive set of consent topics (default contact tracing; "Do Not Contact" overrides all), a login flag, and read-only provider metadata.
- **Volunteer Role**: A capability assigned to a volunteer Contact (e.g., door attendant, administrator); the set grows as later features add specialized roles.
- **Member**: A Contact who has paid dues, linked to a Payer.
- **Membership**: A dues record with an expiry date that drives membership status.
- **Payer**: The party responsible for a member's dues.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of contacts return a membership status with no manual recalculation required.
- **SC-002**: Membership status reflects a recorded payment within one business day with no manual step.
- **SC-003**: Duplicate-email entry is prevented in 100% of attempts across active/transition records.
- **SC-004**: Every merge is reversible-by-audit: an administrator can see, after the fact, which contacts were combined and when.
- **SC-005**: The directory supports at least 1,300 contacts and 152 active members without performance degradation in everyday admin tasks.

## Assumptions

- No primary-email designation exists in Phase 1 (deferred).
- Non-volunteer self-service login and profile editing are out of scope for Phase 1.
- Fuzzy-matching approach is an implementation choice; the requirement is ranked suggestions, not a specific algorithm.
- The platform is multi-tenant; "long lapse cycles" and similar thresholds are per-club configuration.
