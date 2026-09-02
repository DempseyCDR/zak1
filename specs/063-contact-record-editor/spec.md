# Feature Specification: Contact Record Editor — Scalar Fields

**Feature Branch**: `063-contact-record-editor`

**Created**: 2026-09-01

**Status**: Draft

**Input**: User description: "M-R5, M-R6, M-R7 and M-R8"

## Overview

When Mel (the mailing-list manager) opens a contact from the maintenance search (feature 062), she
currently sees a **read-only** summary card. This feature turns that card into an **editable record**
for the contact's core scalar fields — name parts, the effective display name, pronouns, and phone —
plus a governance-gated toggle for `is_volunteer`, and a small block of read-only context so Mel can
see a contact's standing without being able to hand-edit machine-managed values.

This is the "record mode" of the contact-maintenance screen (source requirements M-R5–M-R8). It is
**not** purely presentational: the display-name is Automatic-or-Custom (an override that a blank field
resets), and `is_volunteer` is the staff-access gate (feature 015), so its edit must be restricted to
role-granting officers on the **server**, not only hidden in the UI.

Out of scope (later Phase-8 features): soft archive and hard delete (M-R9–M-R12), the per-contact email
list and shared/family emails (M-R13+), and the duplicates/merge flow (shipped in feature 062).

## Clarifications

### Session 2026-09-01

- Q: How does the server reject an `is_volunteer` change from a contact-write-only viewer? → A: Ignore
  the field — save the other scalar edits, leave `is_volunteer` at its stored value, and return success;
  a changed value from an unauthorized viewer is dropped, not honored (never a 403 and never a whole-
  request failure).
- Q: How are record edits committed? → A: One explicit **Save** button commits all scalar fields at
  once (with a Cancel/Close to discard), mirroring the existing "Add contact" create form — not autosave
  and not per-field inline commit.
- Q: Should the editor let a role-assign holder edit `is_volunteer`, given the access screen already
  designates/clears volunteers (with grant-cascade + approval)? → A: No. `is_volunteer` is **read-only
  in the editor for everyone**; the access screen stays the sole designate/clear path. The contact save
  endpoint still refuses an unauthorized `is_volunteer` change as endpoint defense (broad `contact.write`
  holders like a door attendant must not use it as a back door).
- Q: How is the (editable) phone formatted for display? → A: The editable field shows the human-readable
  dashed form (`formatPhone`, e.g. `585-555-1234`); Save re-canonicalizes via the existing server-side
  `normalizePhone`, so an untouched phone round-trips with no drift (not a separate read-only display and
  not a live input mask).
- Q: Where does the opened record editor appear? → A: As a **modal overlay in front of** the results
  lists (not inline below them, which is often below the fold), labeled by the contact, with focus moved
  into it; it closes on Save/Cancel (Escape cancels) and returns focus to search. Backdrop click does not
  close it (avoids discarding edits by accident).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Edit a contact's core details (Priority: P1)

Mel finds a contact whose surname was mistyped and whose phone number is out of date. She opens the
record, corrects the last name and the phone, and saves. The corrected values are shown immediately and
persist; the contact's searchable name and duplicate-detection key update to match.

**Why this priority**: This is the everyday reason Mel comes to the screen — keeping basic contact data
correct. Without it the maintenance screen is read-only and Mel still cannot do her job.

**Independent Test**: Open a seeded contact, change first name / last name / pronouns / phone, save, and
confirm the persisted record and the display name reflect the edits and that the contact is still found
by its new name.

**Acceptance Scenarios**:

1. **Given** an opened contact, **When** Mel edits first name, last name, pronouns, or phone and saves,
   **Then** the record persists the new values and the record view shows them.
2. **Given** a contact in Automatic name mode, **When** Mel changes the first or last name and saves,
   **Then** the effective display name and the name/dedup search keys update to the new "first last".
3. **Given** a phone number typed with punctuation, **When** Mel saves, **Then** the stored phone is
   normalized consistently (matching how new contacts store phone).
