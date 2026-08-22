# Feature Specification: Contact Load — replace contacts from iContact + membership import

**Feature Branch**: `contact_load`

**Created**: 2026-08-20

**Status**: Draft

**Input**: User description: "Replace the contact database with real data from two operator-supplied files (an iContact CSV export and a CDR membership ODS workbook). Retain only contacts that hold a role; hard-reset the rest. Import email consent permissions, memberships (with level), volunteer flags, and propose performer↔contact links for confirmation. Operator-only, dry-run-first, single transaction, audit summary."

## Overview

The club is moving from spreadsheets and an email-marketing provider (iContact) to this platform as the system of record for people. This feature performs a **one-time, repeatable bulk load**: it takes two operator-supplied files, discards the current dancer/contact population (keeping only people who hold an assigned role), and rebuilds the contact roster — names, pronouns, phones, email addresses, email consent permissions, memberships, and volunteer eligibility — from the two files. It then proposes links between existing performers and the newly loaded contacts for a human to confirm.

Because the load is destructive, it runs as an operator-only tool with a mandatory preview (dry-run), a database backup, all-or-nothing execution, and a printed audit of exactly what changed.

## Clarifications

### Session 2026-08-20

- Q: Retention boundary — must the load also protect contacts that are sign-in-eligible / have an active session but hold no explicit role grant? → A: No — retain **only** contacts with an explicit role grant; sign-in eligibility or a live session alone does not protect a contact.
- Q: When two iContact rows carry different email addresses, how is "same person" decided so they merge into one contact? → A: Collapse rows that share the existing normalized-name dedup key into one contact with multiple emails.
- Q: How is a payer record linked to a contact? → A: Link to the member who owns the payer — the Member-sheet person identified as the paying member of that payer group; leave the link empty when no such member is identifiable. The paying member is the member whose `dedup_normalized` matches the Payer sheet `Payer Name`; empty on no/multiple match.
- Q: The hard-reset delete would hit RESTRICT foreign keys on `contacts` — how should it avoid failing? → A: Before deleting, NULL the nullable RESTRICT references (`audit_events.actor_contact_id`, `role_grants.granted_by`) for deletion targets; retain contacts referenced by the non-nullable `merge_audit.canonical_id`/`merged_id`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Rebuild the contact roster from the two files, keeping role-holders (Priority: P1)

An operator has two files: an iContact export (mailing subscribers, keyed by email) and a membership workbook whose Member sheet is a structured roster of members (names, pronouns, phones, emails, volunteer flag, payer link). The operator runs the load. Every current contact who does **not** hold an assigned role is removed, and the roster is rebuilt as the union of the two files, matched by email. Where a person appears in both files, the workbook's Member sheet is authoritative for name, pronouns, and phone; the iContact file contributes email addresses and their consent permissions.

**Why this priority**: This is the core migration. Without it the platform cannot become the system of record for people; everything else (permissions, memberships, performer links) hangs off the rebuilt roster.

**Independent Test**: With a seeded database containing a mix of role-holders and ordinary contacts, run the load against representative files and confirm: role-holders survive unchanged, all other prior contacts are gone, and every person in the union of the two files exists exactly once with the correct name/pronouns/phone precedence.

**Acceptance Scenarios**:

1. **Given** a contact who holds an assigned role, **When** the load runs, **Then** that contact is retained and is not duplicated even if the same person also appears in the input files (they are updated in place, matched by email).
2. **Given** a contact who holds no assigned role, **When** the load runs, **Then** that contact is removed and re-created only if they appear in the input files.
3. **Given** a person present in both the iContact file and the Member sheet, **When** the load runs, **Then** their name, pronouns, and phone come from the Member sheet and their email addresses and consent come from iContact.
4. **Given** a person present only in the iContact file (a subscriber who is not a member), **When** the load runs, **Then** they are created as a contact with their email(s) and consent but no membership.
5. **Given** a member present only in the Member sheet (not in iContact), **When** the load runs, **Then** they are created as a contact from the Member sheet, with an email carrying default consent when the sheet provides one, and with no email when the sheet provides none.
6. **Given** the same person appears on multiple iContact rows under different email addresses, **When** the load runs, **Then** they become a single contact with multiple email addresses.

