# Feature Specification: Contacts Page Launcher (M-R4 alteration)

**Feature Branch**: `064-contacts-launcher`

**Created**: 2026-09-02

**Status**: Draft

**Input**: User description: "Contacts page launcher redesign — alter M-R4 (feature 062)."

## Overview

When Mel opens the contacts page, the system doesn't yet know which of her three distinct maintenance
tasks she wants: **fix a single contact**, **work the needs-review contacts**, or **resolve potential
duplicates**. Today the page eagerly loads both the single-contact list and the global duplicates
section on open, which is cluttered and pushes real content below the fold.

This feature turns the initial state into an **uncluttered launcher** — just the header, the search box,
and a row of task buttons carrying live counts — and lets Mel pick her task explicitly (or implicitly by
typing). It alters the feature-062 behavior (M-R4): the always-on two-section results become on-demand
views, and the always-visible "Add contact" form moves into a modal.

Out of scope (deferred): extracting the create-contact modal into a component reused by check-in and
performers (a later feature, after the booker workflow); and a "resolved / not a duplicate" marker to
suppress reviewed false-positive pairs (deferred to the section-5 triage requirements).

## Clarifications

### Session 2026-09-02

- Q: How does a contact leave the needs-review queue? → A: `needs_review` **auto-clears** once the
  record has the required data (an email or phone on file — the condition whose absence set the flag),
  **plus** an explicit **"Mark reviewed"** override that clears the flag for a contact we know is
  unlikely to ever provide that data.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Uncluttered launcher with task counts (Priority: P1)

Mel opens the contacts page and sees a clean screen: a title, a search box ready for typing, and a row
of task buttons — **Add contact**, **Review queue (n)**, **Review duplicates (n)** — where the counts
tell her at a glance whether there is review or duplicate work waiting. No lists load until she chooses.

**Why this priority**: This is the whole point — replace the cluttered, below-the-fold default with a
clear choice of tasks. Without it the redesign delivers nothing.

**Independent Test**: open the page with seeded needs-review contacts and duplicate pairs; confirm no
result lists render initially, the three task buttons show, and the two review buttons display correct
counts.

**Acceptance Scenarios**:

1. **Given** the contacts page loads, **When** nothing has been chosen, **Then** only the header, the
   search box, and the task-button row are shown — no single-contact list, no duplicates list, no
   create form.
2. **Given** there are needs-review contacts and duplicate pairs, **When** the page loads, **Then** the
   **Review queue** button shows the count of needs-review contacts and the **Review duplicates** button
   shows the count of duplicate pairs.
3. **Given** the page loads, **When** the counts are fetched, **Then** no full result lists are fetched
   or rendered (counts only).

---

### User Story 2 - Review the needs-review queue (Priority: P1)

Mel taps **Review queue** and sees the contacts flagged as needing review (e.g. door-created or imported
without enough info). She taps one to open its record editor, fixes it, and the queue and its count
update.

**Why this priority**: One of the three core tasks, and the needs-review worklist has no surface today —
the flag is set but never queried.

**Independent Test**: seed contacts with `needs_review = true` and some without; tap Review queue and
confirm only the flagged contacts appear; open one via the record editor.

**Acceptance Scenarios**:

1. **Given** the launcher, **When** Mel taps **Review queue**, **Then** the view lists exactly the
   contacts currently flagged as needing review, and nothing that is not flagged.
2. **Given** the review-queue view, **When** Mel taps a contact, **Then** its record opens in the editor
   (the feature-063 modal editor).
3. **Given** a needs-review contact that lacks contact data, **When** Mel saves the record with an email
   or phone now on file, **Then** `needs_review` clears automatically and the contact leaves the queue
   (its count decreases).
4. **Given** a needs-review contact unlikely to ever provide contact data, **When** Mel uses **Mark
   reviewed**, **Then** `needs_review` clears, the contact leaves the queue, and the count decreases —
   even though it still has no email/phone.
5. **Given** there are no needs-review contacts, **When** Mel taps **Review queue**, **Then** she sees a
   clear empty state (and the button count reads zero).

---

### User Story 3 - Resolve potential duplicates (Priority: P1)

Mel taps **Review duplicates** and sees the global list of likely-duplicate pairs. She resolves each by
choosing which record to keep (merge), and the list and its count update.

**Why this priority**: The third core task; today the global duplicates queue only appears mixed into
the eager page load.

