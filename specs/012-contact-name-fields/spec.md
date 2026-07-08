# Feature Specification: Contact First/Last Name, Overridable Display Name, and Pronouns

**Feature Branch**: `012-contact-name-fields`

**Created**: 2026-07-08

**Status**: Draft

**Input**: User description: "specs/PHASE2_REQUIREMENTS.md — item P2-3 (structured first/last name on contacts; display name defaults to 'first last' but is overridable; add a pronouns field; feed check-in sort and mailing-list export)"

## Clarifications

### Session 2026-07-08

- Q: With structured names, what does duplicate detection match on? → A: The structured **first + last name** (override-immune) — a display-name override/nickname can no longer mask a duplicate. **Search** continues to match the effective display name, so contacts stay findable by what is shown.
- Q: Are both first and last name required? → A: **First name required; last name optional (may be blank)** — some dancers decline to give a last name. With a blank last name, the display name is just the first name and dedup keys on the first name alone.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Structured names with an overridable display name (Priority: P1)

Today a contact has only a single display-name blob. The club needs **first and last name as separate
fields** — so lists can be sorted and merged by last name, and so mail merges have proper First/Last
columns. At the same time, the name shown around the app (rosters, member buttons, reports) should
usually be "First Last" but sometimes needs to differ — a nickname ("Bob" for Robert), a mononym, or an
organizational contact. So the **display name defaults to "First Last" but can be overridden**, and the
override sticks even when the underlying first/last are edited. Contacts also carry an optional
**pronouns** note.

**Why this priority**: This is the data-model change everything else builds on; on its own it lets an
administrator capture proper names and control how each contact is shown.

**Independent Test**: Create a contact with a first and last name; confirm the display name shows
"First Last"; set an override and confirm only the display name changes; clear the override and confirm
it returns to "First Last".

**Acceptance Scenarios**:

1. **Given** a new contact with first name "Robert" and last name "Frost", **When** it is viewed,
   **Then** its display name is "Robert Frost".
2. **Given** that contact, **When** the administrator sets a display-name override "Bob Frost", **Then**
   the display name shows "Bob Frost" while first/last remain "Robert"/"Frost".
3. **Given** an overridden contact, **When** the administrator edits the last name to "Frost-Smith",
   **Then** the display name still shows the override ("Bob Frost"), unchanged.
4. **Given** an overridden contact, **When** the administrator clears the override, **Then** the display
   name returns to the default of first + last.
5. **Given** a contact, **When** the administrator records pronouns (e.g. "she/her"), **Then** the
   pronouns are saved and shown on the contact.
6. **Given** a contact with first name "Jane" and **no last name**, **When** it is viewed, **Then** its
   display name is "Jane" (no trailing space), and it saves successfully without a last name.

---

### User Story 2 - Check-in roster sorts by name (Priority: P2)

At the door, the attendant scans a roster to find arriving dancers. With a single name blob the roster
can't be ordered reliably by last name. With structured names, the **roster can be sorted by last name
(and/or first name)** so the attendant can find someone quickly, and member buttons still show each
contact's effective display name.

**Why this priority**: A concrete payoff of the structured names for the highest-traffic daily workflow;
depends on US1's fields but is independently valuable and testable.

**Independent Test**: With several contacts, open the check-in roster and order it by last name; confirm
alphabetical-by-last-name ordering; confirm member buttons read the effective display name.

**Acceptance Scenarios**:

1. **Given** contacts "Ada Lovelace", "Grace Hopper", and "Bob Frost", **When** the roster is sorted by
   last name, **Then** they appear in order Frost, Hopper, Lovelace.
2. **Given** a contact with a display-name override, **When** its check-in member button is shown,
   **Then** the button label is the effective display name (the override).

---

### User Story 3 - Mailing-list export has separate First/Last columns (Priority: P2)

Mail-merge tools (iContact and similar) expect distinct First Name and Last Name columns. Today the
export derives them by *splitting* the single display name, which is unreliable (mononyms, multi-word
last names, overrides). With structured names, the export emits **First Name and Last Name straight from
the stored fields**.

**Why this priority**: Removes an unreliable heuristic and gives the club clean merge data; depends on
US1 but is independently testable.

**Independent Test**: Add a contact, run a mailing-list export, and confirm the output has distinct First
Name and Last Name columns matching the contact's stored first/last.

**Acceptance Scenarios**:

1. **Given** a contact with first "Ada" and last "Lovelace" on a mailing list, **When** that list is
   exported, **Then** the row has First Name "Ada" and Last Name "Lovelace" in separate columns.
2. **Given** a contact with a display-name override, **When** exported, **Then** the First/Last columns
   still reflect the structured first/last (not the override).

---

### Edge Cases

- **No last name** (a dancer who declines to give one, or a mononym like "Cher"): the last name is left
  blank; the display name defaults to just the first name, and dedup keys on the first name alone.
