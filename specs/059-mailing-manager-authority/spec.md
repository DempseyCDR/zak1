# Feature Specification: Mailing-List Manager Authority to Maintain Contacts

**Feature Branch**: `059-mailing-manager-authority`

**Created**: 2026-08-31

**Status**: Draft

**Input**: User description: "Mel authority to maintain contacts, M-R1 and M-R2."

Source requirements: `specs/phase-8-requirements/mel-contact-maintenance.md` — **M-R1** (the mailing-list
manager gains `contact.write`) and **M-R2** (`contact.mailing.write` becomes club-wide/global for the
mailing-list manager). This feature is the **authority change only** — the maintenance UI (record mode,
triage, delete/archive, shared-email) is out of scope and specified separately.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Maintain the contact record (Priority: P1)

Mel is the club's mailing-list manager. She needs to correct and complete the **basic contact record** —
a person's first/last name, display name, pronouns, and phone — for any club contact. Today the role
cannot do this at all: contact-record writes are refused for a mailing-list manager, so this work is
blocked in the product.

**Why this priority**: This is the core gap. Without it, "the mailing-list manager maintains contact
data" is unbuildable — the role has no authority to write a contact record. It is the foundation the
maintenance UI (a separate feature) will build on.

**Independent Test**: Signed in as a contact whose only role is `mailing_list_manager`, attempt a
contact-record create and a contact-record edit; both are **permitted**. Before this feature, both are
**refused**. Fully testable at the authorization layer without any new UI.

**Acceptance Scenarios**:

1. **Given** a volunteer whose only role grant is `mailing_list_manager`, **When** they create a new
   contact record, **Then** the action is permitted.
2. **Given** the same volunteer, **When** they edit an existing contact's name / pronouns / phone,
   **Then** the action is permitted.
3. **Given** the same volunteer, **When** they attempt an action **not** covered by this authority (for
   example, marking a contact a volunteer, deleting a contact, or assigning a role), **Then** the action
   is **refused**.

---

### User Story 2 - Maintain mailing permissions club-wide (Priority: P2)

Mel maintains each contact's email addresses and mailing-list permissions (purposes, consent topics,
active/inactive status). She works across the **whole club roster**, not one dance series — a family on
the English list and a caller on the contra list are both hers to keep correct. Today the role's
authority to edit email/consent is **limited to a series**, which is meaningless for contacts (a contact
does not belong to a series) and blocks her real work.

**Why this priority**: Completes the maintenance authority. It is P2 because email/consent editing is
partially available today (series-limited); this removes the artificial series limit so the role can act
club-wide, matching how the role's other contact-facing authority already behaves.

**Independent Test**: Signed in as a contact whose only role is `mailing_list_manager` (with, or without,
any series scope on the grant), edit the email purposes/consent/status of a contact unrelated to any
series; the action is **permitted**. Before this feature, a series-scoped grant limited or refused it.

**Acceptance Scenarios**:

1. **Given** a volunteer whose only role grant is `mailing_list_manager` scoped to one series, **When**
   they edit the email/consent of any contact, **Then** the action is permitted regardless of series.
2. **Given** the same volunteer, **When** they change a contact's email status to inactive, **Then** the
   action is permitted.

---

### Edge Cases

- **Union of authority**: a person holding `mailing_list_manager` **and** another role (e.g. VP) keeps
  every authority of both; this feature only ever **adds** to what `mailing_list_manager` alone confers,
  so a combined holder sees no change.
- **Series-scoped grant, club-wide effect**: even when the `mailing_list_manager` grant carries a series
  scope, the two capabilities in this feature apply **club-wide** (like the role's existing `export.read`
  and `contact.pii.read`). A per-series grant does not narrow them.
- **Revocation**: removing a person's `mailing_list_manager` grant removes this authority immediately, on
  their next request — no lingering access.
- **No superset regression**: roles that already hold these capabilities globally (e.g. super_user)
  behave exactly as before; the change is additive to `mailing_list_manager` only.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The `mailing_list_manager` role MUST confer the authority to **create and edit a contact
  record** (the person's names, display name, pronouns, phone) — i.e. hold `contact.write`.
- **FR-002**: The `mailing_list_manager` role's authority to **edit a contact's emails and mailing
  permissions** (`contact.mailing.write`) MUST apply **club-wide**, not limited to a series.
- **FR-003**: Both capabilities in FR-001 and FR-002 MUST take effect **club-wide** for the role
  regardless of any series/group scope on the individual grant (consistent with the role's existing
  club-wide `export.read` and `contact.pii.read`).
- **FR-004**: This feature MUST NOT grant the `mailing_list_manager` role any authority beyond FR-001 and
  FR-002. In particular it MUST NOT confer volunteer designation (`is_volunteer` / `role.assign`),
  contact deletion or archival, membership editing, or any other capability. Governance authority stays
  where it is.
- **FR-005**: The change MUST NOT alter the authority of any other role (no addition, no removal); it is
  additive to `mailing_list_manager` only.
- **FR-006**: Contact-record and email/consent changes made under this authority MUST continue to produce
  the existing audit trail, now attributable to a `mailing_list_manager` actor.

### Key Entities *(include if feature involves data)*

- **Role → capability authorization** (feature 016): the mapping of a role to the capabilities it
  confers and at what scope. This feature adds `contact.write` (club-wide) to `mailing_list_manager` and
  changes its `contact.mailing.write` from series-scoped to club-wide. **No database entities or schema
  are added or changed** — this is an authorization-policy change only.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A volunteer whose only role is `mailing_list_manager` can create and edit a contact record
  (name, pronouns, phone) for any contact — an action that is refused before this feature.
- **SC-002**: The same volunteer can edit any contact's email purposes / consent topics / status,
  regardless of series — an action that is series-limited or refused before this feature.
- **SC-003**: The same volunteer is still refused every action outside this authority (volunteer
  designation, contact delete/archive, role assignment, membership edits) — the governance boundary holds
  in 100% of those attempts.
- **SC-004**: No other role's set of permitted/refused actions changes (zero regressions across the
  existing authorization suite).

## Assumptions

- **`contact.write` is conferred club-wide (global) for the role.** A contact is not series-scoped, so a
  series-scoped `contact.write` would be meaningless — matching the reasoning behind M-R2 and the role's
  existing global `contact.pii.read` / `export.read`.
- The contact-record and email/consent **operations already exist** and already enforce these
  capabilities; this feature only grants the capabilities to the role. The maintenance **UI** that
  exercises them (record mode, triage, delete/archive, shared-email) is **out of scope** and specified
  separately.
- The role×capability authorization catalog (feature 016) is the single place authority is defined; this
  change is made there and is exhaustively type-checked, so a missing or malformed entry fails at build
  rather than silently denying.
