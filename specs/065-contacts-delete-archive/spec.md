# Feature Specification: Contact Archive & Delete

**Feature Branch**: `065-contacts-delete-archive`

**Created**: 2026-09-02

**Status**: Draft

**Input**: User description: "M-R9, M-R10, M-R11, M-R12"

## Overview

Mel maintains the contact list, and part of that is retiring records that should no longer appear —
someone who has moved away, a bad import, a stale placeholder. Today the only way to take a contact out
of circulation is to **merge** it into another, which is wrong when it isn't a duplicate. This feature
adds two ways to remove a contact from active use:

- **Soft archive** (reversible) — set a contact aside so it drops out of every active view, mailing-list
  export, and duplicate-detection candidate, without losing it; it can be restored later.
- **Hard delete** (permanent) — remove a contact entirely. A **safe** delete is available to the
  mailing-list manager but **refuses** when the contact carries membership, attendance, or payment
  history (that history must not be erased — those records cascade off the contact). An **unrestricted**
  delete, reserved for the super-user, bypasses that guard.

Archiving is the everyday tool; deletion is the exception. Both are reached from the contact record
(feature 063 editor) and gated by capability.

## Clarifications

### Session 2026-09-02

- Q: What blocks a safe (non-unrestricted) delete? → A: **Bare-record-only** — the safe delete is
  refused whenever the contact is referenced by *any* substantive table (membership, attendance, payment,
  volunteer/staff grants, officer roles, performer links, door records, membership captures). Only a
  contact with nothing but its own name and email rows is safe-deletable; everything else is a
  merge-or-archive case. (Rationale: those references are a mix of ON DELETE CASCADE — which would erase
  the row — and ON DELETE SET NULL — which would orphan it; both are unacceptable for a "safe" delete.)
- Q: How does Mel surface archived contacts to restore one? → A: A compact include-archived toggle on the
  contacts search, **labeled "+ archived"**. Archived contacts stay out of the default/active results;
  only when the toggle is on do they appear (clearly marked archived), and opening one offers **Restore**.
  No dedicated archived view.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Archive a contact (retire, reversibly) (Priority: P1)

Mel opens a contact that should no longer appear — a duplicate-looking placeholder that isn't actually a
duplicate, or someone long gone — and archives it. It immediately drops out of search, the review queue,
the duplicates queue, mailing-list exports, and the launcher counts, but it is not destroyed.

**Why this priority**: This is the core, safe, everyday action the feature exists to provide, and the
one that finally gives Mel an alternative to merging non-duplicates.

**Independent Test**: archive a contact, then confirm it no longer appears in search, the review queue,
the duplicates candidates, or an export, and that its data still exists (it can be restored).

**Acceptance Scenarios**:

1. **Given** an open contact, **When** Mel archives it, **Then** the record is marked archived and the
   contact stops appearing in any active view (search results, review queue, duplicate pairs) and in
   mailing-list exports.
2. **Given** a contact is archived, **When** the launcher counts are computed, **Then** the archived
   contact is not counted (needs-review or duplicate).
3. **Given** a contact is archived, **When** it is examined directly, **Then** its data (name, emails,
   history) is intact — archiving destroys nothing.
4. **Given** Mel holds contact-write authority, **When** she archives, **Then** the action succeeds
   without any elevated permission (archive rides on contact-write).

---

### User Story 2 - Restore an archived contact (Priority: P1)

An archive was a mistake, or the person came back. Mel finds the archived contact and restores it, and it
returns to active use.

**Why this priority**: Reversibility is the whole point of "soft" archive; without a restore path the
archive is a one-way trip and no safer than delete.

**Independent Test**: archive a contact, surface it through the archived view/filter, restore it, and
confirm it reappears in active search.

**Acceptance Scenarios**:

1. **Given** archived contacts exist, **When** Mel turns on the search's **"+ archived"** toggle,
   **Then** archived contacts appear in the results (clearly marked archived) that the default search
   hides.
2. **Given** an archived contact is open, **When** Mel restores (unarchives) it, **Then** it returns to
   active use — it appears again in search and is eligible for exports and duplicate detection.
