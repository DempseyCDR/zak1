# Feature Specification: Public Navigation Menu

**Feature Branch**: `034-public-nav-menu`

**Created**: 2026-08-04

**Status**: Draft

**Input**: Phase 6 requirement **P6-R1** (`zak1_Phase6_Requirements.md`) — a public-pages menu component that
becomes the top menu on all web pages. Motivated by defect **D1** (a page with no way to reach it): the site has
no first-class, complete navigation.

## Clarifications

### Session 2026-08-04

- Q: Where does the public menu render — public pages only, or all pages including volunteer admin/door? → A:
  All pages (public, admin, door) as the topmost bar; on staff pages the volunteer menu (P6-R2) sits beneath it
  as a second bar. This feature modifies the site-wide root frame, not only the public layout.
- Q: Which public destinations launch in the menu? → A: Two entries — "What's On" (home) and "Join" — with the
  wordmark as the home affordance. History (P6-R4) and content pages (B44) are added as hand-maintained entries
  when they ship.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A visitor can reach any public page from a consistent menu (Priority: P1)

A member of the public lands on any page of the site and sees a navigation menu at the top listing the site's
public destinations. From that menu they can go to any public destination in a single action, from wherever they
currently are — they never have to already know a URL or hunt for a link someone happened to place.

**Why this priority**: This is the whole point of the feature and the fix for the D1 class of problem — no
public page is reachable only by luck. Without it there is no public navigation at all. It is a complete,
demonstrable slice on its own.

**Independent Test**: Load each public page in turn; confirm the same menu is present and that every listed
destination is reachable with one click/tap from each starting page.

**Acceptance Scenarios**:

1. **Given** a visitor on the home page, **When** they open the navigation menu, **Then** they see entries for
   the site's public destinations (e.g. "What's On" and "Join") and can click any one to go there.
2. **Given** a visitor on any public page other than home, **When** they use the menu, **Then** they can reach
   every other public destination without returning to the home page first.
3. **Given** a visitor viewing a listing's detail page (e.g. one event's page), **When** they look at the menu,
   **Then** the menu is still present and the section they are within is indicated as active.

### User Story 2 - The menu is present and consistent on every page, signed in or not (Priority: P2)

The navigation menu appears at the top of every page of the site — for anonymous visitors and for signed-in
volunteers alike — and marks the page the visitor is currently on, so people always know where they are and how
to move. A signed-in volunteer sees this same public menu; their separate working menu (a distinct feature) sits
alongside it rather than replacing it.

**Why this priority**: Consistency and orientation across the whole site. It builds directly on US1 but is not
required for the core "can I get there at all" value, so it is P2.

**Independent Test**: Visit pages across the site both signed out and signed in; confirm the menu is present in
both states and that the current page/section is visibly indicated each time.

**Acceptance Scenarios**:

1. **Given** any page of the site, **When** it renders, **Then** the public navigation menu is present at the
   top.
2. **Given** a signed-in volunteer on a staff page, **When** the page renders, **Then** the public menu is still
   present (their volunteer working menu is a separate, additional menu, not a replacement).
3. **Given** a visitor on a given page, **When** the menu renders, **Then** the entry for that page (or its
   section) is shown as the active/current one.

### User Story 3 - A maintainer adds or changes a menu entry in one place (Priority: P3)

A maintainer can add, remove, rename, or reorder a public menu entry by editing a single, hand-maintained list —
with no other change needed for the entry to appear everywhere the menu shows. This is the deliberate,
per-decision safeguard against the D1 failure mode (a destination that exists but is unreachable because a menu
was never updated).

**Why this priority**: A maintainability property rather than an end-user journey, but it is an explicit decision
for this feature (the list is hand-maintained for now; generating it is deferred to backlog B44), so it must be
verifiable. P3 because it does not change what a visitor sees today.

**Independent Test**: Add one entry to the single list; confirm it appears in the menu on every page with no
other edit; remove it; confirm it disappears everywhere.

**Acceptance Scenarios**:

1. **Given** the hand-maintained list of public menu entries, **When** a maintainer adds an entry, **Then** it
   appears in the menu site-wide with no further change.
2. **Given** the same list, **When** a maintainer removes or reorders entries, **Then** the menu reflects the
   change site-wide.

### Edge Cases