- **Organizational contact** (e.g. "Rochester Dance Collective"): enter the name as the first name with a
  blank last name, using the **display-name override** if a different presentation is wanted. A distinct
  "organization" contact type is out of scope.
- **Check-in sort with blank last names**: contacts without a last name sort together (as an empty last
  name); the roster can also be ordered by first name to find them.
- **Editing first/last on a non-overridden contact** updates the default display name accordingly.
- **Empty/whitespace override** is treated as "no override" (falls back to first + last).
- **Override does not hide a duplicate**: two contacts with the same first + last are flagged as likely
  duplicates even if one carries a different display-name override (dedup keys on first + last, not the
  shown name). Search, by contrast, still finds a contact by its shown display name.
- **Pronouns left blank** is fine — the field is optional and simply not shown.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A contact MUST have a **required first name** and an **optional last name** (which may be
  blank — some dancers decline to give one) as separate fields.
- **FR-002**: A contact's **effective display name** MUST default to first + " " + last, **trimmed** — so
  a contact with no last name shows just the first name (no trailing space).
- **FR-003**: An administrator MUST be able to set a **display-name override**; when present it is the
  effective display name, independent of first/last.
- **FR-004**: Editing first/last MUST update the default display name but MUST NOT change an existing
  override; clearing the override MUST return the display name to the first+last default.
- **FR-005**: A contact MUST support an **optional free-text pronouns** value that is recorded and shown
  on the contact.
- **FR-006**: **Duplicate detection** MUST match on the structured **first + last name** (the first name
  alone when the last name is blank), so a display-name override cannot mask a duplicate. **Search** MUST
  continue to match the **effective display name**, so contacts remain findable by what is shown.
- **FR-007**: The check-in roster MUST be sortable by **last name (and/or first name)**.
- **FR-008**: Check-in member buttons (and other places a contact's name is shown) MUST display the
  **effective display name**.
- **FR-009**: The mailing-list export MUST include **distinct First Name and Last Name columns sourced
  from the structured fields** (not derived by splitting the display name).
- **FR-010**: Every existing surface that shows a contact's name MUST continue to work, showing the
  effective display name (no regression to the contacts directory, bookings, reports, or exports).

### Key Entities *(include if feature involves data)*

- **Contact** (existing): gains a **required first name**, an **optional last name** (may be blank), an
  optional **display-name override**, and an optional free-text **pronouns**. Its **effective display name** =
  override if set, else "first last". **Duplicate detection** keys on the structured first + last name;
  **search** matches the effective display name.
- **Effective display name** (derived): override when set, otherwise first + " " + last. Used on rosters,
  member buttons, reports, and any name display.
- **Check-in roster** (existing): now orderable by last/first name; member buttons show the effective
  display name.
- **Mailing-list export row** (existing): gains distinct First Name / Last Name columns from the
  structured fields, replacing the current display-name split.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A contact created with first + last shows "First Last" by default (and a contact with no
  last name shows just the first name); an override changes only the display name; clearing it returns to
  the default.
- **SC-002**: The check-in roster can be ordered by last name so an attendant can locate a dancer by
  scanning alphabetically.
- **SC-003**: A mailing-list export contains separate First Name and Last Name columns populated from the
  structured fields for 100% of rows.
- **SC-004**: Pronouns can be recorded and are visible on the contact.
- **SC-005**: No existing place that displays a contact's name regresses — each still shows the effective
  display name.
- **SC-006**: Two contacts with identical first + last are flagged as likely duplicates even when one
  carries a different display-name override; a contact remains findable by searching its shown display
  name.

## Assumptions

- **First name is required; last name is optional (may be blank)** — some dancers decline to give a last
  name (clarified 2026-07-08). There is **no backfill** of existing rows: the club loads contacts fresh
  from its existing lists at go-live, and that import populates the name fields directly. The bulk-import
  mechanism itself is out of scope for this feature — this feature provides the fields the import will fill.
- **A single-name dancer, mononym, or organizational contact** enters the name as the first name with a
  blank last name (using the display-name override if a different presentation is wanted). A separate
  "organization" contact type is out of scope.
- **The display-name override is a stored value**; the effective display name is computed as
  `override ?? (first + " " + last)`, replacing today's single stored display name.
- **Pronouns are optional free text** (no controlled list).
- **Duplicate detection keys on the structured first + last name** (override-immune), while **search
  matches the effective display name** (clarified 2026-07-08). This can newly surface duplicates that a
  nickname/override previously hid — an intended improvement, not a regression.
- Single-club scale; administrator-entered data (no self-service profile editing).

## Dependencies

- **Feature 001** (contacts model, duplicate detection/normalization, contacts UI) — the contact gains
  the new fields, the create/edit surface exposes them, and duplicate detection re-keys onto the
  structured first + last name (search stays on the display name).
- **Feature 002** (door check-in) — roster sort-by-name and member-button labels.
- **Feature 006** (mailing-list export) — First/Last columns now come from the structured fields,
  replacing the current split-the-display-name heuristic.