3. **Given** an archived contact, **When** it is restored, **Then** any prior needs-review / membership
   standing is unchanged by the archive round-trip.

---

### User Story 3 - Safe hard delete with a history guard (Priority: P2)

Mel wants to permanently remove a genuinely empty record — a test entry or a bad import with only a name
and maybe an email. She deletes it. But if the contact is referenced by any substantive record —
membership, attendance, payment, a volunteer/staff grant, an officer role, a performer link, a door
record, or a membership capture — the delete is **refused** with a clear explanation, because deleting it
would erase or orphan that record; she is directed to merge or archive instead.

**Why this priority**: Permanent deletion is occasionally the right call for truly bare records, but it
must never silently destroy or orphan history, financial records, or relationships — so the guard is
essential and P2.

**Independent Test**: delete a bare contact (only name/emails) → succeeds, gone; attempt to delete a
contact referenced by any substantive table → refused with a reason, contact and references intact.

**Acceptance Scenarios**:

1. **Given** a **bare** contact (referenced only by its own email rows, nothing else), **When** a holder
   of the delete capability deletes it, **Then** the contact and its emails are permanently removed.
2. **Given** a contact referenced by **any** substantive record (membership, attendance, payment,
   volunteer/staff grant, officer role, performer link, door record, or membership capture), **When**
   that same holder attempts a delete, **Then** the delete is refused with a clear reason and the contact
   and every referencing record are unchanged.
3. **Given** a viewer without the delete capability, **When** they attempt a delete, **Then** it is
   refused (authorization), regardless of history.
4. **Given** any permanent deletion, **When** it succeeds, **Then** it is recorded in the audit trail.

---

### User Story 4 - Unrestricted hard delete (super-user) (Priority: P3)

For the rare case where even a contact with history must be purged (e.g. a data-privacy erasure request),
the super-user can delete it, bypassing the history guard.

**Why this priority**: A real but rare need, reserved for the highest authority; it layers on US3.

**Independent Test**: as the super-user, delete a contact that the safe delete refused (has history), and
confirm it is removed; confirm a non-super-user cannot.

**Acceptance Scenarios**:

1. **Given** a contact with history that the safe delete refuses, **When** the super-user performs an
   unrestricted delete, **Then** the contact is permanently removed despite the history.
2. **Given** a viewer who is not a super-user, **When** they attempt an unrestricted delete, **Then** it
   is refused.
3. **Given** an unrestricted deletion, **When** it succeeds, **Then** it is recorded in the audit trail.

---

### Edge Cases

- **Archive is distinct from merge**: an archived contact is *retired*, not *merged* — it has no
  surviving "canonical" record and is not treated as a duplicate; the two states are independent.
- **Archived contact in the record editor**: opening an archived contact shows it is archived and offers
  **Restore**; an active contact offers **Archive**. Archived contacts are otherwise hidden from active
  views.
- **Delete confirmation**: permanent deletion is irreversible, so it requires an explicit confirmation
  step distinct from a normal save; archiving does not (it is reversible).
- **Deleting vs. archiving a contact with only emails**: emails belong to the contact and are removed
  with it; email rows alone do **not** count as a substantive reference — a contact whose only references
  are its own emails is still a bare, safe-deletable record.