4. **Given** Mel holds contact-write authority, **When** she saves scalar edits (no volunteer change),
   **Then** the save succeeds regardless of whether she can assign roles.

---

### User Story 2 - Automatic vs Custom display name (Priority: P1)

A contact is normally shown as "First Last" (Automatic). For a contact who goes by a different name
("DJ" for David Jones, "Prof. Aoki"), Mel pins a custom display name. She can later reset it back to
Automatic. Editing the underlying first/last name while a custom name is pinned must not disturb the
pinned name.

**Why this priority**: The display name is what everyone else in the system sees; getting the
Automatic/Custom model right prevents both accidental overrides and stuck custom names. It is the one
genuinely stateful control on the record.

**Independent Test**: Toggle a contact from Automatic to Custom, save a pinned name, confirm it holds
when first/last change; reset to Automatic and confirm the name resumes tracking "first last".

**Acceptance Scenarios**:

1. **Given** a contact in Automatic mode (no override), **When** Mel views the record, **Then** the
   display-name field is a read-only live preview of "first last" and the control offers **Set custom
   name**.
2. **Given** Automatic mode, **When** Mel chooses **Set custom name**, **Then** the field becomes
   editable and is prefilled with the current effective name.
3. **Given** Custom mode (a pinned override), **When** Mel edits first or last name and saves, **Then**
   the pinned display name does **not** change.
4. **Given** Custom mode, **When** Mel chooses **Reset to automatic** (or clears the custom field) and
   saves, **Then** the override is cleared and the display name resumes tracking "first last".
5. **Given** Custom mode, **When** Mel saves with the custom field left blank, **Then** it is treated as
   a reset (never a validation error).

---

### User Story 3 - Volunteer flag is read-only here, guarded at the endpoint (Priority: P2)

`is_volunteer` decides whether a person can sign in as staff. It already has a governance-complete write
path on the **access screen** (designate/clear, which cascades a revoke of all the contact's role grants
and records approval). The contact record editor must therefore **only display** `is_volunteer` —
read-only for **every** viewer — and never offer an edit control; designation stays on the access
screen. Independently, the contact **save endpoint** must refuse to change `is_volunteer` for anyone
without role-assignment authority, because `contact.write` is held broadly (a door attendant creating
contacts at check-in holds it) and must not become a back door to the staff-access gate.

**Why this priority**: It is a security boundary (staff-access gate), so the endpoint guard must be
enforced; keeping the flag read-only in the editor avoids a second, weaker write path that would bypass
the access screen's cascade + approval.

**Independent Test**: open the record as any viewer and confirm `is_volunteer` shows read-only with no
control and that a save never carries it; at the endpoint, confirm a contact-write-only actor's attempt
to change `is_volunteer` is ignored while the rest of the save applies, and a role-assign actor's change
persists.

**Acceptance Scenarios**:

1. **Given** any viewer opening the record, **When** they view it, **Then** `is_volunteer` is shown
   read-only with no editable control, and a save from the editor never includes `is_volunteer`.
2. **Given** a contact-write-only actor, **When** a save request to the endpoint changes `is_volunteer`
   (e.g. alongside a valid name edit), **Then** the request succeeds, the name edit persists, and the
   stored `is_volunteer` value is left unchanged (the field is silently ignored, not an error).
3. **Given** a role-assign actor, **When** the endpoint receives a change to `is_volunteer`, **Then** it
   persists (the endpoint guard permits it).
4. **Given** any actor, **When** a save leaves `is_volunteer` at its current value, **Then** the save is
   allowed (an unchanged flag is never treated as an attempted change).

---

### User Story 4 - Read-only standing at a glance (Priority: P3)

While editing, Mel needs to see a contact's standing — membership status, whether the contact is flagged
as needing review, and when/by whom volunteer approval was recorded — without any ability to hand-edit
those machine-managed values. The internal `source` field is not shown.

**Why this priority**: Useful context that reduces mistakes (e.g. seeing "needs review"), but it is
supporting information, not the core edit.

**Independent Test**: Open a contact and confirm membership status, needs-review, and volunteer-approval
fields render as read-only context, and that `source` is not present on the screen.

