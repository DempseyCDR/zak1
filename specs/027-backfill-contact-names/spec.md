# Feature Specification: Backfill existing mis-split contact names (R5-P2)

**Feature Branch**: `027-backfill-contact-names`

**Created**: 2026-07-31

**Status**: Draft

**Input**: User description: "R5-P2" — Phase 5 P5-R5, Part 2 (the backfill): correct the contacts already
stored with a full name jammed into the first-name field (with no last name). Part 1 (feature 026) fixed the
capture going forward; this part repairs the historical data left behind.

## Overview

Before the capture fix (feature 026), the one route that created contacts from a single free-typed name stored
the whole name in the **first-name** field and left the **last name empty** — so records like "Chuck Abell"
sit entirely in first-name. These mis-split contacts sort, search, and de-duplicate poorly (a last-name sort
puts them all together, dedup can't line them up with a properly-structured duplicate). Feature 026 stopped
new ones from being created; this feature repairs the ones already in the directory.

The repair re-splits each mis-split contact's name into a proper **first** and **last**: the last word becomes
the last name, the words before it become the first name. Because the person's **display name**, **search
key**, and **duplicate-detection key** already derive from the full name, they are **unchanged** by the
split — the only thing that changes is that the first and last names now live in their own fields. Names with
more than one word before the final one (a compound surname like "Van Buren") are split at the **last** space
as a best-effort rule; the split is a heuristic and a rare compound surname may need a manual touch-up
afterward, which is acceptable. Nothing is merged, deleted, or otherwise altered — only the first/last fields
of the affected contacts move.

The correction is a **one-time** repair that is safe to re-run: once a contact has a last name it is never
touched again, so re-running corrects nothing further and can never re-split an already-corrected record.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Existing mis-split contacts get a proper first and last name (Priority: P1)

A contact currently stored with a full name in first-name and no last name (e.g. first-name "Chuck Abell",
last name empty) is corrected so that first name is "Chuck" and last name is "Abell". Their display name,
search results, and duplicate-detection behavior are exactly the same as before — only the first/last fields
are now populated correctly, so a last-name sort and dedup treat them like any properly-entered contact.

**Why this priority**: This is the whole feature — repairing the historical data the pre-026 bug produced.

**Independent Test**: Take a contact whose full name is in first-name with an empty last name; run the repair;
confirm first and last are now separated correctly and the display name is unchanged.

**Acceptance Scenarios**:

1. **Given** a contact with first-name "Chuck Abell" and an empty last name, **When** the repair runs, **Then**
   the contact has first name "Chuck", last name "Abell", and an **unchanged** display name "Chuck Abell".
2. **Given** the same contact, **When** the repair runs, **Then** the search key and the duplicate-detection
   key are **unchanged** (they already derived from the full name), so search and dedup behave identically.
3. **Given** a contact whose full name has three words ("David Van Buren") in first-name with an empty last
   name, **When** the repair runs, **Then** it splits at the **last** space — first name "David Van", last name
   "Buren" — leaving the display name unchanged (a compound surname may be hand-corrected later).
4. **Given** every other field on the contact (emails, phone, membership, any display-name override), **When**
   the repair runs, **Then** those are **untouched** — only first/last change.

### User Story 2 - The repair is safe: it skips already-correct contacts and is re-runnable (Priority: P1)

Contacts that already have a last name, and single-word (mononym) contacts with no space, are left completely
alone; and running the repair a second time changes nothing.

**Why this priority**: A data repair must not corrupt correct data or double-apply — safety is as important as
the correction itself.

**Independent Test**: Run the repair on a directory containing already-structured contacts and mononyms;
confirm none of them change; run it again and confirm zero further changes.

**Acceptance Scenarios**:

1. **Given** a contact that already has a last name, **When** the repair runs, **Then** it is not modified.
2. **Given** a single-word contact (no space in first-name, empty last name — a legitimate mononym), **When**
   the repair runs, **Then** it is not modified.
3. **Given** the repair has already run once, **When** it runs again, **Then** it modifies **zero** contacts
   (a corrected contact now has a last name, so it no longer matches).
4. **Given** the whole directory, **When** the repair runs, **Then** the total number of contacts is unchanged
   (nothing merged or deleted).

### Edge Cases

- **Compound / multi-word surname**: split at the **last** space only ("Mary Van Buren" → first "Mary Van",
  last "Buren"). Heuristic and lossy for true compound surnames — accepted; a manual fix afterward is fine.
- **Extra whitespace**: leading/trailing/doubled spaces are trimmed so the split is clean.
- **Mononym**: a single word with no last name is a legitimate one-name contact and is left untouched.
- **Non-person single entity**: a record that happens to be a two-word non-person name is still split (the
  repair can't tell them apart) — harmless and accepted.
- **Idempotency**: because the repair only targets contacts with an empty last name, a corrected contact (now
  having a last name) is never touched again, even on a re-run.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST re-split every **mis-split** contact — one whose **last name is empty** and whose
  **first name contains a space** — setting the **last name** to the final word and the **first name** to the
  words before it (split at the last space, trimmed).
- **FR-002**: The correction MUST leave the contact's **display name**, **search key**, and
  **duplicate-detection key** unchanged (they already derive from the full name; the split does not alter
  them).
- **FR-003**: A contact that already has a **last name**, or a single-word contact with **no space** (a
  mononym), MUST NOT be modified.
- **FR-004**: The repair MUST be **idempotent** — re-running it corrects nothing further and never re-splits an
  already-corrected contact.
- **FR-005**: The repair MUST apply to **all** mis-split contacts regardless of how they were created (not only
  the performer-sourced ones).
- **FR-006**: The repair MUST NOT delete or merge any contact; the total contact count is unchanged and only
  the first/last name fields of the affected contacts move.
- **FR-007**: The repair MUST preserve all other contact data (emails, phone, membership, any display-name
  override, source, review flags, timestamps of unrelated data).

### Key Entities *(include if data involved)*

- **Contact**: the person record. This feature moves data **within** the record — the full name currently in
  **first name** is split into **first** and **last** — while leaving the derived **display name**, **search
  key**, and **dedup key** as they are, and touching no other field.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After the repair, **zero** contacts match the mis-split signature (empty last name + a space in
  first name) — 100% corrected.
- **SC-002**: Every corrected contact's **display name is identical** before and after (no display, search, or
  dedup drift).
- **SC-003**: Re-running the repair changes **zero** contacts.
- **SC-004**: The total contact count is **unchanged** (no deletions or merges).

## Assumptions

- **"Mis-split" is defined as**: last name empty **and** first name contains a space — the exact signature the
  pre-026 single-name capture produced. (Confirmed against the current directory: such contacts exist and their
  display name equals the full first-name value.)
- **Best-effort last-space split (Q11)**: the split is a heuristic and accepted as lossy for compound surnames;
  a rare bad split is correctable by hand later. No attempt is made to recognize particles ("van", "de", "Mc").
- **Display/search/dedup are unchanged by construction**: those keys already derive from the full name, so
  splitting first/last leaves them identical — verified against the data shape.
- **Depends on feature 026**: capture is already fixed, so no new mis-split contacts are created after this
  repair; the backfill is a one-time catch-up.
- **A safety snapshot is taken before the repair** (project practice for data changes), giving a rollback path.

## Out of Scope

- The capture fix (feature 026 — already shipped).
- Merging or de-duplicating the corrected contacts (dedup is its own surface; this only fixes the fields).
- Recognizing compound-surname particles or any smarter name parsing beyond the last-space split.
- Phone normalization (R5-R6) and the dedup page's phone/email display (R5-R7).
