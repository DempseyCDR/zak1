# Feature Specification: Consistent structured name capture when creating a performer (R5-P1)

**Feature Branch**: `026-structured-name-capture`

**Created**: 2026-07-31

**Status**: Draft

**Input**: User description: "R5-P1" — Phase 5 P5-R5, Part 1 (the capture fix): contact-name capture should
be consistent and collect **first name, last name, and display name separately**. Some creation routes today
capture only a single "name" and store the whole thing in the contact's first-name with no split, while others
already capture first/last. This part fixes the **capture**; back-filling existing mis-split records is a
separate part (R5-P2).

## Overview

When staff add a **performer** who is not already in the directory, the system silently creates a contact for
that person — but it captures only a **single name** and stores the whole thing as the contact's **first
name**, with the last name left empty. Every other place that creates a contact — the door check-in "new
contact" form and the contacts directory — already captures **first name, last name, and an optional display
name** separately. That inconsistency produces bad contact data ("Chuck Abell" sitting entirely in first-name),
which breaks name sorting, searching, and duplicate detection, and makes the person's record look wrong
everywhere it appears.

This feature makes performer creation capture names the **same structured way** as the other flows: first name
and last name (last name optional for a single-name performer), plus an optional display-name override for a
stage name that isn't a plain "First Last". The performer's own display name continues to work as it does
today, now derived from those structured names. The result: a contact created by adding a performer is
indistinguishable, in data quality, from one created at the door or in the directory.

Scope is the **capture** only. Repairing contacts already mis-split in the data is a separate part (R5-P2), and
this feature changes no existing records.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Add a new performer with a proper first and last name (Priority: P1)

A staff member adds a performer who isn't in the directory yet (e.g. booking a new caller). They enter the
performer's **first name and last name** (and, if needed, a display name), and the contact the system creates
for that performer has those names stored **separately** — first in first-name, last in last-name — just like a
contact added at the door.

**Why this priority**: This is the whole feature — the one creation path that mis-captures names, fixed to
match the rest. Everything else is a consequence of it.

**Independent Test**: Add a brand-new performer entering a first and last name; confirm the created contact has
the first name and last name in their own fields (not the full name jammed into first-name), and the display
name reads correctly.

**Acceptance Scenarios**:

1. **Given** a performer who is not an existing contact, **When** staff create the performer with first name
   "Chuck" and last name "Abell", **Then** the created contact stores first name "Chuck" and last name "Abell"
   separately, and the display name reads "Chuck Abell".
2. **Given** the same creation, **When** the performer record is created, **Then** the performer's own display
   name matches the contact's display name (no change to how the performer is shown in bookings/reports).
3. **Given** a performer with a one-word name (e.g. "Fiddlehead"), **When** staff create them with only a first
   name, **Then** the contact is created with that first name, an empty last name, and a sensible display name
   — creation is not blocked.
4. **Given** a performer whose shown name differs from "First Last" (a stage name), **When** staff provide a
   display-name override, **Then** the contact keeps the structured first/last **and** shows the override as
   its display name.

### User Story 2 - Consistent capture across every add-performer surface (Priority: P1)

Wherever a staff member can create a brand-new performer — the performers directory and the add-performer
step inside the booking flow — the **same** structured name fields are presented, so the data quality does not
depend on which screen was used.

**Why this priority**: The inconsistency the feature removes is *between surfaces*; fixing one screen but not
the other would just move the problem.

**Independent Test**: Create a new performer from the performers page and again from the add-performer step in
the booking flow; both produce a contact with structured first/last names.

**Acceptance Scenarios**:

1. **Given** the add-performer step in the booking flow, **When** staff create a brand-new performer, **Then**
   they capture first/last (and optional display) and the contact is structured — identical to the performers
   page.
2. **Given** any add-performer surface, **When** staff instead **link an existing contact** to the performer,
   **Then** no new name is captured and the existing contact's names are used unchanged.

### Edge Cases

- **One-word name (mononym)**: last name is optional; the person is created with a first name only and a
  sensible display name; creation is never blocked for lack of a last name.
- **Display name differs from First + Last** (stage name): the structured first/last are still stored, and the
  provided display override is what shows.
- **Linking an existing contact**: when the performer is tied to a contact that already exists, the feature
  captures no name and leaves that contact's names untouched.
- **Extra whitespace / casing**: entered names are handled the same way the existing structured flows handle
  them (trimmed; display derived consistently), so performer-created contacts match door/directory contacts.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: When creating a performer that requires a **new** contact, the system MUST capture **first name**
  and **last name** as separate values (last name optional), plus an **optional display-name override** — the
  same structured shape used by the door check-in and contacts-directory creation flows.
- **FR-002**: The contact created for a new performer MUST store the first name and last name in their **own**
  fields (never the full name combined into first-name) and derive its display name the **same way** as the
  other structured flows.
- **FR-003**: The performer's own display name MUST continue to be available and correct (derived from the
  captured names or the display override), with **no change** to how the performer appears in bookings and
  reports.
- **FR-004**: **Every** staff surface that can create a brand-new performer (the performers directory and the
  add-performer step in the booking flow, at minimum) MUST present the structured first/last/display capture.
- **FR-005**: When a performer is instead **linked to an existing contact**, the system MUST NOT require or
  capture a new name and MUST leave that contact's stored names unchanged.
- **FR-006**: A performer with only a **single word** for a name MUST be creatable (last name optional) and
  MUST NOT be blocked or forced to duplicate the name across fields.
- **FR-007**: This feature MUST NOT alter any existing contact records; correcting already-mis-split contacts
  is out of scope (handled by R5-P2).

### Key Entities *(include if data involved)*

- **Contact**: the person record; carries **first name**, **last name**, an optional **display-name override**,
  and a derived **display name**. This feature ensures a performer-created contact populates these the same way
  the door and directory flows do.
- **Performer**: the bookable talent record linked to a contact; carries its own **display name**, now derived
  from the contact's structured names / override rather than a single free-typed name.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of contacts newly created via performer creation have the first and last name in their own
  fields — zero cases of a full name stored entirely in first-name.
- **SC-002**: The add-performer surfaces present the same first/last/display fields as the door check-in and
  contacts-directory forms (verifiable by inspection of each create surface).
- **SC-003**: Creating a performer with a single-word name succeeds every time (never blocked for a missing
  last name).
- **SC-004**: No regression — linking an existing contact captures no name, and performer display in bookings
  and reports is unchanged.

## Assumptions

- **Reuses the existing structured-name shape**: the target is the exact first/last/display derivation the door
  check-in and contacts-directory flows already use — this feature aligns performer creation to it, it does not
  invent a new shape.
- **Public membership capture is out of scope**: the public join form parks a raw captured name for admin
  review (it does not create a contact directly — the contact is later created through the already-structured
  directory path), so it is not one of the "stored in the contact's first-name" routes this feature targets.
- **No data backfill**: existing mis-split contacts are corrected separately (R5-P2); this feature is
  capture-only and touches no existing records, so it needs no data migration.
- Money and other domains are unaffected — this is a contact-data-quality change confined to performer
  creation.

## Out of Scope

- Back-filling / re-splitting contacts already stored with a full name in first-name (that is R5-P2).
- The public membership (join) capture form.
- Phone-number normalization (P5-R6) and the dedup page's phone/email display (P5-R7) — separate Phase 5
  requirements.
- Any change to how existing contacts, bookings, reports, or dedup behave beyond the corrected capture.