**Acceptance Scenarios**:

1. **Given** an opened contact, **When** Mel views the record, **Then** `membership_status`,
   `needs_review`, and the volunteer-approval fields (`volunteer_approved_at` / `_by`) are shown as
   read-only context.
2. **Given** an opened contact, **When** Mel views the record, **Then** the `source` field is not
   displayed.
3. **Given** an opened contact, **When** Mel views the record, **Then** there is no control to edit
   membership status or list-member from this screen (those are materialized from memberships).

---

### Edge Cases

- **Blank required name**: first name is the minimum identity. Saving a contact with an empty first name
  is prevented by the control (consistent with contact creation), not an unhandled error.
- **Whitespace-only custom name**: treated the same as blank → reset to Automatic.
- **Switching to Custom then cancelling without saving**: no override is written; the contact stays
  Automatic.
- **Concurrent edit**: if the contact changed since it was opened, the save writes the submitted scalar
  fields (last-write-wins for those fields); machine-managed context fields are never written from here.
- **Volunteer toggle with unchanged value**: a payload that includes the current `is_volunteer` value is
  not treated as an attempted change and does not require role-assign authority.
- **PII-restricted viewer**: a viewer without PII read still uses the same record; phone (PII) follows
  the existing PII gating for reads (feature 016) and is not newly exposed by this feature.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST let an authorized editor change a contact's **first name, last name,
  pronouns, and phone** from the record, and persist those changes. *(M-R5)*
- **FR-002**: The system MUST recompute the maintained display name and the name/dedup search keys when
  any name-determining field (first name, last name, or display-name override) changes. *(M-R5/M-R6)*
- **FR-003**: The system MUST normalize a saved phone number consistently with how contacts are created.
  *(M-R5)*
- **FR-004**: The record MUST present the display name as an **Automatic / Custom** control: a single
  override input plus a read-only live preview of the effective display name, and one button that
  toggles between **Set custom name** (Automatic → Custom) and **Reset to automatic** (Custom →
  Automatic). *(M-R6)*
- **FR-005**: In **Automatic** mode the override MUST be empty, the display-name field MUST be read-only
  and MUST track "first last" live; choosing **Set custom name** MUST prefill the field with the current
  effective name and make it editable. *(M-R6)*
- **FR-006**: In **Custom** mode the override is the editable pinned name; editing first or last name
  MUST NOT change the pinned display name. *(M-R6)*
- **FR-007**: Saving with a **blank (or whitespace-only) custom name MUST reset** the contact to
  Automatic (override cleared), never raise a validation error. **Reset to automatic** MUST clear the
  override. *(M-R6)*
- **FR-008**: The machine keys (`name_normalized`, `dedup_normalized`) MUST NOT be shown to Mel as
  editable fields; they are internal and, if ever surfaced, only as super-user diagnostics. *(M-R6)*
- **FR-009**: The record MUST show `is_volunteer` **read-only for every viewer** and MUST offer no
  control to change it; a save from the editor MUST NOT carry `is_volunteer`. Designating or clearing a
  volunteer is done on the access screen, which owns the grant-cascade and approval semantics. *(M-R7)*
- **FR-010**: The contact **save endpoint** MUST **silently ignore** a change to `is_volunteer`
  submitted by a viewer who lacks role-assignment authority (endpoint defense — `contact.write` is held
  broadly, including by a door attendant at check-in). The other scalar edits still save, the stored
  `is_volunteer` value is left unchanged, and the request returns success (never a 403 or a whole-
  request failure). A submitted value equal to the stored value is likewise a no-op. *(M-R7)*
- **FR-011**: When the save endpoint receives a change to `is_volunteer` from a viewer who **holds**
  role-assignment authority, it MUST persist it (the endpoint guard permits it — e.g. a data fix). Note
  the primary volunteer designate/clear path remains the access screen, not this editor. *(M-R7)*
