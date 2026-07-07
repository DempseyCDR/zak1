# Feature Specification: Retire Jane Austen Ball Mailing List; Free-Text Event-Group Category

**Feature Branch**: `010-retire-jab-mailing-list`

**Created**: 2026-07-07

**Status**: Draft

**Input**: User description: "specs/PHASE2_REQUIREMENTS.md — item P2-1 (retire the Jane Austen Ball mailing list; make event-group kind a free-text label)"

## Clarifications

### Session 2026-07-07

- Q: When the event-group category changes from a fixed set to free text, how should existing rows (snake_case values like `double_dance`) convert? → A: Prettify — replace underscores with spaces and lowercase (e.g., `double_dance` → "double dance"). Low-stakes since current rows are dev/seed only.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Retire the Jane Austen Ball mailing list (Priority: P1)

The Jane Austen Ball (JAB) contact list is maintained externally (in iContact), where it already
carries each contact's "last year attended." That external list is the system of record for JAB, and
future ball attendance is folded into it by running the existing **event-scoped contact-tracing export**
on a JAB event and using the result to augment iContact. A dedicated JAB *standing mailing list* inside
this platform is therefore redundant and a source of confusion. The club administrator wants it gone.

**Why this priority**: This is the core motivation for the feature — eliminating a redundant, confusing
list. It stands alone and delivers value on its own.

**Independent Test**: Open the exports surface; confirm the Jane Austen Ball list is no longer offered
and exactly six standing mailing lists remain; confirm the JAB event's consented attendees are still
obtainable via the contact-tracing export.

**Acceptance Scenarios**:

1. **Given** the exports surface, **When** an administrator views the available standing mailing lists,
   **Then** exactly six are offered — Contra, English, Open Band, Special Events, Performer, Member — and
   no Jane Austen Ball list appears anywhere (list, generation, or validation).
2. **Given** a Jane Austen Ball event with consented attendees, **When** the administrator runs the
   event-scoped contact-tracing export on that event, **Then** the export returns that event's consented
   attendees exactly as before (the intended path to augment the external JAB list).
3. **Given** the retired list identifier, **When** any request attempts to generate or reference the
   Jane Austen Ball standing list, **Then** the system does not offer or accept it (no residual code
   path, note, or validation recognizes it).

---

### User Story 2 - Categorize event groups with a free-text label (Priority: P2)

An event group bundles related events for planning and results review (e.g., a "Pride Dance 2026"
double dance, or a "Jane Austen Ball 2027" weekend). Today the group's *kind* is a fixed dropdown of
four values that carries almost no behavior. The administrator wants to categorize groups **freely** —
the group's *name* identifies the specific instance, and its *category* is a free-form label the club
chooses.

**Why this priority**: A usability improvement that removes an artificial constraint. Valuable but
secondary to retiring the list; independently shippable.

