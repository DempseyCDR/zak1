# Feature Specification: Email List Export (iContact)

**Feature Branch**: `006-icontact-export`

**Created**: 2026-06-18

**Status**: Draft

**Input**: Derived from CDR_Project_Context_v1.2.md — iContact List Flags (7 lists), CSV export strategy, membership_status segmentation, tracing_event/memberthrough computed at export.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Export segmented email lists, one list at a time (Priority: P1)

An administrator exports an up-to-date CSV for a single mailing list, containing the contacts who have consented and qualify for that list, ready to upload to the email delivery provider. Each of the seven lists is requested independently rather than all-at-once, since lists change and get used on different schedules — some (e.g. weekly dance announcements) update far more often than others (e.g. the Jane Austen Ball list, used once a year).

**Why this priority**: The platform is the system of record for who should receive which mailings; the delivery provider only sends. Without correct exports, the club cannot communicate.

**Independent Test**: Select and download a single list; confirm its CSV is produced with the correct filename, containing only consented, qualifying contacts for that list, without needing to regenerate any of the other six.

**Acceptance Scenarios**:

1. **Given** the seven configured lists, **When** the admin downloads one of them, **Then** that single CSV file is produced named exactly `<list>.csv` (e.g. contra.csv) containing only consented, qualifying contacts for that list; the other six lists are unaffected.
2. **Given** a contact without marketing consent on an email, **When** a list is exported, **Then** that email is excluded.
3. **Given** the member list, **When** member.csv is produced, **Then** it includes a membership_status column for segmentation.
4. **Given** the Jane Austen Ball list, **When** exported, **Then** it reflects the year of the most recent JAB.

---

### User Story 2 - Compute the membership "through" year at export time (Priority: P2)

The system computes the membership "through" year only at export time (not stored), derived from membership expiry.

**Why this priority**: This value must always reflect current data and should not drift as a stored copy; it exists solely to support the member mailing.

**Independent Test**: Run a member export and confirm the "through" year is present in output but never persisted.

**Acceptance Scenarios**:

1. **Given** the member export, **When** produced, **Then** the membership "through" year is derived from expiry at export time and not stored.

---

### User Story 3 - Generate a contact-tracing export for a specific dance (Priority: P2)

An administrator, needing to notify attendees of a specific dance about a possible exposure, selects that event's date from a dropdown and downloads a CSV of everyone recorded present who has a qualifying, active email consenting to contact-tracing outreach.

**Why this priority**: This is ad hoc and event-scoped rather than one of the seven standing mailing lists, but is a distinct, time-sensitive safety capability the platform must support as the system of record for attendance (feature 002).

**Independent Test**: For an event with recorded attendance, select it from the dropdown and confirm the downloaded CSV contains exactly the attendees with a qualifying contact-tracing-consented email, each row carrying that event's date.

**Acceptance Scenarios**:

1. **Given** an event with recorded attendees, **When** the admin selects it and exports, **Then** the CSV contains one row per attendee who has an active email carrying the `contact_tracing` consent topic.
2. **Given** an attendee whose only email carries "Do Not Contact", **When** exported, **Then** that attendee is excluded.
3. **Given** the export, **When** produced, **Then** every row includes a `date` column equal to the selected event's date.
4. **Given** an event whose attendance has been purged (90 days past the event, per feature 002's retention rule), **When** the admin views the event dropdown, **Then** that event is not offered for selection.
5. **Given** a selectable (not-purged) event with zero recorded attendees, **When** the admin selects it and requests the export, **Then** no CSV is produced and a message shows the attendee count (0).

### Edge Cases

- A contact with multiple emails carrying differing consent topics must export per-email, not via a single contact-level flag.
- The delivery provider does not accept a list ID in the upload; the filename conveys the target list, so filenames must match exactly.
- Inactive or transition emails must be excluded from active mailings.
- Events whose attendance has been purged (90+ days past the event) are excluded from the event dropdown entirely — they are never selectable, so this case never reaches the export step.
- A selectable event with zero recorded attendees does not produce a CSV; the admin sees a message with the attendee count instead.
- An attendee with no email on file (email is optional per feature 001) cannot appear in the contact-tracing export regardless of attendance.

## Clarifications

### Session 2026-07-02

- Q: How should an admin actually receive the seven generated CSV files? → A: Admin UI page lists the 7 lists with a download link/button per file, generated on-demand per request.
- Q: Should export generation be triggered only on-demand by an admin, or also run on a schedule? → A: On-demand only — no scheduled/automatic regeneration in Phase 1.
- Q: Should the FR-009 audit trail (who/when/list counts) be a queryable database table, or just a structured log entry? → A: Persist a queryable DB table (who, when, list, row count) that can back an admin-visible export history.
- Q: Beyond list-specific columns (membership_status, tracing indicator, "through" year), what common columns should every CSV row carry? → A: email + first name + last name, with first/last name derived by heuristically splitting the contact's `displayName` at export time (no schema change to the Contacts feature's single-name model).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST export one CSV per mailing list for the seven lists, with exact filenames matching the list IDs (contra, english, openband, specialevents, janeaustenball, performer, member) + ".csv".
- **FR-001a**: System MUST treat the five content lists (contra, english, openband, specialevents, janeaustenball) as **opt-in topics** — an email is included only if it carries the matching consent topic (per feature 001's `email_consent_topic`). The "member" and "performer" lists are **derived audiences** computed from membership status (feature 001) and performer role (feature 003), not opt-in topics.
- **FR-002**: System MUST include only emails whose consent permits that list: the matching opt-in topic for content lists, and membership/performer-role qualification for the derived lists.
- **FR-002a**: System MUST exclude any email carrying the "Do Not Contact" consent topic from every export, including the derived member and performer lists and the contact-tracing export.
- **FR-003**: System MUST exclude inactive and transition emails from active mailing exports.
- **FR-004**: System MUST include a membership_status column in member.csv for segmentation.
- **FR-005**: System MUST scope the Jane Austen Ball list to the year of the most recent JAB.
- **FR-006**: System MUST provide a separate, event-scoped contact-tracing export, distinct from the seven fixed mailing lists in FR-001: the admin selects one event (by date) from a dropdown, and the system generates a CSV of that event's recorded attendees (feature 002) who have an active email carrying the `contact_tracing` consent topic, computed at request time and MUST NOT store the generated rows.
- **FR-006a**: Each contact-tracing export row MUST include a `date` column set to the selected event's date.
- **FR-006b**: The event dropdown MUST exclude events whose attendance has been purged (feature 002's 90-day retention rule) — such events MUST NOT be offered for selection.
- **FR-006c**: When the selected event has zero recorded attendees, the system MUST NOT generate a CSV and MUST instead present the attendee count (0) to the admin.
- **FR-007**: System MUST derive the membership "through" year from membership expiry at export time and MUST NOT store it.
- **FR-008**: System MUST treat the platform as the system of record and the delivery provider as a delivery mechanism only (no API sync in Phase 1).
- **FR-009**: System MUST persist auditable export runs (who, when, which list or event, row count) in a queryable record, not only a structured log entry.
- **FR-010**: System MUST provide an admin UI page listing the seven mailing lists (each with a per-list, on-demand download link/button) plus a separate contact-tracing section with an event dropdown and download action.
- **FR-011**: Every row of the seven fixed mailing lists MUST include email, first name, and last name. First/last name MUST be derived at export time by splitting the contact's `displayName` on the last whitespace boundary (remainder = first name, final token = last name); this is a heuristic, not a stored field, and is not guaranteed correct for suffixes or multi-word surnames. The contact-tracing export (FR-006) uses the same email/first-name/last-name derivation, plus its own `date` column (FR-006a).

### Key Entities *(include if feature involves data)*

- **Mailing List**: One of seven configured lists with an ID that determines its CSV filename and membership rules. Two kinds: **opt-in topic lists** (contra, english, openband, specialevents, janeaustenball) driven by per-email consent topics, and **derived-audience lists** (member, performer) computed from membership status / performer role. All lists are suppressed by "Do Not Contact".
- **Contact Tracing Export**: A separate, ad hoc, event-scoped export — not one of the seven fixed mailing lists — of one event's recorded attendees (feature 002) who have a qualifying, active, contact-tracing-consented email. Parameterized by the admin-selected event; every row carries that event's date.
- **Export Run**: A persisted record of one CSV generation — who triggered it, when, which list (or, for contact tracing, which event), and the row count — plus, transiently, the generated CSV with computed-only fields applied (not stored).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of exported rows correspond to contacts with valid consent for that list.
- **SC-002**: All seven files are named exactly as required so the delivery provider routes them correctly.
- **SC-003**: Computed-only fields (contact-tracing export rows, membership "through" year) never appear in stored data.
- **SC-004**: member.csv segmentation by membership_status matches the membership classification in the Contacts feature in 100% of cases.
- **SC-005**: The contact-tracing export for a given event contains exactly the attendees of that event with a qualifying, active, contact-tracing-consented email — no false inclusions or exclusions.

## Assumptions

- Delivery-provider API sync is deferred to a future phase; CSV export/upload is the Phase 1 mechanism.
- Marketing consent is captured per email in the Contacts & Membership feature.
- Automated sending from the platform is out of scope.
- Export generation is on-demand only (admin-triggered); no scheduled/automatic regeneration in Phase 1.
- Incremental export (addresses changed since a list's last export) is deferred — see BACKLOG.md B17. Phase 1 always exports the full qualifying set for the selected list.