**Independent Test**: seed duplicate pairs; tap Review duplicates and confirm the global pairs list;
merge one and confirm it leaves the list and the count drops.

**Acceptance Scenarios**:

1. **Given** the launcher, **When** Mel taps **Review duplicates**, **Then** the view lists the global
   set of candidate duplicate pairs, each with a way to choose the surviving record.
2. **Given** the duplicates view, **When** Mel merges a pair, **Then** that pair leaves the list and the
   **Review duplicates** count decreases.
3. **Given** there are no duplicate pairs, **When** Mel taps **Review duplicates**, **Then** she sees a
   clear empty state (and the button count reads zero).

---

### User Story 4 - Find and open a single contact by typing (Priority: P1)

Mel starts typing a name. A single-contact result list appears as she types, and — because a mistyped
or near-duplicate name is a common reason she's here — any **query-scoped duplicate pairs** appear
alongside it (so while fixing "John Doe" she also sees "≈ Jonathan Doerr"). She taps a result to open
the record editor, or taps a pair to merge.

**Why this priority**: The most frequent task (fixing one contact), kept implicit so it needs no button;
retaining the 062 hybrid keeps the near-duplicate heads-up that prevents Mel creating/keeping dupes.

**Independent Test**: type a query; confirm matching single contacts appear and, when a near-duplicate
exists, its pair appears alongside; open a contact; clearing the box returns to the launcher.

**Acceptance Scenarios**:

1. **Given** the launcher, **When** Mel types a query, **Then** the matching single-contact results
   appear, together with the query-scoped duplicate pairs for that query.
2. **Given** typed results, **When** Mel taps a single contact, **Then** its record opens in the editor.
3. **Given** typed results, **When** Mel taps a duplicate pair, **Then** the merge flow for that pair
   runs.
4. **Given** a query is showing results, **When** Mel clears the search box (and no task view is
   active), **Then** the page returns to the bare launcher (no lists).

---

### User Story 5 - Add a contact from a modal (Priority: P2)

Mel taps **Add contact** and the create form opens in a **modal** over the launcher (instead of an
always-visible form at the bottom). She fills it in and submits; the modal closes and the page reflects
the new contact (results/counts refresh). Cancel/Escape closes it without creating anything.

**Why this priority**: Adding contacts must stay possible, but making it a modal is what keeps the
initial state uncluttered; it layers cleanly on US1.

**Independent Test**: tap Add contact → a modal create form opens; submit a valid contact → modal closes
and the page updates; Cancel → modal closes, nothing created.

**Acceptance Scenarios**:

1. **Given** the launcher, **When** Mel taps **Add contact**, **Then** the create form opens as a modal
   over the page (the always-visible bottom form is gone).
2. **Given** the create modal, **When** Mel submits a valid new contact, **Then** the contact is created,
   the modal closes, and the page refreshes so the new contact and the counts reflect it.
3. **Given** the create modal, **When** Mel cancels (button or Escape), **Then** the modal closes and no
   contact is created.

---

### Edge Cases

- **Only one task view at a time**: choosing a task button shows that view; typing switches to the
  search view; the three are mutually exclusive so the screen never stacks multiple lists.
- **Counts vs. lists divergence**: after Mel acts (merges a pair, clears a review flag) the relevant
  count and the visible list stay consistent on the next refresh.
- **Empty states**: each task view (review queue, duplicates, and a typed query with no matches) shows a
  clear empty message rather than a blank region.
- **Large needs-review / duplicate sets**: the review-queue and duplicates lists cap their length the
  same way search results do (a bounded page with a "refine / more" indication), while the button counts
  report the true totals.
- **Returning from a task**: closing the record editor or finishing a merge returns Mel to the view she
  was in (review queue, duplicates, or search), not to a blank page.
- **Door-created contacts**: a door-created contact is flagged for review even if it has a phone; the
  auto-clear (FR-012) will lift the flag once it has the required data, and **Mark reviewed** (FR-013)
  covers any that should be dismissed without it. (The precise required-data predicate per flag-reason is
  settled in planning; the default is "an email or phone on file".)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: On load the contacts page MUST show only the header, the search box, and a task-button row
  (**Add contact**, **Review queue**, **Review duplicates**) — no single-contact list, no duplicates
  list, and no always-visible create form.
- **FR-002**: On load the system MUST fetch only the two **counts** — the number of needs-review
  contacts and the number of candidate duplicate pairs — and MUST NOT fetch or render any full result
  list.
