# Feature Specification: Volunteer Navigation Menu

**Feature Branch**: `035-volunteer-nav-menu`

**Created**: 2026-08-04

**Status**: Draft

**Input**: Phase 6 requirement **P6-R2** (`zak1_Phase6_Requirements.md`) — a volunteer-pages menu component that
renders as a second top menu when a volunteer is signed in. **Subsumes defect D1** (the `/payments` page has no
nav link). Builds on feature 034 (the public menu), which already renders as the topmost bar on every page.

## Clarifications

### Session 2026-08-04

- Q: How is the menu kept complete (FR-002/FR-006) so a page can't be orphaned again? → A: Keep a
  hand-maintained capability-tagged list (fix D1 by adding `/payments`) **plus an automated completeness test**
  that walks the staff page tree and fails if any volunteer page lacks an entry — so orphaning cannot be merged.
  Mirrors the `routeInventory` guard-test precedent; no per-page metadata convention and no generation.
- Q: Where does the volunteer menu render — staff pages only, or every page when signed in? → A: Every page
  when signed in. The volunteer menu appears beneath the public menu on **all** pages (public + staff) whenever
  a volunteer is signed in, symmetric with the public menu (034) — so it moves to the site-wide root frame with
  a signed-in guard, rather than living only in the `(admin)`/`(door)` layouts.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A signed-in volunteer reaches all their working pages from a complete menu (Priority: P1)

A volunteer signs in and, on the pages where they work, sees a navigation menu — a second bar beneath the public
menu — listing the staff pages their role is for. From it they can reach any of their working surfaces from
anywhere, and **no** volunteer page is reachable only by knowing its URL. In particular, the Financial Secretary
and Treasurer can reach the **payments** page from this menu (the concrete gap that defect D1 named).

**Why this priority**: This is the core value and the fix for the D1 class of problem — a working page that is
unreachable because a menu was never updated. Without completeness, volunteers get stranded. It is a complete,
demonstrable slice on its own.

**Independent Test**: Sign in as each role; confirm every page that role is meant to operate is present in the
menu and navigates correctly — and specifically that an FS/Treasurer sees a working **payments** entry.

**Acceptance Scenarios**:

1. **Given** a signed-in volunteer on any page (public or staff), **When** the page renders, **Then** a
   volunteer menu appears as a second bar (beneath the public menu) listing the staff pages their role is for.
2. **Given** a signed-in Financial Secretary or Treasurer, **When** they view the volunteer menu, **Then** a
   **payments** entry is present and navigates to the payments page (D1 closed).
3. **Given** a signed-in volunteer, **When** they use the menu from any page, **Then** they can reach every
   other page their role operates without needing to type a URL.

### User Story 2 - The menu shows each volunteer only the pages for their job, and never grants access (Priority: P2)

Each volunteer sees only the entries for pages their role is responsible for — a Door Attendant does not see
Treasurer pages, and vice versa. The menu is a **courtesy, not a control**: hiding an entry never denies access
and showing one never grants it; every page enforces its own authorization regardless of what the menu shows.
The menu does not appear at all for anonymous (not-signed-in) visitors.

**Why this priority**: Role-appropriateness keeps the menu useful (not a wall of irrelevant links) and preserves
the security model. This behavior largely exists today; the requirement is to preserve it while completing the
menu (US1). P2 because US1's completeness is the headline value.

**Independent Test**: Sign in as a narrow role (e.g. Door Attendant) and a broad one; confirm each sees only
their pages; confirm requesting a hidden page's URL directly is still refused by the page; confirm an anonymous
visitor sees no volunteer menu.

**Acceptance Scenarios**:

1. **Given** a volunteer whose role is for a subset of pages, **When** the menu renders, **Then** only entries
   for the pages their role operates are shown.
2. **Given** a page that is absent from a volunteer's menu, **When** that volunteer requests its URL directly,
   **Then** the page still enforces its own authorization (the menu changed nothing).
3. **Given** an anonymous visitor, **When** any page renders, **Then** no volunteer menu is shown (only the
   public menu).

### User Story 3 - A newly added volunteer page cannot be orphaned from the menu (Priority: P3)

When a developer adds a new volunteer page, it becomes reachable from the volunteer menu without anyone having to
remember to update a separate hand-kept list — either the entry appears automatically, or an automated check
fails until the page is wired in. This is the structural fix for the D1 *class* (D1 itself being one page that
was forgotten).

**Why this priority**: It prevents D1 from recurring. It is a maintainability/guarantee property rather than an
end-user journey, so P3 — but it is the reason this feature exists beyond a one-line array edit.

**Independent Test**: Introduce a new volunteer page with no menu wiring; confirm the safeguard catches it (the
page appears in the menu automatically, or an automated check fails), rather than the page silently becoming
unreachable.

**Acceptance Scenarios**:

1. **Given** a new volunteer page added to the app, **When** the safeguard runs, **Then** the page is reachable
   from the menu (or the safeguard fails loudly) without a human having remembered to edit a list.
2. **Given** the existing set of volunteer pages, **When** the menu is generated/validated, **Then** there are
   **zero** orphaned volunteer pages (every one is reachable by the volunteers whose job it is).

