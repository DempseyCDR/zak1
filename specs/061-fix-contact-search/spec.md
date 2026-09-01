# Feature Specification: Fix Contact Search (searchContacts)

**Feature Branch**: `061-fix-contact-search`

**Created**: 2026-09-01

**Status**: Draft

**Input**: User description: "X-R3 — fix searchContacts"

Source requirements: `specs/phase-8-requirements/mel-contact-maintenance.md` §2 — **X-R3** (fix the shared
`searchContacts`), flagged **priority**. The one search powers the door check-in lookup and every
contact-maintenance / contact-picker surface (contact maintenance, plus the booking and payments contact
typeaheads) — so this fixes them all.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Predictable incremental search (Priority: P1)

A staff member typing a name expects each keystroke to *narrow* the list. Today it doesn't: the search
matches on fuzzy trigram similarity above a fixed threshold, which is non-monotonic and length-biased —
"cat" returns nothing even though "Catherine" exists, and typing more letters can *remove* a match and
*add* a brand-new one (observed: `cath` → Cathy McGrath + Catherine; `cathe` → loses Cathy; `cather` →
gains Catherine Hughes + Sloboda). No human forms a mental model of that.

**Why this priority**: This is the core defect and it bites constantly — at the door, in maintenance,
everywhere the search is used. Fixing it is the whole point of X-R3, and it's the prerequisite for the
door and contact-maintenance features to feel usable.

**Independent Test**: Type a short prefix (e.g. "cat"): matching contacts appear ("Catherine …"). Add
letters one at a time: the result set only ever shrinks — no still-matching contact disappears, and no
previously-absent contact appears. Fully testable against a seeded roster.

**Acceptance Scenarios**:

1. **Given** a contact "Catherine Jones", **When** a user types "cat", **Then** "Catherine Jones" appears
   in the results (today it does not).
2. **Given** any query, **When** the user appends a character, **Then** every contact that still matches
   the longer query was already present, and **no** new contact appears (monotonic narrowing).
3. **Given** a query with no matches, **When** results are shown, **Then** an empty/"no matches" state is
   shown (not an error, not a stale list).

---

### User Story 2 - Find by name or email (Priority: P2)

A staff member should find a contact by their **first or last name**, their **display name**, or **any
of their email addresses** — whichever they happen to know. Today the search matches only the effective
display name, so a contact with a display-name override (e.g. "DJ" for "David Jones") is unfindable by
"David", and no one can be found by typing their email at all.

**Why this priority**: At the door especially, email and real first/last are how an attendant
disambiguates the right person; missing them forces needless duplicate contacts. P2 because it builds on
the P1 matching fix.

**Independent Test**: For a contact whose display name is overridden and who has an email on file, typing
their real first name, their last name, or their email each returns that contact.

**Acceptance Scenarios**:

1. **Given** a contact with display-name override "DJ" and real name "David Jones", **When** a user types
   "David" or "Jones", **Then** the contact appears.
2. **Given** a contact with email `dj@example.com`, **When** a user types `dj@example` (or the full
   address), **Then** the contact appears.

---

### User Story 3 - Typo tolerance & honest completeness (Priority: P3)

When exact/substring matches are thin, the user still benefits from close ("did you mean") matches —
Katherine vs Catherine — clearly presented as *secondary*. And when there are more matches than the list
shows, the user must be able to tell, so they refine rather than assume the person isn't there.

**Why this priority**: Quality-of-life on top of the core fix. P3 because the P1/P2 behavior already
makes most lookups succeed; this catches spelling variants and prevents "silent incompleteness."

**Independent Test**: With a query that has few exact matches, close spelling variants appear ranked
below the exact matches. With a query matching more contacts than the result cap, the UI indicates the
list is truncated.

**Acceptance Scenarios**:

1. **Given** contacts "Catherine" and "Katherine", **When** a user types "Catherine" and exact matches
   are thin, **Then** "Katherine" may appear, ranked **below** the exact match.
2. **Given** a query matching more contacts than the result cap, **When** results are shown, **Then** the
   user sees that more matches exist (a truncation indicator), not a silently cut list.

