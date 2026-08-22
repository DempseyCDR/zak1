# Feature Specification: Public design tokens & mobile-first foundation (P7-R1)

**Feature Branch**: `045-public-design-tokens`

**Created**: 2026-08-22

**Status**: Draft

**Input**: User description: "P7-R1 — Design tokens & mobile-first foundation for the public site. A small, explicit design system (color tokens, type scale, spacing, layout primitives) for the (public) route group, mobile-first at ~375px, keeping the club's brand identity and hitting WCAG AA."

## Overview

Phase 7 rewrites the club's public website, mobile-first. Today the public pages render with no shared
styling — plain server-rendered markup with ad-hoc inline sizing — so every later Phase 7 page would
otherwise invent its own look. This feature establishes the **visual foundation** every later public page
builds on: a small, explicit design system (brand colors, typography, spacing, and a few layout
primitives) designed for a ~375px phone first and enhanced upward, applied **only** to the public pages.
It preserves the club's existing brand identity, meets a WCAG AA accessibility floor, and provides the
event-type/series color coding later listings will reuse. No new public pages or content are built here.

## Clarifications

### Session 2026-08-22

- Q: How should the design system be delivered — a utility framework (Tailwind), or hand-rolled CSS-variable tokens? → A: **Hand-rolled CSS variables** — brand/type/spacing tokens defined **application-wide** in a `:root` block (shared by public and the known-future admin work), applied **public-first**; components styled with **CSS Modules** that read the tokens; brand fonts loaded via `next/font`; Tailwind deliberately deferred (layerable later on the same tokens). Resolves audit open question D-1.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A phone visitor sees a consistent, branded, legible public site (Priority: P1)

A first-time visitor opens a public page on their phone. Instead of unstyled browser-default text, they
see the club's warm cream ground, steel-blue and terracotta accents, the club's heading/body fonts, and
comfortably legible text that fits the screen without sideways scrolling. Every public page shares this
look.

**Why this priority**: This is the foundation the whole public rewrite stands on; without a consistent,
mobile-first visual system, every subsequent page is styled ad hoc and the site stays incoherent.

**Independent Test**: Load a representative public page at 375px width and confirm it renders with the
brand palette and fonts, body text is comfortably legible, and there is no horizontal scrolling — and
that a second public page shares the same system rather than its own styling.

**Acceptance Scenarios**:

1. **Given** any page in the public route group, **When** it renders, **Then** it uses the brand color tokens (cream ground, steel-blue, terracotta link, charcoal text) and the club's heading and body fonts, not browser defaults.
2. **Given** a public page viewed at ~375px, **When** it renders, **Then** content fits the viewport with no horizontal scrolling and body text is at a legible minimum size.
3. **Given** a public page viewed on a wider screen, **When** it renders, **Then** the layout enhances upward (e.g. a comfortable reading width) from the same system rather than a separate desktop-only design.
4. **Given** two different public pages, **When** compared, **Then** they share the same tokens and layout primitives (no page-specific ad-hoc sizing).

---

### User Story 2 - The public site meets an accessibility floor (Priority: P1)

A visitor using assistive technology or with low vision can read every public page: text and interactive
elements have sufficient contrast (including the footer links that are currently unreadable), each page
has a single top-level heading, and headings nest in a sensible order.

**Why this priority**: Accessibility is a floor, not a finish — baking it into the foundation is far
cheaper than retrofitting each later page, and the audit found concrete defects (unreadable footer links,
duplicate H1s) that must not propagate.

**Independent Test**: Run a contrast and heading-structure check on the public pages and confirm every
text/interactive element meets WCAG AA, the previously-broken footer link passes, each page has exactly
one H1, and no heading level is skipped.

**Acceptance Scenarios**:

1. **Given** any text or interactive element on a public page, **When** its contrast is measured against its background, **Then** it meets WCAG AA (≥4.5:1 for normal text, ≥3:1 for large text and UI).
2. **Given** the footer links (the known peach-on-blue defect), **When** rendered, **Then** they meet WCAG AA contrast.
3. **Given** any public page, **When** its heading outline is inspected, **Then** it has exactly one H1 and heading levels descend without skipping.

---

### User Story 3 - Event-type / series color coding is a reusable part of the system (Priority: P2)

Later listing and detail pages (R4/R5) need to color-code events by their series/type. The foundation
provides that coding as a defined, consistent part of the design system so every later page uses the same
colors for the same type.

**Why this priority**: The color coding is part of the club's identity and is consumed by the highest-use
later page (the schedule). Defining it once here prevents each later page from picking its own colors, but
it delivers value only once those pages exist, so it ranks below the base system and accessibility.

**Independent Test**: Confirm each of the five event types (contra, english, special, assembly, meeting)
has its defined color available from the system and renders in that color wherever a type is shown.