- **Archived contact and its emails**: while archived, the contact's emails are out of the active
  mailing-list scope (they travel with the contact's archived state).
- **Restoring re-enables duplicate detection**: a restored contact can again surface as a duplicate
  candidate if a similar contact exists.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A holder of contact-write authority MUST be able to **archive** a contact — a reversible
  action that retires it without destroying data. *(M-R9)*
- **FR-002**: An archived contact MUST be **excluded from every active-contact read** — search, the
  review queue, duplicate-detection candidates, the launcher counts, and mailing-list exports — the same
  way a merged contact is excluded. *(M-R10)*
- **FR-003**: A holder of contact-write authority MUST be able to **restore (unarchive)** an archived
  contact, returning it to active use. *(M-R9)*
- **FR-004**: The contacts search MUST offer a compact include-archived toggle **labeled "+ archived"**;
  with it off (the default) archived contacts are hidden, and with it on they appear in the results
  **clearly marked as archived**, so Mel can find one to restore. There is no separate archived view.
- **FR-005**: Archive MUST be **distinct from merge** — an archived contact is retired, not folded into
  another, and is not treated as a duplicate. *(M-R9)*
- **FR-006**: A new **safe delete** capability (held by the mailing-list manager) MUST permanently remove
  a contact **only when it is a bare record** — referenced by nothing but its own email rows. If the
  contact is referenced by any substantive record (membership, attendance, payment, volunteer/staff
  grant, officer role, performer link, door record, or membership capture), the delete MUST be **refused
  with a clear reason** and the contact and every referencing record left intact. *(M-R11)*
- **FR-007**: A new **unrestricted delete** capability (held by the super-user only) MUST permanently
  remove a contact **regardless of history**, bypassing the FR-006 guard. *(M-R12)*
- **FR-008**: The two delete capabilities MUST be **distinct catalog capabilities** (safe delete and
  unrestricted delete), not inline role checks; the safe delete belongs to the mailing-list manager (and
  the super-user by superset), the unrestricted delete to the super-user alone. *(M-R11/M-R12)*
- **FR-009**: A viewer lacking the relevant delete capability MUST NOT be able to delete a contact by any
  path (the guard is enforced on the server, not only hidden in the UI).
- **FR-010**: Every permanent deletion (safe or unrestricted) MUST be **recorded in the audit trail**.
- **FR-011**: Archive/restore and delete MUST be reachable from the contact record editor (feature 063),
  with the controls shown according to the viewer's capability and the contact's archived state.
- **FR-012**: A permanent deletion MUST require an **explicit confirmation** distinct from a normal save;
  an archive (reversible) MUST NOT require that confirmation.

### Key Entities

- **Contact**: gains an **archived** state (a reversible retirement marker), independent of the existing
  merged-into relationship. An archived contact is excluded from active reads; a merged contact already
  is. Neither destroys data; a hard delete does.
- **Substantive references**: any record tied to a contact beyond its own emails — membership,
  attendance, payment, volunteer/staff grant, officer role, performer link, door record, membership
  capture. Their presence is what the **safe delete** refuses to erase or orphan; the **unrestricted
  delete** overrides.
- **Delete capabilities**: two distinct authorities — a safe delete (mailing-list manager + super-user)
  and an unrestricted delete (super-user only).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An archived contact appears in **0** active surfaces — search, review queue, duplicate
  candidates, launcher counts, and mailing-list exports — while its data remains fully intact and
  restorable.
- **SC-002**: 100% of archives are reversible — a restored contact returns to active use with its data
  and standing unchanged by the round-trip.
- **SC-003**: 100% of safe-delete attempts on a contact referenced by any substantive record are refused
  with a clear reason, and 0 such deletions erase or orphan a referencing record.
- **SC-004**: A bare contact (only its own emails) is permanently removed by a safe delete; a contact
  with any substantive reference is removed only by an unrestricted (super-user) delete — verified
  against a seeded data set.
- **SC-005**: 100% of permanent deletions are captured in the audit trail.

## Assumptions

- Archive is a reversible marker on the contact (mirroring the existing archived state on other entities
  such as bands); no data is copied or moved. The exact storage and any supporting index are settled in
  planning; this feature adds the marker and the active-read exclusion.
- The active-read filter extends the reads that already exclude merged contacts (search, exports, dedup
  candidates, launcher counts) to also exclude archived ones; the same filter shape applies everywhere.
- A safe delete succeeds only for a **bare** contact — one referenced by nothing but its own email rows.
  Any other reference (membership, attendance, payment, volunteer/staff grant, officer role, performer
  link, door record, membership capture) blocks it, because deleting would erase (cascade) or orphan
  (set-null) that record. The exact list of referencing tables checked is finalized in planning against
  the schema.
- Archived contacts are surfaced for restore via an "include archived" toggle on the contacts search
  (off by default); they are hidden from all default/active views and, when shown, marked as archived.
- Archive rides on the existing contact-write grant the mailing-list manager already holds; the two
  delete capabilities are new catalog entries.
- Deletion is performed only by an authorized human through the confirmed in-app flow; the system never
  deletes contacts automatically.