---

### Edge Cases

- **Query longer than any name** → empty state, reached by monotonic narrowing (never a mysterious
  re-appearance of matches).
- **Display-name override present** → the contact is findable by both the override and the real
  first/last (US2).
- **Shared / duplicate names** → all matches shown (up to the cap), which the surface disambiguates with
  its own fields (e.g. email at the door).
- **Merged or archived contacts** → excluded from results, as today.
- **Empty query** → each surface shows a sensible state (a "type to search" prompt or a clearly-ordered
  browse), not an arbitrary slice presented as if complete.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Search MUST match a contact when the query is a **substring/prefix** of their searchable
  name (so typing the first letters finds them — "cat" finds "Catherine").
- **FR-002**: Appending characters to the query MUST only **narrow** the result set — never remove a
  contact that still matches, nor introduce a contact that was absent for the shorter query (monotonic).
- **FR-003**: Search MUST match a contact by their **structured first/last name**, their **display
  name**, **and** any of their **email addresses**.
- **FR-004**: When exact/substring matches are few, the system MAY additionally surface **close
  (typo-tolerant) matches**, always ranked **below** and visually secondary to exact matches.
- **FR-005**: When more matches exist than are returned, the result MUST **indicate truncation** so the
  user knows to refine — no silently incomplete list.
- **FR-006**: Search MUST remain **read-only** — no contact data or authorization changes — and each
  surface MUST keep its existing permissions and displayed fields.
- **FR-007**: The improvement MUST apply to **every surface using the shared contact search** — the door
  check-in lookup and every contact-maintenance / contact-picker surface (contact maintenance, and the
  booking and payments contact typeaheads) — consistently.
- **FR-008**: An **empty query** MUST NOT present an arbitrary list as if it were complete — the browse it
  returns carries the same truncation indicator (FR-005). Each surface presents the empty state
  appropriately (the door browses name-ordered). A refined "type to search" / ordering for the
  contact-maintenance empty state is a later enhancement, out of scope here.

### Key Entities *(include if feature involves data)*

None new. Search reads existing data — a contact's searchable name keys and their email addresses. **No
database schema or migration**; this is a query/matching change (the necessary text indexes already
exist).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Typing "cat" returns "Catherine …" and every other contact whose name contains "cat" —
  where today it returns nothing.
- **SC-002**: Across the sequence `cath` → `cathe` → `cather`, each step's results are a **subset** of the
  previous step's (no match removed while still matching, none newly added).
- **SC-003**: A contact with a display-name override is found by typing their real first name, their last
  name, or their email address.
- **SC-004**: When results exceed the cap, the user can tell more matches exist (a truncation indicator
  is present).
- **SC-005**: The improved matching applies to the door check-in lookup and all `/api/contacts` consumers
  (contact maintenance and the booking/payments contact pickers) with **no change** to their permissions
  or the fields they display.

## Assumptions

- **Substring is the primary matcher; fuzzy is a thin-results fallback.** Substring/prefix matching gives
  the monotonic narrowing users expect; typo-tolerant (fuzzy) matches are added only when exact results
  are sparse, ranked below — preserving spelling-variant tolerance without the non-monotonic "wobble."
- **No schema or migration.** The needed text/index support already exists; this is a matching-logic and
  query change. Existing search-behavior tests are updated to the new expectations in the same change.
- **The result cap stays; truncation is indicated.** Full pagination is out of scope for this feature —
  because search now narrows predictably, refining reaches the target; a truncation indicator prevents
  silent incompleteness. Pagination can be a later enhancement.
- **Per-surface display and permissions are unchanged.** This feature changes *which contacts match*, not
  what each surface shows or who may search — the door stays PII-gated, etc.
- Depends on the shared contact-search used by the door check-in and the `/api/contacts` consumers
  (contact maintenance, booking and payments pickers) — **not** the access roster, which uses a separate
  volunteer listing. It does not depend on the Mel/Meg role features (it is a prerequisite they consume).
