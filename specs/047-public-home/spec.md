# Feature Specification: Public home page (P7-R3)

**Feature Branch**: `047-public-home`

**Created**: 2026-08-22

**Status**: Draft

**Input**: User description: "P7-R3 — Public home page. Turn `/` into a real public home for the growth funnel: hero (one optimized image + tagline), a 'new here?' orientation CTA, the next-dances strip (reusing existing schedule data), and a footer with org info. Built on P7-R1 tokens + P7-R2 nav, mobile-first; drop the old slider/embeds."

## Overview

Today the site's root path `/` is a near-empty staff-oriented stub. Phase 7 makes it a real **public home
page** aimed at the growth funnel: a first-time visitor should be *oriented* — what this dancing is, that
all are welcome, no partner needed, what it costs — **before** being shown a listing. The home presents a
single optimized hero image + a tagline in the club's voice, a "new here?" orientation call-to-action, the
next upcoming dances (reusing the existing public schedule), and a footer with organization info. It is
mobile-first, built on the P7-R1 design tokens and the P7-R2 navigation, and deliberately sheds the old
WordPress home's worst trait — a multi-megabyte image slider — for one optimized hero image and no
carousel.

## Clarifications

### Session 2026-08-22

- Q: Does `/` become the home, or keep redirecting to `/whats-on`? → A: **`/` becomes the home page** — it renders the hero/orientation/next-dances/footer, with a clear link to `/whats-on` for the full schedule (no redirect).
- Q: Keep lazy video embeds on the home, or drop video? → A: **Drop video from the home** — no YouTube embeds; orientation is text + the single hero image (lightest mobile). A "what is contra?" video belongs on a later orientation page, not the landing.
- Q: Is the footer site-wide across public pages, or home-only? → A: **Site-wide public footer** — rendered on every public page via the shared `(public)` layout (not on admin/door).
- Q: Announcement (R13) & 50th-anniversary (R14) regions on the home — placeholders now or deferred? → A: **Wholly deferred** — no announcement/anniversary regions in R3; they arrive with their own features. The home layout can absorb an announcement banner later without pre-reserving space.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A newcomer is oriented before any listing (Priority: P1)

