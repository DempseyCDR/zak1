# Feature Specification: Event detail page enrichment (P7-R5)

**Feature Branch**: `049-event-detail`

**Created**: 2026-08-23

**Status**: Draft

**Input**: User description: "P7-R5 — grow `/whats-on/[eventId]` from a thin detail into a real, shareable public event page: series (color-coded with the R1 palette, consistent with the R4 cards), date/time, a venue block (name, tappable map link, directions/transit/parking note), price, the confirmed performer lineup (bands + members + callers), the description, and a hero image slot fed by a per-series default static asset. Keep the cancelled marker and confirmed-only rule; no upload substrate (D-4), no venue schema (R8), no roster/promo links (R9), no single-source pricing (R10)."

## Overview

Every event card on `/whats-on`, `/what-was-on`, and the home strip (feature 048, P7-R4) links its whole
surface to `/whats-on/<eventId>`. Today that page renders the event's data but plainly — an unstyled heading,
a run-on meta line, a bare venue paragraph, and a flat performer list. This feature turns it into a real,
**shareable public event page**: the page a visitor lands on from a card, and the URL a member pastes into a
"come to this dance" post. It presents the event coherently and mobile-first, styled with the P7-R1 tokens and
**color-coded by series to match the R4 cards**: a hero image, the series + date/time, a venue block (name, a
tappable address/map link, and a directions note), the price, the confirmed performer lineup (bands with their
members, and callers), and the description. The confirmed-bookings-only public rule (018) and the cancelled
marker (018 / B25) are retained. This is a **presentation enrichment** of an existing page plus a **hero image
slot fed by a per-series default static asset** — no upload capability, no new public pages.

## Clarifications

### Session 2026-08-23

- Q: Where should the event page's hero image come from (D-4 = committed static assets, no uploads)? → A:
  **Per-series default photo** — one curated static image per dance style; a series with no image degrades to a
  clean styled header (no broken image). No per-event override, no band-photo-as-hero.
- Q: How should the venue block handle the directions/transit/parking note, given R8 has not added
  `venues.directions` yet? → A: **Defer the note to R8** — R5 shows the venue name + tappable address/map link
  now, and renders the directions note only once R8 adds the field. R5 touches no venue schema/data.
- Q: How should the confirmed lineup be presented, and does it show band members/instruments? → A: **Bands +
  members + callers, with a "to be announced" empty state** — group by band, showing its members (and
  instruments when available) plus the caller(s); extend the public event-detail projection to carry band
  members for this.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A visitor lands on a dance's page from a card (Priority: P1)

A visitor taps a card on `/whats-on` and arrives at that dance's page. They immediately see what it is (series,
color-coded to match the card they tapped), when it is (date + start time), where it is (venue with a tappable
map link), what it costs, who's playing (the confirmed lineup), and a short description — all legible on a phone,
with a welcoming hero image at the top. It reads as a finished page, not a data dump.

**Why this priority**: This is the destination of the site's most-used surface (the R4 cards) and the shareable
artifact; if this page is thin, every "come to this dance" link is thin.

**Independent Test**: Load `/whats-on/<eventId>` at 375px for a fully-booked event and confirm the series
(color-coded), date/time, venue (with map link), price, lineup, description, and hero image all render as a
coherent, scrollable page with no horizontal scroll and exactly one H1.

**Acceptance Scenarios**:

1. **Given** an event with a venue, a confirmed band, a price, and a description, **When** its page loads,
   **Then** the series (color-coded to match the R4 card), date, start time, venue (name + tappable map link),
   price, lineup, and description are all shown.
2. **Given** a visitor arriving from a card, **When** the page loads, **Then** the series color treatment on the
   page matches that series' color on the card (single source, no divergence).
3. **Given** a phone (~375px), **When** the page loads, **Then** there is no horizontal scroll and the page has
   exactly one H1.
4. **Given** a cancelled event, **When** its page loads, **Then** a clear cancelled marker is shown (retained).

---

### User Story 2 - See who is playing (the confirmed lineup) (Priority: P1)

A visitor deciding whether to come wants to know the band and caller. The page shows the **confirmed** lineup:
each booked band with its name (and, when available, its members and their instruments), and the caller(s). When
nothing is confirmed yet, the page says so rather than showing an empty gap.

