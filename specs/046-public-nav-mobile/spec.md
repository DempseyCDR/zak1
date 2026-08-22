# Feature Specification: Public nav, small-screen pattern (P7-R2)

**Feature Branch**: `046-public-nav-mobile`

**Created**: 2026-08-22

**Status**: Draft

**Input**: User description: "P7-R2 — Public nav, small-screen pattern. Give PublicNav a proper mobile presentation (compact/collapsible below a breakpoint, thumb-sized targets), enhancing up to the current inline bar on desktop. Presentation-only, built on the P7-R1 tokens; the volunteer second bar must coexist on small screens."

## Overview

The public site's top navigation is shared chrome — one bar rendered on every page. Today it is a
desktop-shaped horizontal list that simply wraps onto extra lines on a phone, and its destination count
will grow from three to roughly ten as later Phase 7 pages land. This feature gives that navigation a
purpose-built **small-screen presentation**: below a breakpoint it becomes a compact bar with a way to
reveal the full set of destinations (thumb-sized targets), and above the breakpoint it stays the current
inline bar. It is **presentation only** — the destinations and their hand-maintained source are unchanged
— and it builds on the P7-R1 design tokens. The signed-in volunteer second bar must continue to work
cleanly alongside it on small screens.

## Clarifications

### Session 2026-08-22

- Q: Collapse pattern — a hamburger/disclosure menu vs. a deliberately short always-visible bar? → A: **Hamburger/disclosure menu** — the compact bar shows the site wordmark/home + a labeled menu toggle; opening it reveals the full destination list in a disclosure panel. Chosen to scale to ~10+ destinations without cramping.
- Q: Information architecture — a flat list vs. grouped sections? → A: **Flat list** — destinations in one flat list in the panel, no section headings (grouping revisited only when the destination set demands it).
- Q: The exact small-screen breakpoint? → A: **768px** — the compact disclosure menu applies below 768px; at ≥768px the inline bar renders (leaves the inline bar room to grow to ~10 destinations).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A phone visitor uses a compact, uncramped public menu (Priority: P1)

A visitor on a phone sees a tidy, compact navigation bar rather than a wrapping row of links. They can
reach every public destination through it, with comfortably large tap targets, and the bar stays tidy even
as the site grows to ~10 destinations. On a larger screen the same navigation presents as the familiar
inline bar.

**Why this priority**: The public nav is the most-seen element of the site; on mobile it is currently a
wrapping desktop bar, and it must scale gracefully as destinations multiply — this is the core of R2.

**Independent Test**: At ~375px, confirm the public nav occupies a compact area (not a multi-line wrapped
list), every destination is reachable through it with large tap targets, and there is no horizontal
scrolling; widen the viewport and confirm it becomes the inline bar.

**Acceptance Scenarios**:

1. **Given** a public page at ~375px, **When** the nav renders, **Then** it presents compactly (not as a wrapped multi-row list) and every destination is reachable through it.
2. **Given** the nav on a touch screen, **When** a visitor taps a control or link, **Then** each target is large enough for a thumb (no mis-taps from cramped targets).
3. **Given** the destination count grows to ~10, **When** the nav renders on a phone, **Then** it stays tidy (no overflow, no horizontal scroll, no cramping).
4. **Given** a wide screen, **When** the nav renders, **Then** it presents as the inline bar (enhanced upward from the same system).
5. **Given** any width, **When** the nav renders, **Then** the site's home/wordmark affordance and the current-page indication are preserved.

---

### User Story 2 - The navigation is fully accessible (Priority: P1)

A visitor using a keyboard or screen reader can operate the navigation completely: open and close any
collapsible menu, move through the destinations, understand the menu's expanded/collapsed state, and the
menu returns focus sensibly and closes on Escape. All of it meets the contrast floor.

**Why this priority**: A collapsible menu that isn't keyboard- and screen-reader-operable excludes people
and fails the accessibility floor the whole rewrite commits to; it must be correct from the start.

**Independent Test**: Using only a keyboard, open the menu, traverse all destinations, and close it;
confirm the toggle exposes its expanded/collapsed state, focus is managed on open/close, Escape closes it,
and all elements meet WCAG AA.

**Acceptance Scenarios**:

1. **Given** the collapsible menu, **When** operated by keyboard only, **Then** it can be opened, fully traversed, and closed, with a visible focus indicator throughout.
2. **Given** the menu toggle, **When** inspected by assistive tech, **Then** it is labeled and exposes its expanded/collapsed state.
3. **Given** the menu is open, **When** the visitor presses Escape (or moves focus away as expected), **Then** it closes and focus returns to a sensible place.
4. **Given** any nav text or control, **When** its contrast is measured, **Then** it meets WCAG AA.

---

### User Story 3 - Public and volunteer bars coexist on small screens (Priority: P2)

A signed-in volunteer on a phone sees both the public bar and the volunteer bar beneath it, and both remain
fully usable — neither overlaps, hides, or crowds the other.