---

### User Story 2 - Import email consent permissions accurately (Priority: P1)

The operator needs each loaded email address to carry the correct mailing permissions so that later list exports send only to people who consented. iContact per-list flags translate into consent topics, and every loaded email is additionally marked as consenting to contact-tracing outreach.

**Why this priority**: The platform is the system of record for who may be emailed on which list; wrong permissions mean either failing to reach people or contacting people who opted out. This must be right at load time, alongside US1.

**Independent Test**: Load a set of iContact rows with varied list flags and confirm each resulting email's consent topics exactly match the flagged lists plus contact-tracing, and that non-flagged lists are absent.

**Acceptance Scenarios**:

1. **Given** an iContact row flagged as subscribed to a list (value `1`), **When** the email is loaded, **Then** that list's consent topic is present on the email.
2. **Given** an iContact list column that is blank **or** contains `-1`, **When** the email is loaded, **Then** that list's consent topic is absent (blank and `-1` are treated identically — not subscribed).
3. **Given** the Jane Austen Ball column containing a year value, **When** the email is loaded, **Then** the Jane Austen Ball consent topic is present.
4. **Given** any email loaded from this import, **When** it is created, **Then** it carries the contact-tracing consent topic unconditionally, regardless of list flags.
5. **Given** iContact engagement/subscription dates on a row, **When** the email is loaded, **Then** the provider subscribe date, last-open, and last-click values are recorded on the email.

---

### User Story 3 - Import memberships with membership level (Priority: P2)

The operator needs current membership status to reflect the workbook. Each payer in the workbook's Payer sheet becomes a payer record; each member linked to a payer gets a membership carrying the payer's expiry date and the membership level (individual, family, supporter, or student). Membership status on each contact is then recomputed.

**Why this priority**: Membership drives the member mailing list and door/desk behavior. It depends on the roster existing (US1) but is a distinct, separately testable slice.

**Independent Test**: Load a workbook with payers at each level and expiry dates spanning past and future, then confirm each member's membership row carries the correct payer, expiry, and level, and that recomputed membership status matches the expiry.

**Acceptance Scenarios**:

1. **Given** a payer with an expiry date and a level, **When** the load runs, **Then** each member linked to that payer has a membership with that expiry date and level.
2. **Given** a family payer covering several members, **When** the load runs, **Then** every covered member receives a membership referencing the shared payer and its expiry.
3. **Given** memberships loaded with a range of expiry dates, **When** the load completes, **Then** each contact's membership status is recomputed from expiry (current / lapsed / long-lapsed).
4. **Given** the Amount and Method columns in the Payer sheet, **When** the load runs, **Then** they are ignored (only level is retained).

---

### User Story 4 - Propose performer ↔ contact links for confirmation (Priority: P3)

After the roster is rebuilt, existing performers have lost their contact link (the old contact was removed). The operator is presented with proposed links between each performer and a loaded contact. High-confidence exact matches are pre-selected; ambiguous ones are surfaced for a human to confirm or reject. No link is applied without confirmation except unambiguous exact matches.

**Why this priority**: Performer↔contact linkage supports booking and payment workflows, but the club can operate briefly with performers unlinked; this is valuable cleanup rather than a migration blocker.

**Independent Test**: With performers whose names/emails variously match zero, one, or several loaded contacts, run the matching step and confirm exact single matches are proposed as auto-links while zero/multiple matches are surfaced for manual resolution.

**Acceptance Scenarios**:

1. **Given** a performer whose email or normalized name matches exactly one loaded contact, **When** matching runs, **Then** that link is proposed as a high-confidence auto-link.
2. **Given** a performer matching several loaded contacts (e.g. a common name), **When** matching runs, **Then** the performer is surfaced for manual resolution rather than auto-linked.
3. **Given** a performer matching no loaded contact, **When** matching runs, **Then** the performer is left unlinked and reported.

---

### User Story 5 - Safe, previewable, all-or-nothing execution (Priority: P1)

Because the load deletes data, the operator must be able to preview exactly what will change before committing, the database must be backed up first, and the whole operation must succeed or fail as a unit, ending with a printed summary of counts.

**Why this priority**: A destructive bulk operation without a preview, backup, and atomicity is unacceptable; a partial load would corrupt the system of record.

