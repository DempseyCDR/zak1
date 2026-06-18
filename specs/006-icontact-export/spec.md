# Feature Specification: Email List Export (iContact)

**Feature Branch**: `006-icontact-export`

**Created**: 2026-06-18

**Status**: Draft

**Input**: Derived from CDR_Project_Context_v1.2.md — iContact List Flags (7 lists), CSV export strategy, membership_status segmentation, tracing_event/memberthrough computed at export.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Export segmented email lists (Priority: P1)

An administrator exports up-to-date CSV files — one per mailing list — containing the contacts who have consented and qualify for that list, ready to upload to the email delivery provider.

**Why this priority**: The platform is the system of record for who should receive which mailings; the delivery provider only sends. Without correct exports, the club cannot communicate.

**Independent Test**: Trigger an export and confirm seven CSV files are produced with the correct filenames, each containing only consented, qualifying contacts for that list.

**Acceptance Scenarios**:

1. **Given** the seven configured lists, **When** the admin runs an export, **Then** seven CSV files are produced named contra.csv, english.csv, openband.csv, specialevents.csv, janeaustenball.csv, performer.csv, and member.csv.
2. **Given** a contact without marketing consent on an email, **When** lists are exported, **Then** that email is excluded.
3. **Given** the member list, **When** member.csv is produced, **Then** it includes a membership_status column for segmentation.
4. **Given** the Jane Austen Ball list, **When** exported, **Then** it reflects the year of the most recent JAB.

---

### User Story 2 - Compute export-time-only fields (Priority: P2)

The system computes certain fields only at export time (not stored), such as a contact-tracing indicator for tracing mailings and a membership "through" year derived from membership expiry.

**Why this priority**: These values must always reflect current data and should not drift as stored copies; they exist solely to support specific mailings.

**Independent Test**: Run a tracing export and a member export and confirm the tracing indicator and "through" year are present in output but never persisted.

**Acceptance Scenarios**:

1. **Given** a contact-tracing mailing, **When** exported, **Then** the tracing indicator is computed at export and not stored.
2. **Given** the member export, **When** produced, **Then** the membership "through" year is derived from expiry at export time and not stored.

### Edge Cases

- A contact with multiple consented emails of differing types must export according to per-email consent, not a single contact-level flag.
- The delivery provider does not accept a list ID in the upload; the filename conveys the target list, so filenames must match exactly.
- Inactive or transition emails must be excluded from active mailings.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST export one CSV per mailing list for the seven lists, with exact filenames matching the list IDs (contra, english, openband, specialevents, janeaustenball, performer, member) + ".csv".
- **FR-002**: System MUST include only emails with marketing consent for that list/contact.
- **FR-003**: System MUST exclude inactive and transition emails from active mailing exports.
- **FR-004**: System MUST include a membership_status column in member.csv for segmentation.
- **FR-005**: System MUST scope the Jane Austen Ball list to the year of the most recent JAB.
- **FR-006**: System MUST compute the contact-tracing indicator only at export time for tracing mailings and MUST NOT store it.
- **FR-007**: System MUST derive the membership "through" year from membership expiry at export time and MUST NOT store it.
- **FR-008**: System MUST treat the platform as the system of record and the delivery provider as a delivery mechanism only (no API sync in Phase 1).
- **FR-009**: System MUST log auditable export runs (who/when/list counts).

### Key Entities *(include if feature involves data)*

- **Mailing List**: One of seven configured lists with an ID that determines its CSV filename and membership rules.
- **Export Run**: A generated set of CSVs at a point in time, with computed-only fields applied.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of exported rows correspond to contacts with valid consent for that list.
- **SC-002**: All seven files are named exactly as required so the delivery provider routes them correctly.
- **SC-003**: Computed-only fields (tracing indicator, membership "through" year) never appear in stored data.
- **SC-004**: member.csv segmentation by membership_status matches the membership classification in the Contacts feature in 100% of cases.

## Assumptions

- Delivery-provider API sync is deferred to a future phase; CSV export/upload is the Phase 1 mechanism.
- Marketing consent is captured per email in the Contacts & Membership feature.
- Automated sending from the platform is out of scope.
