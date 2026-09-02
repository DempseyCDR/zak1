# Feature Specification: Contact Email Editor

**Feature Branch**: `066-contact-email-editor`

**Created**: 2026-09-02

**Status**: Draft

**Input**: User description: "M-R13, M-R14, M-R15, M-R16, M-R17"

## Overview

The contact record editor (feature 063) lets Mel maintain a contact's scalar fields, but a contact's
**emails** — the things a mailing list actually sends to — are not yet editable there. This feature adds
a **per-contact email list** below the scalar fields: each email is an editable row (address, purposes,
consent topics, status), with the consent/uniqueness/login rules that today live deep in the service
made **visible** in the control itself, an Active/Inactive toggle, add/remove, and a read-only glance at
delivery telemetry.

Most of the enforcement already exists (the service collapses `do_not_contact`, requires at least one
purpose and topic, allows a login email only on a volunteer, and rejects a cross-contact active-email
collision). This feature surfaces those rules where Mel can see them, and adds two new behaviors: a
**hard delete** of an email row (beyond the soft "set inactive"), and turning a duplicate-address
collision into a **"review as duplicate"** path instead of a raw error.

Editing emails is gated by `contact.mailing.write` (which the mailing-list manager holds globally). Reads
of email addresses remain PII-gated (feature 016).

## Clarifications

### Session 2026-09-02

- Q: Which capability gates the email hard-delete? → A: **Fold it under the existing
  `contact.delete.unrestricted`** (super-user only) — no new `contact.email.delete` capability. The
  super-user's unrestricted-erasure authority covers permanently deleting an email row.
- Q: Is the provider telemetry (M-R16) in scope now or deferred? → A: **In scope now** — a minimal,
  read-only compact hint per row (last opened/clicked, dead-address hint); the treatment is revisited
  after it is seen on the mobile layout.
- Q: How is a login email's address-change / deactivation guarded? → A: A **confirmation step** for both
  — Mel may proceed after an explicit "this is a staff sign-in email — proceed?" confirmation (not an
  outright block).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See and edit a contact's emails (Priority: P1)

Mel opens a contact and, below the name/phone fields, sees each of the contact's emails as its own row —
the address, its purposes, its consent topics, and its status. She corrects an address, changes which
purposes or topics apply, and saves; the changes persist.

**Why this priority**: This is the core of the feature — a contact's emails are the mailing list's
payload, and Mel currently has no way to maintain them from the record.

**Independent Test**: open a contact with two emails; confirm both render as editable rows with their
address, purposes, topics, and status; edit an address and topics and confirm the change persists.

**Acceptance Scenarios**:

1. **Given** a contact with one or more emails, **When** Mel opens the record, **Then** each email
   appears as its own row showing address, purposes, consent topics, and status.
2. **Given** an editable email row, **When** Mel changes the address, purposes, or consent topics and
   saves, **Then** the change persists on that email.
3. **Given** a viewer who holds mailing-write authority, **When** they edit an email, **Then** the save
   succeeds; a viewer without it cannot edit emails (enforced server-side).

---

### User Story 2 - Consent and purpose rules are visible in the control (Priority: P1)

The rules that keep consent coherent are shown in the control, not discovered on a failed save.
Selecting **do not contact** visibly clears/greys the other topics (it is exclusive). The control never
lets Mel end up with zero purposes or zero topics — it prevents the empty state rather than erroring.

**Why this priority**: These rules are the difference between a mailing list Mel trusts and one that
silently drops consent; making them visible is the whole point of surfacing the emails.

**Independent Test**: select "do not contact" and confirm the other topics clear/grey; attempt to remove
the last purpose or last topic and confirm the control prevents it.

**Acceptance Scenarios**:

1. **Given** an email row, **When** Mel selects **do not contact**, **Then** the other consent topics are
   cleared/greyed (do-not-contact is exclusive), never silently retained.
2. **Given** an email with one purpose, **When** Mel tries to remove it, **Then** the control prevents
   reaching zero purposes; likewise for consent topics.
3. **Given** the visible rules, **When** Mel saves a valid row, **Then** the saved purposes/topics match
   what the control showed (no silent collapse surprises).

---

### User Story 3 - Status, add, and remove (Priority: P1)

Each email has a status Mel can set with an **Active / Inactive** toggle. She can add a new email to the
contact, and "remove" an email by setting it inactive (soft — it keeps its history and drops out of
lists). A row that is in the system-managed **transition** state shows read-only (not on the toggle). A
**hard delete** that erases the row is reserved for the super-user.

**Why this priority**: Adding and retiring emails is everyday maintenance; the soft-remove keeps history
while the hard delete is the rare, privileged erasure.

**Independent Test**: add an email; toggle an email Active↔Inactive; confirm an inactive email drops from
active use but is retained; confirm a transition-state email is read-only; confirm only the super-user
can hard-delete a row.