**Independent Test**: Run the tool in preview mode and confirm it reports intended counts and writes nothing; run it for real against a backed-up database and confirm either a full successful load or, on any error, zero changes.

**Acceptance Scenarios**:

1. **Given** preview mode, **When** the tool runs, **Then** it reports the counts it would change (retained, removed, created, emails, memberships, volunteers set, performer links proposed) and makes no changes to stored data.
2. **Given** a real run, **When** any step fails, **Then** no partial changes remain — the roster is exactly as it was before the run.
3. **Given** a real run, **When** it starts, **Then** a database backup is produced before any change is made.
4. **Given** a completed real run, **When** it finishes, **Then** it prints an audit summary of all counts changed.

### Edge Cases

- **Nameless iContact row**: an iContact row with no first/last name is loaded with a name derived from the email address and flagged for human review.
- **Combined record** (e.g. a single row named "Hilary & Ed"): loaded as one contact and flagged for human review rather than split automatically.
- **Member with no email**: loaded as a contact with no email address; such a contact cannot receive mailings and cannot sign in even if marked volunteer.
- **Mixed date formats**: the subscribe date and the open/click dates use different formats; both are parsed correctly.
- **Comma-in-year artifact**: a year value such as `2,022` is interpreted as `2022`.
- **Volunteer marked but no usable email**: the volunteer flag is set, but with no email the person still cannot sign in; this is expected, not an error.
- **Person in both files with conflicting phone/name**: the Member sheet wins; the iContact value is not applied.
- **Retained role-holder also in the files**: updated in place (email/consent/pronouns refreshed), never duplicated.
- **Sign-in-eligible contact with no role grant**: removed like any other non-role contact; its login identity and any active session are removed with it and re-provision only if it is re-created from the input files with sign-in eligibility.
- **Non-role contact referenced by history**: a deleted contact's audit-event authorship (`audit_events.actor_contact_id`) and role-grant provenance (`role_grants.granted_by`) are cleared to null before the delete (attribution anonymized, consistent with attendance/door SET NULL); a contact that was party to a prior merge is retained instead, because its `merge_audit` references are NOT NULL and cannot be cleared.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST retain every current contact who holds an assigned role and MUST remove every current contact who does not. A contact "holds an assigned role" **only** when it has an explicit role grant (see FR-018), or when it is a party to a prior merge and thus protected from deletion by FR-021.
- **FR-002**: The system MUST rebuild the contact roster as the union of the iContact file and the workbook Member sheet, matched by email address (case-insensitive).
- **FR-003**: For a person present in both files, the system MUST take name, pronouns, and phone from the Member sheet, and email addresses and consent from the iContact file.
- **FR-004**: The system MUST create a single contact with multiple email addresses when one person appears on multiple iContact rows under different emails; rows are recognized as the same person when they share the normalized-name dedup key.
- **FR-005**: The system MUST translate iContact per-list flags into email consent topics, treating value `1` as subscribed and treating blank and `-1` identically as not subscribed.
- **FR-006**: The system MUST treat a year value in the Jane Austen Ball column as subscription to the Jane Austen Ball topic.
- **FR-007**: The system MUST add the contact-tracing consent topic to every email loaded from this import, unconditionally.
- **FR-008**: The system MUST record the provider subscribe date, last-open date, and last-click date on each loaded email when present.
- **FR-009**: The system MUST create a payer record for each Payer-sheet payer and a membership for each member linked to a payer, carrying the payer's expiry date and membership level (individual, family, supporter, student), and MUST ignore the Amount and Method columns.
- **FR-010**: The system MUST recompute each affected contact's membership status after loading memberships.
- **FR-011**: The system MUST set volunteer eligibility for members whose Member-sheet volunteer flag is affirmative.
- **FR-012**: The system MUST propose performer↔contact links after the roster is rebuilt, auto-linking only unambiguous exact email or normalized-name matches and surfacing ambiguous or absent matches for human confirmation.
- **FR-013**: The system MUST provide a preview mode that reports intended change counts without writing any changes.
- **FR-014**: The system MUST produce a database backup before making any change in a real run.
- **FR-015**: The system MUST execute the load atomically: on any failure, no changes persist.
- **FR-016**: The system MUST print an audit summary of counts changed on completion (retained, removed, created contacts, emails, memberships, volunteers set, performer links proposed/auto-linked/unresolved).
- **FR-017**: The system MUST be operable only by an authorized operator and MUST NOT be exposed through the public or general staff interface.
- **FR-018**: The retention boundary of FR-001 is **explicit role grants only**. A contact that is sign-in-eligible or holds an active session but has no explicit role grant MUST be removed like any other non-role contact; the accepted consequence is that its login identity and any active session are removed with it (re-provisioned only if the person is re-created from the input files with sign-in eligibility).
- **FR-019**: The system MUST flag for human review any contact loaded from an ambiguous source row (nameless row, or a combined multi-person row).
- **FR-020**: The system MUST link each payer record to the contact that is its paying member — the Member-sheet person whose `dedup_normalized` matches the Payer sheet `Payer Name` — and MUST leave the payer's contact link empty when no member, or more than one, matches.
- **FR-021**: The delete MUST NOT fail on a non-cascading (RESTRICT) foreign key referencing `contacts`. Before deleting non-retained contacts, the system MUST set to null the **nullable** RESTRICT references that would block the delete — `audit_events.actor_contact_id` and `role_grants.granted_by` — for every deletion-target contact. Contacts referenced by the **non-nullable** `merge_audit.canonical_id`/`merged_id` cannot be nulled and MUST instead be added to the retained set, preserving merge history.