**Why this priority**: "Who's playing?" is a top reason people open an event page; it is core to the decision to
attend and to the shareable value.

**Independent Test**: For an event with a confirmed band + caller, confirm both appear with their names (and
members when present); for an event with no confirmed lineup, confirm a clear "lineup to be announced" message
appears instead of a blank section.

**Acceptance Scenarios**:

1. **Given** an event with a confirmed band and caller, **When** the page loads, **Then** the band (with its
   members when available) and the caller are listed.
2. **Given** an event with no confirmed lineup, **When** the page loads, **Then** a clear "to be announced"
   message is shown, not an empty section.
3. **Given** only confirmed bookings are public (018), **When** the lineup renders, **Then** unconfirmed/tentative
   bookings never appear.

---

### User Story 3 - A welcoming hero image (Priority: P2)

The page opens with a hero image so it feels like a real event page and reads well when shared. Because per-event
images are not managed yet (D-4), the hero is a **per-series default photo** (one image per dance style); a
series with no default photo degrades gracefully to a styled header with no broken image.

**Why this priority**: The image lifts the page from functional to inviting and improves the shared-link
appearance; it is valuable but secondary to the information (US1) and lineup (US2).

**Independent Test**: Confirm an event whose series has a default photo shows that hero image; an event whose
series has no default photo shows a clean header with no broken/blank image element.

**Acceptance Scenarios**:

1. **Given** a series with a default photo, **When** an event of that series loads, **Then** the series' default
   image is shown as the hero.
2. **Given** a series with no default photo, **When** an event of that series loads, **Then** the page renders a
   clean header with no broken image.

### Edge Cases

- **No venue assigned**: the venue block is omitted (no blank/broken block).
- **No price advertised**: the price is omitted (no placeholder), matching the R4 card rule.
- **No description**: the description section is omitted.
- **No confirmed lineup**: a clear "lineup to be announced" message (not an empty section) — US2.
- **No hero image for the series**: a clean header, no broken image — US3.
- **A series with no color mapping**: the series treatment uses the same neutral default as the R4 cards.
- **Cancelled event**: still shown, with a clear cancelled marker (018 / B25).
- **Unknown/removed event id**: the page returns not-found (retained behavior).
- **Long venue/band/description text**: wraps gracefully at 375px, no horizontal scroll.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `/whats-on/<eventId>` MUST present, for a public event, the **series** (color-coded to match the
  R4 cards), the **date**, the **start time**, the **advertised price** (when present), and the **description**
  (when present).
- **FR-002**: The page MUST show a **venue block** — the venue name and the **address as a tappable link to the
  map**. A **directions/transit/parking note** is **deferred to P7-R8** (the `venues.directions` field): R5 shows
  only the name + address/map link now, and MUST render the note once R8's field exists (graceful absence until
  then). R5 adds no venue schema/data.
- **FR-003**: The page MUST show the **confirmed performer lineup** — each booked band grouped with **its members
  (and instruments when available)** and the caller(s) — and MUST show a clear **"to be announced"** message when
  no lineup is confirmed. Only **confirmed** bookings appear (018 public rule retained). The public event-detail
  projection is **extended to carry band members** for this.
- **FR-004**: The page MUST show a **hero image** drawn from a **per-series default static asset**, degrading to a
  clean header (no broken image) when the series has no default photo.
- **FR-005**: The series color MUST come from the **same source as the R4 cards** (the P7-R1 palette via the
  per-series color map), so a series is the same color on its card and on its page.
- **FR-006**: A **cancelled** event MUST still be shown with a clear cancelled marker (018 / B25 retained).
- **FR-007**: The page MUST be **mobile-first**: legible at ~375px with **no horizontal scroll**, and MUST keep
  **exactly one H1** with honest heading order; WCAG AA contrast holds (the series color used as an accent, not
  behind normal-size text — matching the R4/R1 rule).
- **FR-008**: An **unknown or non-public** event id MUST return not-found (retained).
- **FR-009**: The page MUST NOT introduce any **image upload** capability, any **venue schema** change, any new
  **public page**, or any change to how price is sourced — it consumes the existing public projection plus a
  per-series default image.