- **Small screens**: on a narrow (mobile) viewport, all menu destinations remain reachable (the menu adapts —
  wraps or collapses — rather than hiding entries).
- **Active state on a detail page**: when a visitor is on a sub-page of a listing (e.g. an individual event under
  "What's On"), the parent section is indicated as active rather than nothing being active.
- **Not-found / error pages**: the menu still renders as part of the standard page frame, so a visitor who hits
  a bad link can still navigate away.
- **Signed-in volunteer**: the public menu does not disappear or get replaced when a volunteer is authenticated;
  it remains the top-level menu.
- **Empty/one-entry list**: the menu renders sensibly even if the list has a single entry (degenerate but valid).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The site MUST present a public navigation menu at the top of **every** page — public pages **and**
  volunteer (admin/door) pages — visible to all visitors whether or not they are signed in. On volunteer pages
  it is the topmost bar, with the volunteer working menu (P6-R2) beneath it.
- **FR-002**: The menu MUST list the site's public destinations and MUST let a visitor navigate to each
  destination with a single action, from any page.
- **FR-003**: The menu's entries MUST be defined in a single hand-maintained list, so that adding, removing,
  renaming, or reordering a public destination is a single edit reflected everywhere the menu appears.
- **FR-004**: The menu MUST indicate the visitor's current page (or its section) as active.
- **FR-005**: The menu MUST be presentation only. It MUST NOT grant, deny, or imply access to any destination;
  each destination continues to enforce its own access independently. (A destination absent from the menu is
  still reachable by direct URL; a destination present in the menu is still subject to its own access rules.)
- **FR-006**: The menu MUST include a home affordance (the club name/wordmark) that returns the visitor to the
  home page.
- **FR-007**: Detail or sub-pages reached from a listing (for example an individual event's page) MUST NOT
  appear as top-level menu entries.
- **FR-008**: The menu MUST remain usable on small (mobile) screens with all destinations reachable, and MUST be
  navigable by keyboard and identifiable to assistive technology as the site's navigation.
- **FR-009**: When a volunteer is signed in, the public menu MUST remain the top-level menu; the volunteer's
  working menu (a separate feature, P6-R2) is an additional, distinct menu and this feature MUST NOT preclude it
  being placed alongside.

### Key Entities

- **Public menu entry**: one navigable item in the menu — a human-readable label plus the destination it links
  to. Entries form a single, ordered, hand-maintained list. This is static configuration, not stored data.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: From any public page, a visitor can reach any other public destination in a single interaction (one
  click/tap) — there are no public pages reachable only by typing a URL.
- **SC-002**: The navigation menu is present on 100% of the site's pages, in both signed-out and signed-in
  states.
- **SC-003**: Adding a new public destination to the menu requires editing exactly one location; no other file
  or page needs to change for it to appear site-wide.
- **SC-004**: On a mobile-width screen, 100% of the menu's destinations remain reachable.
- **SC-005**: On every page, the current page or its section is visibly indicated in the menu.

## Assumptions

- **Initial entries** (decided — Clarifications 2026-08-04): the menu launches with **exactly two** entries —
  **"What's On"** (the home / schedule page) and **"Join"** (membership) — with the club wordmark as the home
  affordance. The future history page ("What was on", P6-R4) and future content pages (mission, values, history,
  FAQ — backlog **B44**) are out of scope here and are added as hand-maintained entries when they ship.
- **Scope of "all pages"** (decided — Clarifications 2026-08-04): the public menu is the top-level menu on
  **every** page of the site, **including the volunteer (admin/door) pages**, so this feature modifies the
  site-wide root frame (not only the `(public)` layout). On staff pages it is the topmost bar and the volunteer
  working menu (**P6-R2**) is a second bar beneath it; building that second bar is P6-R2, not this feature.
- **Hand-maintained**: the entry list is maintained by hand for now; deriving it from the source tree or from
  published CMS content is deliberately deferred to backlog **B44**.
- **Detail routes excluded**: listing sub-pages (e.g. an individual event page) are reachable from their listing,
  not from the top menu.
- **Presentation only**: existing route-level access control is unchanged; this feature adds no authorization
  behavior.
- **Out of scope**: the volunteer/second-bar menu (**P6-R2**), any generated/auto-discovered menu, and the
  content pages / CMS (**B44**).