### Key Entities *(include if data involves data)*

- **Contact**: a person. Carries structured name, optional pronouns, optional phone, membership status, volunteer eligibility, and a review flag. Retained when role-bearing; otherwise rebuilt from the files.
- **Contact Email**: an email address belonging to a contact, carrying consent topics (which lists the address may be mailed on), an active/inactive status, and provider engagement dates.
- **Role Grant**: an assigned role held by a contact; its presence is what protects a contact from removal.
- **Payer**: the party who paid for one or more memberships; carries a name and a link to the contact who is its paying member (empty when that member is not identifiable).
- **Membership**: a contact's membership term, carrying an expiry date, membership level, and the payer that funded it.
- **Performer**: an existing act/person who can be booked; may be linked to a contact. Links are re-proposed after the roster rebuild.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After a load, 100% of contacts that held an assigned role before the load still exist afterward with their roles intact.
- **SC-002**: After a load, every person present in the two input files exists as exactly one contact (no duplicates, no omissions from the union).
- **SC-003**: For a sample of loaded emails, 100% carry consent topics that exactly match their iContact list flags plus contact-tracing.
- **SC-004**: After a load, every member linked to a payer has a membership whose expiry and level match the workbook, and their membership status matches that expiry.
- **SC-005**: The operator can preview a load and see accurate change counts without any data being modified.
- **SC-006**: A failed load leaves the database identical to its pre-load state (verifiable by comparison), and every real load is preceded by a recoverable backup.
- **SC-007**: Performer link proposals distinguish exact single matches from ambiguous/absent matches, so no wrong link is applied automatically.

## Assumptions

- The two files are supplied by the operator on the machine running the tool and contain real personal data; they are kept out of version control.
- The load is a one-time migration in practice but is **re-runnable**: each run is a full replace (retain role-holders, rebuild the rest), so re-running with corrected files is safe.
- The iContact file is keyed by email; the Member sheet is the authoritative structured roster; the Payer sheet is the authoritative membership/expiry source. The Button Report and iContact Report sheets are derived views and are not loaded.
- "Membership level" is a new attribute with values individual, family, supporter, and student (the values observed in the source workbook).
- Setting volunteer eligibility does not by itself grant access: sign-in still requires the person to authenticate with an email that matches an active address, so members with no email are inert even when flagged volunteer.
- Amount and Method of membership payments are out of scope for this load.
- Historical records that referenced a removed non-role contact (attendance, door, payer, membership-capture links) are retained but become disassociated from the removed person; this anonymization is accepted.

## Dependencies

- Existing contact, email-consent, role-grant, payer, membership, and performer data models.
- Existing membership-status recomputation and name-normalization/dedup behavior.
- An operator-only execution path consistent with the project's existing operator tooling.