**Acceptance Scenarios**:

1. **Given** a contact, **When** Mel adds a new email, **Then** it is created on the contact and appears
   in the list.
2. **Given** an active email, **When** Mel toggles it to Inactive, **Then** it becomes inactive — kept
   with its history but excluded from active lists and the active-uniqueness scope.
3. **Given** an email in the **transition** state, **When** Mel views the row, **Then** the status is
   shown **read-only** (transition is system-managed, not on Mel's toggle).
4. **Given** an email row, **When** a super-user hard-deletes it, **Then** the row is permanently
   removed; a non-super-user has no hard-delete affordance and cannot hard-delete it (enforced
   server-side).

---

### User Story 4 - A duplicate address becomes a "review as duplicate" (Priority: P2)

Active email addresses are unique across contacts. When Mel corrects an address to one already active on
**another** contact, she is not shown a raw error — she is told the address is already active on that
other contact and offered to **review the two as a potential duplicate**, routing into the merge flow.

**Why this priority**: A colliding address is almost always the same person entered twice; turning the
collision into a dedup prompt is what makes it useful rather than a dead end. It builds on US1.

**Independent Test**: set an address to one active on another contact; confirm the response names the
other contact and offers "review as duplicate" (not a raw constraint error), and that choosing it opens
the merge flow for the pair.

**Acceptance Scenarios**:

1. **Given** an address active on another contact, **When** Mel sets an email to that address, **Then**
   she is told it is already active on that other contact (named), not shown a raw database error.
2. **Given** that message, **When** Mel chooses **review as duplicate**, **Then** the two contacts are
   surfaced in the duplicate/merge flow.
3. **Given** the collision, **When** it is refused, **Then** neither email is changed.

---

### User Story 5 - The login email is marked and guarded (Priority: P2)

An email marked as the staff **sign-in identity** (login) is how that volunteer signs in. Its row is
clearly marked ("used for staff sign-in"), and changing its address or deactivating it is guarded so Mel
doesn't accidentally lock a volunteer out. A login email is only allowed on a volunteer contact.

**Why this priority**: A login email is load-bearing for staff access; marking and guarding it prevents
an accidental lockout, but it is a narrower case than the everyday email edits.

**Independent Test**: on a volunteer with a login email, confirm the row is marked as the sign-in
identity and that changing/deactivating it is guarded; confirm a login email cannot be set on a
non-volunteer.

**Acceptance Scenarios**:

1. **Given** an email that is the login identity, **When** Mel views the row, **Then** it is marked as
   used for staff sign-in.
2. **Given** a login email, **When** Mel attempts to change its address or set it inactive, **Then** she
   must pass an explicit **confirmation** ("this is a staff sign-in email — proceed?") before it applies;
   it is never a silent change.
3. **Given** a non-volunteer contact, **When** an email is marked as login, **Then** it is refused
   (login is allowed only on volunteers, enforced server-side).

---

### User Story 6 - Delivery telemetry at a glance (Priority: P3)

Each email row shows, read-only, a compact hint of its delivery telemetry — when it was last opened or
clicked, or a dead-address hint — so Mel can spot an address that has gone quiet. This is provisional and
must stay compact on a phone.

**Why this priority**: Useful context for spotting dead addresses, but supporting information, and its
value on the mobile layout is still being judged.

**Independent Test**: on an email with telemetry, confirm a compact read-only hint (e.g. "opened 3 months
ago") appears on the row and cannot be edited.

**Acceptance Scenarios**:

1. **Given** an email with delivery telemetry, **When** Mel views the row, **Then** a compact, read-only
   hint of that telemetry is shown.
2. **Given** the telemetry, **When** Mel interacts with the row, **Then** she cannot edit the telemetry
   values (they are provider-supplied, read-only).

---

### Edge Cases

- **do-not-contact then add a topic**: selecting another topic while do-not-contact is set either clears
  do-not-contact or is prevented — the two are never both retained.
- **Removing the last email**: a contact may end with no active email (soft-inactive all of them); this
  is allowed (it becomes a needs-follow-up contact), distinct from deleting the contact.
- **Editing a transition-state email's other fields**: purposes/topics may still be maintainable while
  status stays read-only, or the whole row is read-only during transition — the status control itself is
  never on the toggle during transition.
- **Collision with an inactive email elsewhere**: uniqueness applies only to active/transition emails, so
  setting an address that exists only as an *inactive* email elsewhere is allowed (no duplicate prompt).
- **Hard-deleting the login email**: guarded like any login change; a hard delete of a login email must
  not silently strand a volunteer's sign-in.
- **PII-restricted viewer**: a viewer without PII read does not see email addresses (unchanged feature
  016); the email editor is for the mailing-list manager who holds PII read.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The record editor MUST show a contact's emails as a list of rows below the scalar fields;
  each row MUST show address, purposes, consent topics, and status. *(M-R13)*
- **FR-002**: A holder of mailing-write authority MUST be able to edit an email's address, purposes,
  consent topics, and status and have the change persist; a viewer without that authority MUST NOT be
  able to edit emails (server-enforced). *(M-R13)*
- **FR-003**: The consent-topics control MUST make **do-not-contact exclusive** — selecting it visibly
  clears/greys the other topics; the other topics are never silently retained. *(M-R15.1)*
- **FR-004**: The control MUST prevent an email from having **zero purposes or zero consent topics** —
  it stops the empty state rather than erroring on save. *(M-R15.2)*
- **FR-005**: Each email MUST have an **Active / Inactive** status toggle; an email in the system-managed
  **transition** state MUST show its status **read-only**, not on the toggle. *(M-R14)*
- **FR-006**: Mel MUST be able to **add** an email to a contact. *(M-R17)*
- **FR-007**: "**Remove**" MUST be a soft action — setting the email **inactive** (keeping its history
  and telemetry, dropping it from active lists and the active-uniqueness scope). *(M-R17)*
- **FR-008**: A **hard delete** that permanently erases an email row MUST be gated by the existing
  **`contact.delete.unrestricted`** capability (super-user only) — no new capability. A viewer without it
  MUST have no hard-delete affordance and MUST be refused server-side. *(M-R17)*
- **FR-009**: When Mel sets an address that is already **active on another contact**, the system MUST
  surface it as *"already active on [that contact] — review as duplicate,"* naming the other contact and
  offering to route into the duplicate/merge flow — NOT a raw constraint error — and MUST change nothing.
  *(M-R15.3)*
- **FR-010**: An email that is the staff **login identity** MUST be clearly marked ("used for staff
  sign-in"); changing its address or deactivating it MUST require an explicit **confirmation** ("this is a
  staff sign-in email — proceed?") before it applies — never a silent change, and not an outright block.
  A login email MUST be allowed only on a volunteer contact (server-enforced). *(M-R15.4)*
- **FR-011**: Each email row MUST show its **delivery telemetry read-only** in a compact form (e.g. "last
  opened / clicked", a dead-address hint); the telemetry values MUST NOT be editable. *(M-R16)*
- **FR-012**: The email editor MUST be reachable from the feature-063 record editor (the emails listed
  below the scalar fields), reusing its mobile-first presentation.

### Key Entities

- **Contact email**: an address owned by a contact, with **purposes**, **consent topics**, a **status**
  (active / transition / inactive), an optional **login** marker (staff sign-in identity), and read-only
  provider **telemetry** (last-open / last-click / set-date). Active/transition addresses are unique
  across contacts.
- **Editor authority**: mailing-write (mailing-list manager; edits emails), PII-read (sees addresses),
  and — for the hard delete — the super-user via `contact.delete.unrestricted` (reused, no new
  capability).
- **Duplicate signal**: a colliding active address links the two contacts into the existing
  duplicate/merge flow.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A mailing-list manager can view and edit every field of a contact's emails (address,
  purposes, consent topics, status) from the record, and add or soft-remove an email, without leaving the
  editor.
- **SC-002**: 100% of attempts to reach zero purposes or zero topics, or to retain other topics
  alongside do-not-contact, are prevented by the control (no such invalid state is ever saved).
- **SC-003**: 100% of duplicate-address collisions are presented as a named "review as duplicate" prompt
  routing into the merge flow, with 0 raw constraint errors shown to Mel and 0 emails changed on refusal.
- **SC-004**: 100% of hard-delete attempts by a non-super-user are refused; a super-user can hard-delete
  an email row.
- **SC-005**: A login email is visibly marked and its address-change/deactivation is guarded in 100% of
  cases; a login email is never saved on a non-volunteer contact.

## Assumptions

- The email data model already exists (address, purposes, consent topics, status incl. transition, login
  marker, provider telemetry), as do the add and edit paths and the service-level rules (do-not-contact
  collapse, ≥1 purpose/topic, login-only-on-volunteer, active-uniqueness). This feature mainly **surfaces**
  those in the editor and makes the rules visible; the genuinely new backend is the hard-delete path and
  turning the collision into a dedup signal.
- The record editor already fetches the contact's emails for a PII-holding viewer (feature 063/016); this
  feature renders and edits them there.
- Editing emails is gated by mailing-write (held globally by the mailing-list manager); reading addresses
  stays PII-gated. No change to who may read PII.
- "Review as duplicate" reuses the existing duplicate-detection / merge flow (features 062/033); this
  feature only routes a collision into it, not a new merge mechanism.
- Provider telemetry is read-only and provider-supplied; nothing here writes it. Its on-row treatment is
  provisional and may be trimmed after it is seen on the mobile layout.