- **FR-012**: The record MUST display `is_volunteer`, `membership_status`, `needs_review`, and the
  volunteer-approval fields (`volunteer_approved_at` / `volunteer_approved_by`) as **read-only** context.
  The **yes/no flags** (`is_volunteer`, `list_member`, `needs_review`) MUST be laid out **compactly in a
  single wrapping row** rather than one stacked row each — a boolean should not cost a full row of
  height. *(M-R8)*
- **FR-013**: The record MUST NOT display the internal `source` field. *(M-R8)*
- **FR-014**: The record MUST NOT offer any control to edit `membership_status` or `list_member`, which
  are materialized from memberships elsewhere. *(M-R8)*
- **FR-015**: All scalar edits in FR-001–FR-007 MUST be available to a holder of contact-write authority
  (i.e. the mailing-list manager), independent of role-assignment authority. *(M-R5)*
- **FR-016**: The record editor MUST reuse the existing mobile-first admin presentation (feature 060)
  and the same record surface reached from the feature-062 search — no separate page or navigation.
- **FR-017**: Edits MUST be committed by a single explicit **Save** action covering all scalar fields at
  once, with a Cancel/Close that discards uncommitted edits; the editor MUST NOT autosave or commit
  fields individually. *(commit model)*
- **FR-018**: Every editable field (first name, last name, display name, pronouns, phone) MUST carry a
  **visible text label** so Mel knows what each field holds — not a placeholder-only or
  screen-reader-only label. *(M-R5 usability)*
- **FR-019**: The phone MUST be **displayed in a human-readable format** (e.g. `585-555-1234`) rather
  than the stored canonical form (`+15855551234`); on save it MUST re-canonicalize to the stored form,
  so an unedited phone round-trips with no change. *(M-R5 usability)*
- **FR-020**: The record editor MUST open as a **modal overlay in front of** the search/needs-review and
  duplicates lists — not inline below them (which pushes it below the fold). It MUST be a proper dialog
  (labeled by the contact, focus moved into it on open), and it MUST **close on Save and on Cancel**
  (Escape also cancels), returning focus to the search field. *(M-R5 usability)*

### Key Entities

- **Contact**: the person record. Editable here: `first_name`, `last_name`, `display_name_override`,
  `pronouns`, `phone`, and (governance-gated) `is_volunteer`. Maintained/derived on save:
  `display_name`, `name_normalized`, `dedup_normalized`. Read-only context surfaced here:
  `membership_status`, `list_member`, `needs_review`, `volunteer_approved_at`, `volunteer_approved_by`.
  Not surfaced: `source`, and the internal name keys.
- **Editor authority**: two relevant capabilities — contact-write (mailing-list manager; drives the
  scalar edits) and role-assignment (President/VP/super-user; the only authority that may change
  `is_volunteer`).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A mailing-list manager can open a contact, correct any of first/last/pronouns/phone, and
  save in a single screen with no page navigation, and the contact remains findable by its new name.
- **SC-002**: The editor offers no control to change `is_volunteer` and never sends it; 100% of attempts
  by a contact-write-only actor to change `is_volunteer` at the endpoint leave the stored value
  unchanged (the field is ignored, the rest of the save still applies), while a role-assign actor's
  change at the endpoint persists.
- **SC-003**: Toggling a contact between Automatic and Custom display name behaves correctly in all four
  transitions (set custom, edit-name-while-custom, reset via button, reset via blank) with zero cases
  where a blank custom name produces an error.
- **SC-004**: The record shows the four read-only context values and never the `source` field, in 100%
  of opened records.

## Assumptions

- The editable record extends the existing read-only record surface introduced with the feature-062
  search; the same contact detail is opened from the search worklist.
- The contact update service and its authenticated update endpoint already exist and already recompute
  the display name and search keys and normalize phone on change; this feature adds the volunteer-flag
  authorization boundary and the editing UI, and reuses the rest.
- No schema change or migration is required — every field named here already exists on the contact
  record.
- Role-assignment authority is the existing capability used elsewhere for volunteer/access management;
  no new capability is introduced by this feature.
- PII handling for reads (e.g. phone) is unchanged; this feature does not broaden who can see PII.
- "Mailing-list manager" holds contact-write globally (features 059); nothing here changes that grant.