### Key Entities

- **Public event detail** (the per-event public projection behind this page): already carries the event id,
  date, series name, a venue block (name, address, map link), label, start time, description, cancelled flag,
  advertised price, band blocks (name, bio, photo), and the public performer display. This feature **presents**
  that data richly, adds a **hero image** derived from the event's **series**, and **extends the projection with
  the band members** (name + instrument) for each confirmed band so the lineup can group a band with its members.
- **Series → default hero image** (a per-series code/asset mapping): each dance style maps to one committed
  static image used as the page hero; an unmapped series → no hero (clean header). Parallel to the R4 series→color
  map (a fixed, curated constant — not admin-managed, per D-4). *(A single source of truth for series keys shared
  by this map, the R4 color map, and scattered literals is deferred as backlog **B48**.)*

## Success Criteria *(mandatory)*

- **SC-001**: On `/whats-on/<eventId>` at 375px, a visitor can see the event's series, date, time, venue, price,
  and lineup as a coherent page with **no horizontal scroll** and **exactly one H1**.
- **SC-002**: The series color on the page **matches** that series' color on the R4 card (same source).
- **SC-003**: For a fully-booked event, the **confirmed** band(s) and caller(s) are shown; for an event with no
  confirmed lineup, a **"to be announced"** message is shown instead of an empty section.
- **SC-004**: The **venue** shows its name and a **tappable map link**; a missing venue, price, or description
  degrades gracefully (the section is omitted, never blank/broken).
- **SC-005**: An event whose series has a default photo shows that **hero image**; one whose series has none shows
  a clean header with **no broken image**.
- **SC-006**: A cancelled event is clearly marked; an unknown event id returns not-found.
- **SC-007**: No image-upload UI, no venue schema change, and no new public page are introduced.

## Assumptions

- **Built on P7-R1 tokens (045), P7-R2 nav (046), and the P7-R4 cards + series→color map (048)** — this branch
  stacks on `048-whats-on-cards` so the `seriesColor` map is available; the page's series color reuses it.
- **Reuses the existing public projection** — `getPublicEventDetail` already returns the venue block, band blocks,
  public performers, description, price, and cancelled flag; this is a presentation enrichment. Per the
  clarification, the projection **is extended to carry band members (name + instrument)** so the lineup can group
  a band with its members; no schema change is implied (members already exist in the data model).
- **Hero image = per-series default static asset (D-4, clarified)** — one committed, curated static image per
  dance style; graceful omission (clean header) when the series has no image. **No per-event override, no
  band-photo-as-hero, no upload substrate** (deferred, but nothing here precludes it).
- **Directions note (clarified)** — the venue block shows the name + address/map link now; the
  **directions/transit/parking** text field is **P7-R8** (`venues.directions`, not yet added), so R5 renders that
  note only once R8's field exists and adds no venue schema/data itself.
- **Lineup presentation (clarified)** — bands are grouped with their members (and instruments when available) and
  callers are listed, with a "to be announced" empty state when nothing is confirmed.
- **Pricing stays as the existing `advertisedPrice`** — single-source pricing is P7-R10 (out of scope).

## Dependencies

- The P7-R1 tokens/color map (045), the P7-R2 nav (046), and the **P7-R4 cards + `seriesColor` map (048)** —
  this feature stacks on 048. The existing `getPublicEventDetail` projection and the `/whats-on/[eventId]` page
  (feature 037), the confirmed-only + cancelled rules (018), `venues` name/address/map (007-era), and the band /
  performer public display (bands, performers). **P7-R8** later adds the venue directions field this page will
  render; **P7-R9** later adds performer roster pages + promo links (out of scope here).

## Out of Scope

- **Per-event image upload / management** — D-4 defers the upload substrate to a later phase.
- **Venue `is_public` / `directions` schema fields and the standalone directions page** — that is **P7-R8**.
- **Series landing pages** ("What is contra?") — **P7-R6**.
- **Public performer roster pages and promotional links** — **P7-R9**.
- **Single-source pricing** — **P7-R10**; this page displays the existing `advertisedPrice`.
