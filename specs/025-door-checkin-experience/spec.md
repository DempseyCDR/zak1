# Feature Specification: Door-attendant check-in experience — roster corrections + selection & entry polish

**Feature Branch**: `025-door-checkin-experience`

**Created**: 2026-07-30

**Status**: Draft

**Input**: User description: "area C" — Phase 4 Area C: the door-attendant (Meg) check-in experience. A UX
polish layer over feature 017 (check-in) and 016 (role-aware nav), plus a new **roster correction** capability
so the door attendant can fix an attendance record after it was taken. Meg holds `attendance.write` only (no
money — that is the Financial Secretary's gate); roles are combinable.

## Overview

Meg runs the door and checks dancers in. The happy path (search → comp → children → confirm) already exists,
but in real use she loses time and makes errors: the event selector starts blank and unsorted so she picks the
wrong event; the per-check-in options sit in a detached panel that reads as a confusing extra step; an
anonymous head-count admission silently drops its children; focus doesn't return to the search box between
dancers; and — most importantly — **there is no way to correct the roster once a name is on it**. A dancer gets
listed but isn't present, or has the wrong number of children, or was an "unmatched" admission who has since
been identified, or was checked into the wrong event of a same-day group. Today attendance is take-only.

This feature makes the door attendant able to **find the right event fast**, **check dancers in with one
inline row**, and **correct any single roster entry from the roster itself** — delete a not-present record,
fix a children count, reassign an unmatched admission to a contact, toggle open-band, nudge the comp/gift
tallies, or move a dancer to a sibling event in the same group — while the event's recorded head count stays
exact after every change. Accounting stays **counts-only and un-attributed**: Meg's per-person edits keep the
source roster accurate; the Financial Secretary still sets the final aggregate totals on the gate (her
override supersedes for money). Corrections require `attendance.write`, so anyone holding the Door Attendant
capability (whether or not they are also the FS) can make them.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Correct a roster entry after the fact (Priority: P1)

While the door is running (or afterward on a recent event), Meg spots a problem on the roster and fixes it in
place. She clicks the roster row and, in a correction view, does exactly one of: **delete** an attendance that
was recorded in error (the person didn't actually come); **change the children count**; **reassign an
unmatched/anonymous admission** to a real contact once she knows who it was; **adjust the comp or gift-card
tally** by one; **toggle open-band** participation for that person; or **move the dancer to a sibling event**
in the same group (she was checked into the community dance but belongs on the contra, or vice-versa). After
any of these the event's recorded head count is still exactly right.

**Why this priority**: This is the one genuinely missing capability (attendance is take-only today) and the
main source of inaccurate rosters and head counts. It is the feature's core value; everything else is polish.

**Independent Test**: On an event with a mixed roster (matched people, an unmatched head-count admission, some
with children), open a roster row and perform each correction; confirm the roster and the recorded head count
reflect the change and never drift from "present admissions + their children."

**Acceptance Scenarios**:

1. **Given** a person listed on the roster who did not attend, **When** Meg deletes that attendance, **Then**
   the person is removed from the roster and the head count drops by one plus that record's children.
2. **Given** an attendance with the wrong children count, **When** Meg changes it, **Then** the record shows
   the new count and the head count moves by exactly the difference.
3. **Given** an unmatched (anonymous) admission that Meg can now identify, **When** she reassigns it to a
   contact, **Then** the admission is attributed to that contact; if that contact is already on the event the
   reassignment is refused and no duplicate is created.
4. **Given** a dancer checked into the wrong event of a same-day group, **When** Meg moves them to the sibling
   event, **Then** they leave the source event's roster and appear on the target's, the source head count
   decreases and the target increases by one plus children; a move to a **non-sibling** event, or to an event
   where the dancer is **already checked in**, is refused; and moving an **open-band** admission to a
   non-community-dance sibling clears its open-band marker and decrements the source event's open-band count.
5. **Given** a comp or gift-card was miscounted, **When** Meg adjusts it by one in the correction view, **Then**
   the event's aggregate comp / gift-card tally changes by one (never below zero) and nothing is stored against
   an individual person.
6. **Given** any roster row (matched or unmatched), **When** Meg toggles open-band for that person, **Then**
   that person's open-band participation flips and the count of open-band musicians reflects it.

### User Story 2 - Land on the right event without hunting (Priority: P1)

When Meg opens check-in, the event selector already shows the event she almost certainly wants — the one
happening today, or the most recent past one — and the list is ordered newest-relevant-first with enough detail
to tell same-day events apart.

**Why this priority**: Picking the wrong event silently mis-files every check-in and every correction; a good
default and ordering prevents a whole class of errors and is cheap. Pairs with US1 (corrections happen on
recent events).

**Independent Test**: With several events spanning past/today/future, open check-in and confirm the selector
pre-selects the most recent event on or before today and lists events in descending date/time order with a
readable label.

**Acceptance Scenarios**:

1. **Given** events before, on, and after today, **When** Meg opens check-in, **Then** the selector defaults to
   today's event if one exists, otherwise the latest event before today.
2. **Given** multiple events, **When** the selector is shown, **Then** they are ordered by date and start time,
   newest first.
3. **Given** two events on the same day, **When** Meg reads the selector, **Then** each option shows the date,
   the start time, and the event label so she can tell them apart.

### User Story 3 - One-line check-in with everything on the row (Priority: P2)

Each candidate — a matched search hit, a brand-new "no match" contact, or an anonymous head-count admission —
carries its comp toggle, children count, and confirm button on its own row, and after Meg confirms, focus
returns to the search box so she can immediately type the next dancer.

**Why this priority**: Removes the "confusing detached panel" and the biggest per-dancer friction, and makes
children work on the anonymous path (today it silently drops). Speeds the line but doesn't add new capability,
so below US1/US2.

**Independent Test**: Check in a matched person, a new contact, and an anonymous admission — each with children
— confirming that the options are inline, the children count persists on every path (including anonymous), and
focus lands back on search after each confirm.

**Acceptance Scenarios**:

1. **Given** a search hit / new-contact / anonymous row, **When** Meg views it, **Then** comp, children, and
   confirm are on that same row (no separate global panel).
2. **Given** an anonymous head-count admission with children, **When** Meg confirms it, **Then** the children
   are recorded in the head count (not dropped).
3. **Given** a just-confirmed check-in, **When** the row clears, **Then** the search box regains focus for the
   next entry.

### User Story 4 - Reach staff tools from the home page (Priority: P2)

After a staff member signs in and lands on the home page, they see their role-aware staff navigation there —
not only inside a tool — so Meg (or anyone) can reach check-in directly from the landing page.

**Why this priority**: A visibility gap — the nav is already computed and tested, just not shown on the home
page. Small, independent, improves every staff member's first click.

**Independent Test**: Sign in as a door attendant and confirm the home page shows the staff nav (with check-in)
distinct from the public nav; a combined-role user sees the union of their tools.

**Acceptance Scenarios**:

1. **Given** a signed-in staff member on the home page, **When** the page renders, **Then** their role-aware
   staff navigation appears, kept separate from the public navigation.
2. **Given** a person holding more than one role, **When** the staff nav renders, **Then** it shows the union
   of the tools their roles grant.

### User Story 5 - Retire the redundant "open door record" step (Priority: P3)

The manual "open door record" button on the check-in surface is removed; the door record is ensured
automatically on the first check-in (and independently by the gate), so Meg never sees an internal setup step.

**Why this priority**: Pure cleanup of vestigial scaffolding; no behavior Meg relies on. Lowest priority.

**Independent Test**: On a fresh event with no door record, check someone in and confirm it succeeds with no
manual "open door record" step present.

**Acceptance Scenarios**:

1. **Given** an event with no door record yet, **When** Meg checks in the first dancer, **Then** the check-in
   succeeds without her opening a door record manually, and no such button is shown.

### Edge Cases

- **Head count never goes negative or drifts**: deleting a record, editing children, or moving a dancer always
  keeps the event's recorded head count equal to present admissions plus their children; a delete that would go
  below zero is impossible because the count is derived from real records.
- **Reassign to someone already present**: reassigning an unmatched admission to a contact already on the
  roster is flagged as a duplicate and does not create a second entry for that person.
- **Ungrouped event**: when an event has no group siblings, the "move to sibling event" option is unavailable
  (there is nowhere valid to move).
- **Move target validation**: a move request naming an event that is not a genuine same-group sibling is
  refused, regardless of what the door surface offered.
- **Move onto someone already present**: moving a dancer to a sibling where that dancer is already checked in
  is refused (same no-duplicate rule as reassign), so the move never creates a second entry.
- **Move an open-band admission across series**: a group typically pairs a community dance with a different
  series (e.g. contra); moving an open-band admission to the non-community-dance sibling clears its open-band
  marker (open-band is a community-dance-only role) and decrements the source event's open-band count, so no
  non-community-dance event carries an open-band admission and the aggregate open-band count is never stranded.
- **comp/gift below zero**: a downward comp/gift adjustment stops at zero.
- **Same-day grouped pair**: moving a dancer back and forth between two grouped events (community dance ↔
  contra) works in both directions and leaves both head counts correct.
- **Meg vs. the FS on totals**: Meg's per-person corrections keep the source roster accurate; the FS's later
  aggregate override on the gate supersedes for final accounting — the two do not conflict because they own
  different things (source accuracy vs. money totals).
- **Correcting a past event**: corrections are not limited to "today"; a recent past event can be corrected
  (the default-recent selection and descending sort make it reachable).

## Requirements *(mandatory)*

### Functional Requirements

#### Roster corrections (US1)

- **FR-001**: A door attendant MUST be able to open a correction view for any single roster entry (matched or
  unmatched) directly from the roster.
- **FR-002**: The system MUST let the attendant **delete** an attendance recorded in error; the event's
  recorded head count MUST decrease by one plus that record's children.
- **FR-003**: The system MUST let the attendant **change a record's children count**; the head count MUST
  adjust by exactly the difference.
- **FR-004**: The system MUST let the attendant **reassign an unmatched/anonymous admission to a contact**, and
  MUST **refuse** the reassignment when that contact is already checked in on the event, so no duplicate is
  created.
- **FR-005**: The system MUST let the attendant **move a dancer to a sibling event within the same group**, in
  either direction; the source event's head count MUST decrease and the target's increase by one plus children.
  The move MUST be **refused** when that dancer is already checked in on the target event (no duplicate). When
  the moved record is an **open-band** admission and the target event is **not** a community dance, the move
  MUST clear the record's open-band marker and decrement the source event's open-band count — so no
  non-community-dance event ever carries an open-band admission and the open-band count stays consistent.
- **FR-006**: A move MUST be validated so the target is a genuine same-group sibling; a non-sibling target MUST
  be refused, never trusting a client-supplied target.
- **FR-007**: The system MUST let the attendant adjust the event's **comp** and **gift-card** tallies by ±1;
  these are aggregate counts on the event (not stored per person) and MUST NOT go below zero.
- **FR-008**: The system MUST let the attendant toggle a person's **open-band** participation per record.
  Open-band is valid **only at a community dance** (turning it on elsewhere is refused, as at check-in); see
  FR-005 for how moving an open-band admission off a community dance clears it.
- **FR-009**: After any correction, deletion, or move, the event's recorded head count MUST equal the number of
  present admissions plus their children (no drift).
- **FR-010**: The system MUST expose an event's **same-group sibling events** as the valid move targets, and
  return none when the event is ungrouped.

#### Finding the right event (US2)

- **FR-011**: The check-in event selector MUST default to the most recent event on or before today (today's if
  one exists, otherwise the latest past event); it defaults to none only when no events exist.
- **FR-012**: Events in the selector MUST be ordered by date and start time, newest first.
- **FR-013**: Each selector option MUST show the event's date, start time, and label.

#### Streamlined check-in (US3)

- **FR-014**: Comp, children count, and confirm MUST appear inline on each candidate row (matched hit,
  new-contact, and anonymous admission), replacing the detached global panel.
- **FR-015**: The children count MUST be accepted and persisted on **all** admission paths, including an
  unmatched/anonymous head-count admission.
- **FR-016**: After a confirmed check-in, input focus MUST return to the search box.

#### Staff navigation (US4)

- **FR-017**: After sign-in, the home page MUST render the signed-in member's role-aware staff navigation,
  distinct from the public navigation, showing the union of the tools their roles grant.

#### Cleanup (US5)

- **FR-018**: The check-in surface MUST NOT present a manual "open door record" action; the door record MUST be
  ensured automatically on the first check-in.

#### Cross-cutting

- **FR-019**: All roster corrections (delete, children edit, reassign, move, comp/gift adjustment, open-band
  toggle) MUST require the `attendance.write` capability and be available to anyone holding it, whether or not
  they also hold the Financial Secretary role.
- **FR-020**: Every correction, deletion, and move MUST be recorded so the change is traceable after the fact.

### Key Entities *(include if data involved)*

- **Attendance record**: one dancer's admission to an event — the person (a contact, or unmatched/anonymous), a
  children count, and open-band participation. Amended here by children edits, reassignment, open-band toggle,
  deletion, and moves to a sibling event.
- **Event**: the dance being checked into; carries a recorded head count kept consistent with its attendance
  records, a start time and label used in the selector, and a group membership.
- **Event group**: the set of events sharing a group (e.g. a same-day community dance and contra); defines the
  valid targets for a move and is the boundary a move may not cross.
- **Door-record tallies**: the event's aggregate comp and gift-card counts (counts-only, un-attributed),
  adjusted by ±1 in the correction view; the Financial Secretary's later gate override supersedes for money.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On opening check-in for a day with an event, Meg reaches the correct event with no manual
  selector change in the common case (event today or most recent past).
- **SC-002**: Any single roster error (not-present, wrong children, unmatched-now-known, wrong grouped event,
  mis-tallied comp/gift, open-band) can be corrected from the roster in one modal interaction, without leaving
  the check-in page.
- **SC-003**: After any sequence of corrections, deletions, and moves, the event's recorded head count equals
  present admissions plus their children 100% of the time (zero drift).
- **SC-004**: An unmatched admission entered with children retains those children in the head count in 100% of
  cases (no silent loss).
- **SC-005**: A move to a non-same-group event is refused in 100% of attempts.
- **SC-006**: After each confirmed check-in the attendant can type the next search immediately, with no manual
  click to refocus.
- **SC-007**: No regression to the existing check-in happy path, the role-aware navigation, or the Financial
  Secretary's aggregate gate override.

## Assumptions

- **Builds on 017 and 016**: the search → comp → children → confirm happy path and the role-aware nav
  derivation already exist; this feature is a polish layer plus the new correction capability.
- **Expired-session redirect already shipped**: the "401 → `/login`" fix (backlog B41) shipped as feature 022;
  the check-in surface already redirects on an expired session, so it is **out of scope** here.
- **Counts-only accounting (decision B)**: comp and gift-card are aggregate counts on the event, never stored
  per person; open-band is the one per-person toggle. B29 ("never attributed") stands.
- **Roles**: the Door Attendant holds `attendance.write` only (no money entry); roles are combinable, so nav is
  the union of a person's capabilities, and corrections are open to any `attendance.write` holder (including the
  FS).
- **Moves are group-bounded**: a dancer may be moved only to an event sharing the same group (feature 010's
  event groups); arbitrary/free-form event moves are out of scope.
- **Meg vs. Mary split**: Meg's per-person edits keep the source roster and head count accurate; the FS
  overrides the aggregate totals on the gate for final accounting (her override wins for money). The FS does
  **not** do per-person corrections.
- **Nice-to-have (may be deferred)**: checking a dancer into **both** events of a group in one action is a
  convenience, not required for this feature to deliver value.

## Out of Scope

- Financial Secretary per-person roster corrections (the FS only overrides aggregate totals on the gate).
- Moving a dancer to an arbitrary event outside its group.
- Any change to the money/gate accounting model beyond the comp/gift/open-band source counts Meg maintains.
- The expired-session redirect (already delivered by feature 022).