**Why this priority**: Staff use the site on phones too; the two stacked bars must not collide on small
screens. It depends on US1 existing but is a distinct, separately testable concern.

**Independent Test**: Signed in, at ~375px, confirm both the public bar and the volunteer bar render, are
distinguishable, and every destination in each is reachable without overlap or horizontal scroll.

**Acceptance Scenarios**:

1. **Given** a signed-in volunteer at ~375px, **When** a page renders, **Then** both the public bar and the volunteer bar are present and fully reachable.
2. **Given** both bars on a small screen, **When** rendered, **Then** they do not overlap or clip each other, and neither introduces horizontal scrolling.

### Edge Cases

- **Shared chrome**: the public nav renders on **every** page (including admin/door pages), so its new
  presentation appears app-wide as the top bar; page bodies are unaffected.
- **Menu open across navigation**: navigating to a new page from within an open mobile menu leaves the
  visitor on the destination with the menu in a sensible (closed) state.
- **Growth**: the pattern must accommodate ~10+ destinations without a redesign (the WordPress mega-menu's
  ~35 cramped, duplicated links is the anti-pattern to avoid).
- **No JavaScript / slow load**: the destinations remain reachable (the menu degrades to usable links), so
  navigation is never entirely dependent on the toggle.
- **Very long labels**: labels wrap or truncate gracefully rather than forcing horizontal scroll at 375px.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Below a **768px** breakpoint, the public navigation MUST present as a **compact** bar (the site wordmark/home affordance + a labeled menu toggle) that reveals the full set of destinations as a **flat list** in a **disclosure panel** when opened, rather than a wrapping horizontal list; at or above the breakpoint it MUST present as the current inline bar.
- **FR-002**: Every navigation control and link MUST present a touch target of at least 44×44px on touch screens.
- **FR-003**: The navigation MUST NOT cause horizontal scrolling at ~375px and MUST remain tidy (no overflow/cramping) as the destination count grows to ~10+.
- **FR-004**: Any collapsible menu MUST be fully keyboard operable (open, traverse, close), MUST expose its expanded/collapsed state to assistive technology through a labeled toggle, MUST manage focus on open/close, and MUST close on Escape.
- **FR-005**: The destinations MUST remain reachable even when the toggle cannot be operated (no-JS / pre-hydration degradation) — navigation MUST NOT depend solely on interactive disclosure.
- **FR-006**: All navigation text and controls MUST meet WCAG AA contrast using the P7-R1 design tokens.
- **FR-007**: The signed-in volunteer second bar MUST coexist with the public bar on small screens without overlap, clipping, or lost access.
- **FR-008**: This feature MUST change presentation/layout only: the set of destinations and their hand-maintained single source MUST be unchanged, and no new pages or destinations are added.
- **FR-009**: The navigation MUST render on every page as shared chrome (unchanged from today), MUST preserve the site home/wordmark affordance, and MUST keep indicating the active destination.
- **FR-010**: On wider screens the presentation MUST be the inline bar (no functional regression from today's desktop behavior).

### Key Entities

- Not applicable — no data model. The navigation destinations are the existing hand-maintained list
  (unchanged); this feature concerns presentation only.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At 375px the public nav occupies a compact area (not a wrapped multi-row list) with no horizontal scrolling.
- **SC-002**: 100% of nav controls/links present a touch target ≥44×44px.
- **SC-003**: The full menu can be opened, traversed, and closed using only a keyboard, with a visible focus indicator and correct expanded-state semantics.
- **SC-004**: 100% of nav text/controls meet WCAG AA contrast.
- **SC-005**: With ~10 destinations configured, the mobile nav renders without overflow, cramping, or horizontal scroll.
- **SC-006**: When signed in, both the public bar and the volunteer bar are fully reachable at 375px without overlap.
- **SC-007**: The destination list is byte-for-byte the same as before (presentation-only change verified).
- **SC-008**: On wide screens the nav renders as the inline bar (no regression from current desktop presentation).

## Assumptions

- **Built on P7-R1 tokens** (feature 045): the nav is styled from the existing design tokens; this feature
  depends on that foundation.
- **The three design decisions are settled** (see Clarifications): collapse pattern = hamburger/disclosure
  menu; information architecture = flat list (no grouped sections); breakpoint = **768px** (compact below,
  inline at ≥768px). Grouped-section IA is revisited only if the destination set later demands it.
- The public nav remains a client-interactive component (it needs current-path active state and, for a
  disclosure pattern, open/close state); the volunteer bar's existing server/client split is unchanged.
- "Small screen" / "mobile" means roughly a 375px-wide phone viewport for verification.

## Dependencies

- The existing public navigation (feature 034) and its hand-maintained destination list, the signed-in
  volunteer navigation (feature 035), and the P7-R1 design tokens (feature 045). This feature is stacked
  on the (currently unmerged) P7-R1 work.
