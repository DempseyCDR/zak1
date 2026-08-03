# Feature Specification: Dedup review shows phone + email alongside display name

**Feature Branch**: `033-dedup-phone-email`

**Created**: 2026-08-03

**Status**: Draft

**Input**: User description: "P5-R7"

## User Scenarios & Testing *(mandatory)*

The duplicate-review page proposes pairs of contacts that look like the same person (matched on name). But
name alone is ambiguous — two different "Chris Smith"s look identical, and the reviewer can't tell a real
duplicate from a coincidence. Showing each candidate's **phone and email** next to the name lets the reviewer
decide with confidence.

### User Story 1 - See phone and email for each proposed duplicate (Priority: P1)

The reviewer opens the duplicate-review queue. For every proposed pair, each of the two candidates shows its
**display name, phone, and email** — so the reviewer can compare the two and tell whether they are the same
person before merging.

**Why this priority**: This is the whole feature — the disambiguating information the reviewer needs. Without
it, the queue forces a guess on name alone.

**Independent Test**: Open the review queue with a proposed pair → each candidate shows its display name,
phone, and email; a reviewer can distinguish two same-name contacts whose phone/email differ.

**Acceptance Scenarios**:

1. **Given** a proposed duplicate pair, **When** the reviewer views it, **Then** each candidate shows its
   **display name, phone, and email** (the merge controls are unchanged).
2. **Given** two coincidentally same-name contacts with **different** phones and emails, **When** the pair is
   shown, **Then** the differing phone/email are visible so the reviewer can tell they are **not** the same
   person.
3. **Given** two same-name contacts with the **same** phone or email, **When** the pair is shown, **Then** the
   matching contact detail is visible, supporting a confident merge.

---

### Edge Cases

- **No phone** on a candidate: the row shows a clear "no phone" indication (not a blank that reads as an
  error).
- **No email** on a candidate: the row shows a clear "no email" indication.
- **Multiple emails**: a contact with more than one active email shows each; a contact whose only emails are
  inactive shows "no email" (inactive addresses are not offered as current contact info).
- **Unparseable stored phone** (kept raw by the phone-normalization feature): shown exactly as stored, not
  mangled.
- **No proposed pairs**: the queue's existing empty state is unchanged.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: For each proposed duplicate pair, the review page MUST show, for **both** candidates, their
  **phone** and **email** alongside the display name.
- **FR-002**: The phone MUST be shown in the standard **dashed** display format; a raw/unparseable stored
  phone MUST be shown as stored; a candidate with **no phone** MUST show a clear "no phone" indication.
- **FR-003**: The email(s) shown MUST be the contact's **active** email address(es) — all of them when there
  is more than one; a candidate with **no active email** MUST show a clear "no email" indication.
- **FR-004**: The dedup **matching** — which pairs are proposed and in what order — MUST be **unchanged**.
  This is a display-only addition; matching on phone/email remains out of scope (deferred).
- **FR-005**: The suggestion data feeding the review page MUST include, per candidate, the phone and the
  active email addresses.
- **FR-006**: The **merge** action and all other page behavior (empty state, similarity display, keep-left /
  keep-right controls) MUST be unchanged.

### Key Entities

- **Merge suggestion**: a proposed pair of contacts to review. Each candidate carries **display name**,
  **membership status** (existing), and now **phone** and **active email(s)**.
- **Contact**: the directory record — its **phone** (canonical form) and its **emails** (each with an
  active/inactive status) are surfaced per candidate. (Existing; unchanged.)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For 100% of proposed pairs, the reviewer sees each candidate's phone and email on the queue
  without opening another page.
- **SC-002**: Two coincidental same-name contacts with different phone/email are visibly distinguishable on
  the queue (the reviewer can decide **not** to merge without further lookup).
- **SC-003**: Phones display in the standard dashed format (raw for unparseable); missing phone or email is
  clearly indicated rather than shown as a blank/error.
- **SC-004**: The set and order of proposed pairs is **identical** to before this change (matching unchanged).

## Assumptions

- **Active emails only**: "email" means the contact's **active** email address(es); transition/inactive
  addresses are not shown as current contact info. All active addresses are shown when a contact has more than
  one.
- **Phone display reuses the normalization feature**: the dashed display format comes from the shipped phone
  helper (feature 032); this feature does not re-derive it.
- **Display-only**: no change to the dedup matching, the merge logic, or the merge endpoint — only the
  suggestions data gains phone + emails and the page renders them. Matching on phone/email stays deferred
  (backlog).
- **Benefits from prior work**: clean structured names (026/027) and canonical phones (032) make the shown
  details reliable; both are already shipped.
- **No new authority**: the page's existing access rules are unchanged (the duplicate-review capability still
  governs it).