A first-time visitor lands on `/`. Before any schedule, they see a welcoming hero (image + a tagline in
the club's voice) and a clear "new here?" invitation that answers what contra/English country dancing is,
that all are welcome and no partner is needed, and roughly what it costs — then points them onward.

**Why this priority**: This is the reason for R3 — the growth funnel. Regulars already have `/whats-on`;
newcomers need orientation first, which the current de-facto home (a bare listing) does not provide.

**Independent Test**: Load `/` as a first-time visitor and confirm the orientation content (hero +
tagline + "new here?" CTA) is present and reads before/above any dance listing, and that the CTA leads a
newcomer onward.

**Acceptance Scenarios**:

1. **Given** a first-time visitor on `/`, **When** the page loads, **Then** a hero (one image + a tagline) and a "new here?" orientation call-to-action are presented before any dance listing.
2. **Given** the orientation CTA, **When** activated, **Then** it leads the visitor onward (to orientation detail and/or the schedule).
3. **Given** the home on a phone, **When** it loads, **Then** the hero is a single optimized image (no carousel/slider) and the page has no horizontal scroll.

---

### User Story 2 - A visitor sees the next dances at a glance (Priority: P1)

Any visitor (newcomer or regular) sees the next upcoming dances on the home, each linking to its detail,
so "is there a dance soon?" is answered without leaving the home.

**Why this priority**: The dominant public question is "is there a dance soon / where?"; the home must
answer it even while orienting newcomers. It reuses the existing schedule, so it is high-value and low-risk.

**Independent Test**: With upcoming dances in the schedule, load `/` and confirm the next dances appear
and each links to its detail; with none scheduled, confirm a clear "nothing coming up" message instead.

**Acceptance Scenarios**:

1. **Given** upcoming dances exist, **When** `/` loads, **Then** the next dances are shown, each linking to its detail page.
2. **Given** no upcoming dances, **When** `/` loads, **Then** a clear empty-state message is shown rather than a blank area.

---

### User Story 3 - Every public page has an informative footer (Priority: P2)

A visitor can find the club's organization info — identity, key links, and a way to support/donate — in a
footer.

**Why this priority**: Org info and a support affordance are expected site furniture and part of the home's
job; they are valuable but secondary to orientation and the schedule.

**Independent Test**: Load the home (and, if site-wide, another public page) and confirm a footer with
organization info and a donate/support affordance is present and its links work.

**Acceptance Scenarios**:

1. **Given** the home page, **When** it loads, **Then** a footer with organization info and a donate/support affordance is present.
2. **Given** the footer links, **When** activated, **Then** they lead to the correct destinations.

### Edge Cases

- **No upcoming dances**: the next-dances area shows a clear message, not a blank/broken region.
- **Slow / metered connection**: the home stays light — one optimized hero image, no carousel or heavy
  autoplaying media (the old multi-MB slider is the anti-pattern being removed).
- **Hero image fails to load**: the tagline/orientation text remains legible (the hero is not the only way
  the welcome is conveyed).
- **Replacing the stub**: the current staff-oriented content on `/` (the "CDR Platform" heading + the
  Contacts link) is removed from the public home.
- **Small screen**: content stacks and the hero scales responsibly at ~375px with no horizontal scroll.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `/` MUST render a **public** home page, styled with the P7-R1 tokens and carrying the P7-R2 navigation, mobile-first — replacing the current staff-oriented stub.
- **FR-002**: The home MUST present a **hero**: one optimized image plus a tagline in the club's voice, with **no** carousel/slider.
- **FR-003**: The home MUST present a **"new here?" orientation** call-to-action that conveys what the dancing is, that all are welcome and no partner is needed, and roughly the cost, and leads a newcomer onward.
- **FR-004**: The home MUST show the **next upcoming dances** (reusing the existing public schedule), each linking to its detail, and MUST show a clear empty-state when there are none.
- **FR-005**: A **footer** with organization info (club identity, key links, and a donate/support affordance) MUST render on **every public page** (via the shared `(public)` layout), not just the home; admin/door surfaces do not get it.
- **FR-006**: The home MUST NOT carry the old site's multi-megabyte slider, heavy media, or **any video/YouTube embeds**; visual media is limited to the single optimized hero image.
- **FR-007**: The home MUST be legible on a ~375px phone with **no horizontal scrolling**, and the hero image MUST be sized responsibly for small screens.
- **FR-008**: The home MUST meet **WCAG AA** contrast (via the R1 tokens), with exactly **one H1** and an honest heading order.
- **FR-009**: The staff-oriented content currently on `/` (the "CDR Platform" heading and the Contacts link) MUST be removed from the public home.

### Key Entities

- Not applicable — no new data model. The home reuses the existing public **schedule** data for the
  next-dances strip; the hero image + tagline and the orientation/footer copy are static content, not
  stored records.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time visitor on `/` encounters orientation (hero + tagline + "new here?" CTA) before any dance listing.
- **SC-002**: The next upcoming dances appear on `/` and each links to its detail; when none are scheduled, a clear message is shown.
- **SC-003**: A footer with organization info and a donate/support affordance is present and its links resolve.
- **SC-004**: The home loads with a single optimized hero image and no carousel; the home's image payload is a small fraction of the old slider (hero image responsibly sized for mobile).
- **SC-005**: At 375px the home has no horizontal scrolling, exactly one H1, and meets WCAG AA contrast.
- **SC-006**: `/` no longer shows staff/admin-oriented content (the old stub is gone).

## Assumptions

- **Built on P7-R1 tokens (045) and P7-R2 nav (046)**: this feature is stacked on those (currently
  unmerged) and styles the home from the shared tokens and nav.
- **Reuses the existing public schedule** (the data behind `/whats-on`) and the shared dance-list
  presentation for the next-dances strip — no new schedule logic.
- **The hero uses a single static, optimized image asset.** The general per-event/per-performer
  **image-storage model** is explicitly **out of scope** (that is the R5/R9 decision); R3 does not
  introduce image upload/storage.
- **The four scope/UX decisions are settled** (see Clarifications): (1) `/` **becomes** the home (no
  redirect); (2) **no video** on the home (drop YouTube embeds); (3) the footer is **site-wide** across
  public pages; (4) the announcement (R13) and 50th-anniversary (R14) regions are **wholly deferred** to
  their own features — not placeheld on the home now.

## Dependencies

- The P7-R1 design tokens (feature 045) and P7-R2 navigation (feature 046); the existing public schedule
  data + shared dance-list component. This feature is stacked on the (unmerged) 045/046 work.