**Acceptance Scenarios**:

1. **Given** the five event types, **When** the design system is applied, **Then** each has its defined, distinct color available for later pages to use.
2. **Given** a type color is used in two different places, **When** rendered, **Then** it is the same color in both (single source, no per-page divergence).
3. **Given** a type color used as a background or accent for text, **When** rendered, **Then** the text on it still meets WCAG AA contrast.

---

### Edge Cases

- **Existing public pages**: the current public pages must be moved onto the system (their ad-hoc inline sizing removed), not left as a mix of old and new.
- **Non-public surfaces**: the admin, door, and volunteer surfaces must be visually unchanged — the system is scoped to the public route group only.
- **A type color with no defined mapping**: an event whose type has no color falls back to a neutral system token rather than an unstyled or broken color.
- **Long words / small screens**: content (long venue names, band names) wraps rather than forcing horizontal scroll at 375px.
- **Fonts unavailable**: if a brand font fails to load, text falls back to a legible system font in the same role (headings vs body).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST define brand color tokens — cream ground, steel-blue (with a darker hover), terracotta link (with a darker hover), peach accent, and charcoal text — and public pages MUST render from these tokens rather than browser defaults or ad-hoc values.
- **FR-002**: The system MUST define typography — a heading typeface and a body typeface matching the club's identity, plus a type scale — with legible mobile defaults and a graceful fallback when a brand font is unavailable.
- **FR-003**: The system MUST provide a spacing scale and a small set of layout primitives (including a page/content container) that public pages compose from, replacing per-page ad-hoc sizing.
- **FR-004**: The system MUST be mobile-first: public pages MUST be designed and legible at ~375px with no horizontal scrolling, and MUST enhance upward at larger widths from the same system.
- **FR-005**: All text and interactive elements on public pages MUST meet WCAG AA contrast, and the current peach-on-blue footer-link defect MUST be corrected.
- **FR-006**: Each public page MUST have exactly one top-level heading (one H1) and a heading order that descends without skipping levels.
- **FR-007**: The system MUST provide the event-type/series color coding (contra, english, special, assembly, meeting) as defined, single-source tokens consumable by later pages; a type with no defined color MUST fall back to a neutral token.
- **FR-008**: The token vocabulary (colors, type scale, spacing) MAY be defined application-wide so it is shared by later surfaces, but its **visual application** in this feature MUST be scoped to the public route group; admin, door, and volunteer surfaces MUST remain visually unchanged.
- **FR-009**: This feature MUST NOT add new public pages or content; existing public pages MUST be restyled onto the system with their ad-hoc inline styling removed.

### Key Entities *(include if feature involves data)*

- **Series/event-type color mapping**: the association of each event type (contra, english, special, assembly, meeting) with its brand color, used to color-code events consistently across later public pages. (Where this mapping lives — a stored attribute vs. a code constant — is a planning decision; the set of types and their colors is fixed here.)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of pages in the public route group render with the brand palette and fonts (no browser-default/unstyled public page remains).
- **SC-002**: 100% of text and interactive elements on public pages meet WCAG AA contrast, including the footer links, verified by a contrast audit.
- **SC-003**: Every public page has exactly one H1 and no skipped heading levels.
- **SC-004**: At 375px width, public pages show no horizontal scrolling and body text renders at a legible minimum (≥16px).
- **SC-005**: Each of the five event types renders in its single defined color wherever an event type is shown.
- **SC-006**: No public page relies on ad-hoc inline sizing; all use the shared layout primitives.
- **SC-007**: Admin, door, and volunteer surfaces show zero visual change from before this feature.

## Assumptions

- **Delivery mechanism (D-1) is decided** (see Clarifications): hand-rolled CSS-variable tokens defined app-wide + CSS Modules for component styles, applied public-first, fonts via `next/font`, Tailwind deferred. This keeps the token layer framework-agnostic and shared with the known-future admin styling, without introducing a framework prematurely (constitution §II YAGNI).
- **Series-color storage is a planning decision**: whether the type→color mapping is a stored column or a code constant is resolved in planning; the color set and semantics are fixed in this spec (FR-007).
- Brand fonts are loaded through the app's existing font-loading approach; no new third-party font service is assumed.
- The public route group and its existing pages/components already exist (features 007/034/035/036/037); this feature restyles them, it does not create them.
- No WordPress content or data migration happens in this feature.
- "Public pages" means the pages served under the public route group to unauthenticated visitors.

## Dependencies

- The existing public route group and its shared components (public navigation, schedule listing/series filter) and the `series` concept these pages already render.
- Consumed by later Phase 7 requirements (R2–R15), which build public pages on top of this foundation.