### Edge Cases

- **Base-only volunteer**: an Organizer with only base access sees the base entries (e.g. the organizer report,
  contacts) and no role-specific ones.
- **Signed-in volunteer on a public page**: the volunteer menu **does** appear there too (Clarifications
  2026-08-04, option B) — beneath the public menu — since it renders on every page when signed in.
- **A page whose gating capability no UI volunteer holds** (e.g. a CLI-only super-user page): it is simply not
  shown to anyone — that is correct, not an orphan.
- **Current page**: the volunteer's current page/section is indicated as active in the menu (consistent with the
  public menu).
- **No staff pages for a role**: a signed-in volunteer whose role has no operable pages still sees the base
  entries (the menu is never empty for a signed-in volunteer).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: When a volunteer is signed in, the system MUST present a volunteer navigation menu as a **second**
  menu beneath the public menu (feature 034) on **every** page (public and staff alike) — rendered from the
  site-wide root frame, guarded by sign-in.
- **FR-002**: The volunteer menu MUST be **complete** — every volunteer-facing page MUST have a menu entry for
  the volunteers whose job it is, so no volunteer page is reachable only by direct URL.
- **FR-003**: Each entry MUST appear only for a volunteer holding the capability that page is **for** (its
  primary purpose), not merely read access — so each volunteer sees the pages of their job, not every page they
  could look at.
- **FR-004**: The menu MUST be **presentation only**. It MUST NOT grant, deny, or imply access. A page absent
  from a volunteer's menu is still refused if requested directly; a page present is still subject to its own
  authorization. (Each page/route stays default-deny independently of the menu.)
- **FR-005**: The volunteer menu MUST NOT appear for anonymous (not-signed-in) visitors.
- **FR-006**: The system MUST prevent a volunteer page from becoming **orphaned** from the menu over time. The
  menu entries stay a hand-maintained capability-tagged list, and an **automated completeness test** MUST walk
  the staff page tree and **fail** if any volunteer page lacks a menu entry — so an orphaned page cannot be
  merged. (Clarifications 2026-08-04, option A: catch-via-test, not generation.)
- **FR-007**: The **payments** page MUST be reachable from the volunteer menu for the Financial Secretary and
  Treasurer (the concrete D1 instance closed).
- **FR-008**: The menu MUST indicate the volunteer's current page (or its section) as active, consistent with
  the public menu.
- **FR-009**: The menu MUST be keyboard navigable and identifiable to assistive technology as a navigation
  region distinct from the public menu.

### Key Entities

- **Volunteer menu entry**: one navigable staff destination — a human-readable label, the destination it links
  to, and the **capability that gates its display** (the page's primary-purpose capability). The set of entries
  must correspond one-to-one with the set of volunteer-facing pages (completeness, FR-002).
- **Volunteer page**: a staff-only page (under the admin/door areas) that a volunteer operates. Its presence in
  the app is what the menu must stay complete against (FR-006).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: From any page (public or staff), a signed-in volunteer can reach every page their role operates in
  a single interaction (one click/tap).
- **SC-002**: 100% of volunteer-facing pages are reachable from the menu (zero orphaned pages) — including the
  payments page for FS/Treasurer (D1 closed).
- **SC-003**: Introducing a new volunteer page with no menu wiring is caught automatically (the page appears in
  the menu, or an automated check fails) rather than the page silently becoming unreachable.
- **SC-004**: The volunteer menu appears for 100% of signed-in volunteers on every page and for 0% of anonymous
  visitors (on any page).
- **SC-005**: Each volunteer sees only entries for the capabilities their role holds (e.g. a Door Attendant sees
  no Treasurer entries), verified across at least the narrowest and a broad role.

## Assumptions

- **Sourcing mechanism (decided — Clarifications 2026-08-04, option A)**: the menu entries stay a
  **hand-maintained capability-tagged list** (fixing D1 by adding `/payments`), guarded by an **automated
  completeness test** that walks the staff page tree and fails when a volunteer page has no entry. Generation
  from the source tree was rejected: the existing route walker enumerates **API** routes and their declared
  `requires`, but **UI pages carry no declared capability or label today**, so generation would need a new
  per-page metadata convention — more than this ~18-page menu warrants (YAGNI). The completeness test gives the
  no-orphan guarantee without that convention.
- **Placement (decided — Clarifications 2026-08-04, option B)**: the volunteer menu renders on **every** page
  (public and staff) as the second bar beneath the public menu whenever a volunteer is signed in — so it moves
  to the site-wide root frame with a sign-in guard, rather than living only in the `(admin)`/`(door)` layouts.
  This changes today's staff-pages-only behavior and is symmetric with the public menu (034).
- **Preserves the existing model**: the current role-aware volunteer nav (a courtesy, not a control; entries
  gated by the page's primary-purpose capability) is preserved; this feature completes and future-proofs it, it
  does not change the authorization model.
- **Out of scope**: the public menu (feature 034, shipped); any change to route-level authorization
  (`withAuth`/`requireStaff` stay as they are); the CLI-only super-user surface.
