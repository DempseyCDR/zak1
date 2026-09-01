# Feature Specification: Contact Maintenance Search — Two Sections + Focus

**Feature Branch**: `062-contact-search-sections`

**Created**: 2026-09-01

**Status**: Draft

**Input**: User description: "M-R3 and M-R4"

Source requirements: `specs/phase-8-requirements/mel-contact-maintenance.md` §3 — **M-R3** (Mel's
maintenance search reuses the check-in pattern: fuzzy, focus-to-search) and **M-R4** (results render in
**two sections** — single contacts to select, and potential duplicates to review, the latter routing
into the merge flow). Builds on feature 060 (the contacts surface) and 061 (the shared search).

## Clarifications

### Session 2026-09-01

- Q: Is the duplicates section query-scoped, the global dedup queue, or hybrid? → A: **Hybrid** —
  query-scoped duplicate candidates when there is a query; the roster-wide global dedup queue when the
  search box is empty.
- Q: What is each duplicates-section entry — a pair or a suspect contact? → A: **Candidate pairs** (A ↔ B);
  selecting a pair opens the merge of that specific pair.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Two-section search results (Priority: P1)

Mel searches the contact roster to maintain a record. The results split into two clearly separated
sections: **(a) single contacts** she can pick to open and edit, and **(b) potential duplicates** —
contacts that look like the same person — which she can review and merge while she's here. Today the
maintenance surface shows a single flat list, so duplicates are invisible at the moment she's most able
to fix them.

**Why this priority**: The two-section split is the substance of the feature. It turns search into both
a lookup and a cleanup opportunity, and it's what makes "maintain the roster" tractable — duplicates
surface exactly when Mel is looking at the affected names.

**Independent Test**: Search a name that matches several contacts, some of which are duplicates: the
single-contacts section lists the matches (each opens its record), and the duplicates section lists the
duplicate candidate(s); selecting a duplicate opens the merge flow.

**Acceptance Scenarios**:

1. **Given** a query that matches contacts, **When** results render, **Then** matching contacts appear in
   the **single-contacts** section, each selectable to open its record.
2. **Given** the query's matches include a likely-duplicate pair (similar structured name), **When**
   results render, **Then** that pair appears in a separate **potential-duplicates** section.
3. **Given** a candidate pair, **When** Mel selects it, **Then** she is taken into the merge flow for that
   specific pair.
4. **Given** a query whose matches have no duplicates, **When** results render, **Then** the
   potential-duplicates section is absent or shows a clear empty state (it does not clutter the view).

---

### User Story 2 - Focus-to-search (Priority: P2)

Mel maintains many records in a row. The search field should be ready for typing the moment the page
loads, and regain focus after she finishes an action, so she can keep working without reaching for the
mouse — the same "focus-to-search" behavior the door check-in screen already has.

**Why this priority**: An ergonomic multiplier for repetitive maintenance. P2 because the two-section
results (US1) deliver the core value; this makes the flow fast.

**Independent Test**: On load, the search field is focused (typing goes straight to it). After completing
an action (e.g. opening/closing a record), focus returns to the search field.

**Acceptance Scenarios**:

1. **Given** the maintenance page loads, **When** Mel starts typing, **Then** the text enters the search
   field without her clicking it first.
2. **Given** Mel completes an action, **When** it finishes, **Then** focus returns to the search field.

---

### Edge Cases

- **Matches but no duplicates** → single section populated, duplicates section empty/absent (US1-4).
- **A duplicate hidden by a display-name override** → still surfaced, because duplicate detection uses the
  **structured-name** key (first+last), not the display name.
- **Empty query** → the search is focused and ready; the duplicates section shows the **global** dedup
  queue (roster-wide candidates), so an empty search is a cleanup landing spot, not a blank view.
- **Merged contacts** → never appear (as elsewhere).
- **Viewer without merge authority** → the duplicates section is review-only / hidden rather than
  offering a merge action they can't perform (Mel, as mailing-list manager, holds the merge authority).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The maintenance search MUST present results in **two distinct sections**: single contacts to
  select, and potential duplicates to review.
- **FR-002**: The **single-contacts** section MUST list the contacts matching the query (ranked by name),
  each selectable to open its record.
- **FR-003**: The **potential-duplicates** section MUST surface likely duplicates as **candidate pairs
  (A ↔ B)**, **hybrid** by query state: when there is a query, the pairs relevant to the current matches
  (query-scoped); when the search box is empty, the **roster-wide** dedup queue.
- **FR-004**: Selecting a candidate pair MUST route into the existing merge flow **for that specific
  pair**.
- **FR-005**: Duplicate detection MUST use the **structured-name dedup key** (first+last), so a
  display-name override cannot mask a duplicate.
- **FR-006**: The search field MUST **auto-focus on load** and **regain focus after an action**
  (focus-to-search), matching the check-in pattern.
- **FR-007**: The **single-contacts section's** matching MUST use the **shared contact search**
  (feature 061) — no separate name-matching logic for that section. (The duplicates section legitimately
  uses the dedup engine's own structured-name similarity — FR-003/FR-005 — not the shared search.)
- **FR-008**: When the query yields no potential duplicates, the duplicates section MUST be **absent or a
  clear empty state** (no clutter).
- **FR-009**: This feature is **search + routing only** — it changes no contact data itself; the merge it
  routes to is the existing flow, gated by its existing authority (`dedup.write`).

### Key Entities *(include if feature involves data)*

None new. Reads existing `contacts` (`name_normalized` for matches, `dedup_normalized` for duplicate
detection) via the shared search (061) and the existing dedup suggestion engine. **No schema or
migration.**

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For a query, Mel sees matching single contacts in one section and any potential duplicates
  in a separate section.
- **SC-002**: Selecting a candidate pair lands Mel in the merge flow for that pair.
- **SC-003**: A duplicate hidden behind a display-name override is still surfaced in the duplicates
  section.
- **SC-004**: The search field is focused on load (Mel types immediately) and refocuses after an action.
- **SC-005**: With no duplicates for a query, the duplicates section does not distract (empty or absent).

## Assumptions

- **The duplicates section is hybrid** (clarified): query-scoped candidates while there is a query, and
  the roster-wide global dedup queue when the search box is empty. The query-scoped case likely extends
  the existing dedup suggestion engine (today global-only) with a query filter (a planning detail); the
  empty-query case is the engine's existing global output.
- **The merge flow already exists** (the `/dedup` surface + merge service, gated by `dedup.write`). This
  feature routes to it; it does not reimplement merging. Mel (`mailing_list_manager`) holds `dedup.write`.
- **Focus-to-search mirrors the check-in page** (an auto-focused search field that regains focus after
  actions).
- **Built on feature 060** (the contacts maintenance surface and its Record/Triage patterns) and **061**
  (the substring-primary shared search) — this feature adds the second section and the focus behavior.
- The record-mode editing itself (opening and editing a contact) is a separate requirement; here,
  selecting a single contact simply **opens** its record.