**Independent Test**: Create or edit an event group and enter an arbitrary category (e.g., "double
dance"); confirm it saves with no fixed-list restriction and displays that text.

**Acceptance Scenarios**:

1. **Given** the event-group create/edit surface, **When** the administrator enters an arbitrary
   category such as "double dance" or "weekend", **Then** the group saves with that exact text and no
   fixed set is enforced.
2. **Given** the administrator leaves the category empty, **When** they save the event group, **Then**
   the group saves successfully with no category (the field is optional).
3. **Given** an event group created before this change, **When** it is viewed after the change, **Then**
   its previous category value is preserved as free text (no category information is lost).

---

### User Story 3 - Preserve Jane Austen Ball opt-in consent (Priority: P3)

Contacts can record an opt-in consent for the Jane Austen Ball topic on their email. This documents
consent and remains useful for a future iContact sync, independent of whether a JAB standing mailing
list exists. Retiring the list must not disturb consent.

**Why this priority**: A non-regression guardrail — small but important to get right, because the JAB
naming appears in three different places that must not be conflated.

**Independent Test**: On a contact's email, set and view the Jane Austen Ball consent topic before and
after the change; confirm identical behavior.

**Acceptance Scenarios**:

1. **Given** a contact email, **When** the administrator sets the Jane Austen Ball consent topic,
   **Then** it is recorded and visible exactly as before this feature.
2. **Given** the Jane Austen Ball standing mailing list has been retired, **When** the consent model is
   inspected, **Then** the Jane Austen Ball consent topic still exists and is unchanged.

---

### Edge Cases

- **Historical export records referencing the retired list**: none exist (verified in dev on
  2026-07-04); the change must proceed cleanly given no records use the JAB list identifier. If any were
  present, they would block retiring the identifier and must be surfaced rather than silently dropped.
- **Existing event groups with a former fixed category** (e.g., the old "jane_austen_ball" kind): their
  value is converted to prettified free text (underscores → spaces, lowercased — e.g., "jane_austen_ball"
  → "jane austen ball"); none is lost or blanked.
- **Empty event-group category**: allowed — the category is optional.
- **JAB consent with no JAB list**: expected and fine — consent documents opt-in; augmentation happens
  via the contact-tracing export, not a standing list.
- **Contact-tracing export on a JAB event with no consented attendees**: returns an empty result, the
  same as any other event with no qualifying attendees.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST NOT offer the Jane Austen Ball as a standing mailing list on any surface
  (exports listing, list generation, or input validation).
- **FR-002**: The exports surface MUST present exactly six standing mailing lists — Contra, English,
  Open Band, Special Events, Performer, Member — plus the separate event-scoped contact-tracing export.
- **FR-003**: The system MUST NOT accept or act on the retired Jane Austen Ball standing-list identifier
  from any request; no residual code path, display note, or validation may recognize it.
- **FR-004**: The system MUST remove the "most recent Jane Austen Ball year" derivation, which existed
  solely to annotate the retired JAB standing list.
- **FR-005**: Administrators MUST be able to augment the external Jane Austen Ball list by running the
  existing event-scoped contact-tracing export on a Jane Austen Ball event; that export MUST return the
  event's consented attendees (behavior unchanged).
- **FR-006**: Administrators MUST be able to assign a free-text category to an event group when creating
  or editing it, with no fixed set of allowed values enforced.
- **FR-007**: The event-group category MUST be optional; the system MUST accept an omitted or empty
  category.
- **FR-008**: Existing event groups MUST retain their category after the fixed set is removed, converted
  to prettified free text (underscores replaced with spaces, lowercased — e.g., "double_dance" → "double
  dance"); no category information may be lost in the conversion.
- **FR-009**: The Jane Austen Ball email consent topic MUST remain available — recordable per email and
  visible in the contacts surface — with unchanged behavior.
- **FR-010**: Retiring the Jane Austen Ball standing mailing list and the fixed event-group kind MUST
  NOT remove or alter the Jane Austen Ball email consent topic. The three JAB-named concepts remain
  distinct: the consent topic is **kept**; the standing mailing list and the fixed event-group kind are
  **removed**.

### Key Entities *(include if feature involves data)*

- **Standing mailing list**: a named audience the club exports as a CSV for its external mail tool. The
  set of standing lists is reduced by one (Jane Austen Ball removed), leaving six.
- **Event group**: a grouping of related events for planning and results review. Its category changes
  from a fixed set of values to an optional free-text label; its name and grouping behavior are
  unchanged.
- **Email consent topic**: a per-email opt-in flag. The Jane Austen Ball topic is retained unchanged;
  it documents consent and is independent of any standing mailing list.
- **Contact-tracing export**: an existing event-scoped export of an event's consented attendees.
  Unchanged by this feature; it becomes the sole in-platform path for augmenting the external JAB list.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The exports surface offers exactly six standing mailing lists and zero references to the
  Jane Austen Ball list remain across the exports listing, list generation, and validation.
- **SC-002**: An administrator can obtain a Jane Austen Ball event's consented attendees via the
  contact-tracing export in a single action, with results identical to before this feature.
- **SC-003**: An administrator can categorize an event group with any text of their choosing on the
  first attempt, with no rejection due to a fixed value set.
- **SC-004**: 100% of event groups that existed before the change retain their category information
  afterward, in prettified free-text form.
- **SC-005**: The Jane Austen Ball consent topic remains settable and visible on a contact's email after
  the change, with no observable difference in behavior (zero regressions).
- **SC-006**: An administrator can create an event group with no category (empty) and it saves
  successfully.

## Assumptions

- **No platform data migration for the mailing list**: the JAB "last year attended" attribute lives in
  the external tool (iContact), not in this system, and no historical export records reference the JAB
  standing list (verified in dev on 2026-07-04). Retiring the identifier is therefore data-safe.
- **Event-group category is optional (nullable) free text**. This was flagged as an open question in
  P2-1; the recommended default (optional) is adopted here and can be revisited in `/speckit-clarify`.
- **The category concept keeps its current field name** internally; whether to rename it (e.g., to
  "category") is a non-functional detail deferred to planning — it does not affect the behavior specified
  here. (Also flagged in P2-1; low impact.)
- **Existing event-group category values are prettified** when the fixed set becomes free text —
  underscores become spaces and the value is lowercased (e.g., "double_dance" → "double dance"). Resolved
  via clarification; low-stakes since current rows are dev/seed only (production loads fresh at go-live).
- **Mail sending stays external**: this platform only produces lists/exports; sending remains in
  iContact (out of scope — backlog B7/B10).
- **The six retained standing lists** are Contra, English, Open Band, Special Events, Performer, and
  Member.

## Dependencies

- **Feature 006 (iContact export)**: its scope drops from seven standing lists to six and it loses the
  "most recent Jane Austen Ball year" annotation. Related specs/artifacts should be re-synced when this
  ships.
- **Feature 002 (event groups)**: the event-group category changes from a fixed set to optional free
  text.
- **Contact/consent model (features 001/006)**: the Jane Austen Ball consent topic is retained
  unchanged.