- **FR-003**: The **Review queue** and **Review duplicates** buttons MUST each display their current
  count.
- **FR-004**: Tapping **Review queue** MUST show a list of exactly the contacts currently flagged as
  needing review (a new needs-review filter), and nothing that is not flagged. Tapping a contact MUST
  open its record editor.
- **FR-005**: Tapping **Review duplicates** MUST show the global set of candidate duplicate pairs, each
  offering a choice of surviving record; merging a pair MUST remove it from the list.
- **FR-006**: Typing a query MUST show the matching single-contact results **and** the query-scoped
  duplicate pairs for that query (retaining the feature-062 hybrid). Tapping a single result opens the
  record editor; tapping a pair runs the merge flow.
- **FR-007**: The three views (search results, review queue, duplicates) MUST be **mutually exclusive** —
  only one shows at a time; typing switches to the search view; clearing the search with no active task
  returns to the bare launcher.
- **FR-008**: Tapping **Add contact** MUST open the create form as a **modal** over the page; the
  always-visible bottom create form MUST be removed. Submitting a valid contact MUST create it, close
  the modal, and refresh the page (results + counts); Cancel/Escape MUST close it with no contact
  created.
- **FR-009**: After an action that changes a count (creating a contact, clearing a review flag, merging
  a pair), the affected count MUST refresh so the button reflects the new total.
- **FR-010**: The system MUST NOT provide a "browse all contacts" listing; contacts are reached only by
  searching, the review queue, or the duplicates queue.
- **FR-011**: The needs-review list and the duplicates list MUST bound their rendered length like search
  results do, while the button counts report the true totals.
- **FR-012**: When a needs-review contact is saved and now has the **required data** (at least one email
  or phone on file), the system MUST clear its `needs_review` flag automatically so it leaves the queue.
- **FR-013**: The record editor MUST offer a **"Mark reviewed"** action that clears `needs_review` for a
  contact the reviewer judges unlikely to ever provide the required data, removing it from the queue even
  with no email/phone on file.

### Key Entities

- **Contact**: reached three ways here — by search match, by the needs-review flag, or as a member of a
  duplicate pair. The needs-review flag (`needs_review`) already exists and is set on import/door-created
  contacts; this feature adds a way to **query** contacts by it and two ways for it to **clear**
  (auto-clear when required data is present, and a manual "Mark reviewed").
- **Duplicate pair**: a candidate A↔B pairing from the existing duplicate-detection engine; the global
  queue (no query) and the query-scoped set (with a query) are both surfaced.
- **Counts**: two lightweight totals shown on the task buttons — needs-review contacts and candidate
  duplicate pairs.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On load, a signed-in Mel sees only the header, search box, and task-button row with the
  two counts — zero result-list content — in 100% of loads.
- **SC-002**: From the launcher, each of Mel's three tasks (fix one contact, work the review queue,
  resolve duplicates) is reachable in **one tap or the first keystroke**, with no scrolling past unrelated
  content.
- **SC-003**: The **Review queue** view shows exactly the needs-review contacts (no false inclusions,
  no omissions) against a seeded data set.
- **SC-004**: After Mel merges a duplicate or clears a review flag, the corresponding button count is
  correct on the next view within one refresh (no stale count requiring a page reload).
- **SC-005**: Adding a contact is completed entirely within the modal, and the launcher returns
  uncluttered afterward with the new contact reflected in search/counts.

## Assumptions

- The record editor opened from a result/queue row is the feature-063 modal editor (already shipped); no
  change to it here beyond being the open target.
- The duplicate-detection engine and merge flow are the existing ones (features 033/062); this feature
  changes only how/when the pairs are surfaced, not how they are detected or merged.
- The needs-review count and the duplicate-pair count are cheap to compute (queries), so fetching them
  on load does not meaningfully delay the page; no new caching is introduced.
- No schema change is expected — `needs_review` already exists and the counts derive from existing data;
  this feature adds a needs-review query/filter, count surfacing, and clear logic (auto-clear on save
  when required data is present, and a "Mark reviewed" action) on the existing column.
- The create-contact form's fields and validation are unchanged; only its placement moves into a modal
  with an after-create callback that refreshes the page. Reuse of that modal by other screens is out of
  scope here.
- "Uncluttered" and the modal presentation follow the existing mobile-first admin patterns (features
  060/063); no new visual system is introduced.
