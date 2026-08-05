# Feature Specification: Dance History Page + Series Filter

**Feature Branch**: `037-history-series-filter`

**Created**: 2026-08-04

**Status**: Draft

**Input**: Phase 6 requirements **P6-R4** (public dance history page `/what-was-on`) and **P6-R5** (series filter
on both public event-listing pages), specified together as one feature (`zak1_Phase6_Requirements.md`, public
event listings thread). Builds on feature 036 (the `/whats-on` home window).

## Clarifications

### Session 2026-08-04

- Q: How is the series filter applied — server-rendered via the URL, or a client-side control? → A:
  Server-rendered via a **URL query parameter** (e.g. `/what-was-on?series=…`). Both listings stay pure server
  components (no client bundle); the page reads the series from the address and renders the filtered list on the
  server; the filter control is plain form/links. The filtered view is natively shareable/bookmarkable (FR-006).
- Q: Which series does the filter offer as options? → A: **All** club series — the same option set on both
  pages. A selected series with no matching dances falls through to the empty state (rather than listing only
  series that have events in the window).

### User Story 1 - A visitor browses past dances (Priority: P1)

A member of the public opens a **history** page (`/what-was-on`) and sees the club's **past** dances — every
dance dated before today — with the **most recent first**. From any entry they can open its detail (the same
detail page the home page links to). This keeps the full back-catalogue off the home page while still letting
anyone look back at who played and when.

**Why this priority**: The history page is the headline of this feature and the natural complement to the home
page (036): home shows now/soon-plus-recent, history shows the past. It stands alone and is demonstrable on its
own.

**Independent Test**: With events seeded across past and future, open `/what-was-on`; confirm only dances before
today appear, most-recent-first, and each links to its detail page.

**Acceptance Scenarios**:

1. **Given** dances in the past and the future, **When** a visitor opens `/what-was-on`, **Then** only the dances
   dated **before today** are listed.
2. **Given** several past dances, **When** the list renders, **Then** they appear **most recent first**
   (descending by date).
3. **Given** a past dance in the list, **When** the visitor clicks it, **Then** its detail page opens (the same
   `/whats-on/<eventId>` detail used from the home page).
4. **Given** a dance in the **last two days**, **When** a visitor views both pages, **Then** it appears on
   **both** `/whats-on` (036 window) and `/what-was-on` — the overlap is intentional (no de-duplication).
5. **Given** a **cancelled** past dance, **When** the history renders, **Then** it appears with its cancelled
   marker (same public-safe details as the home page).

### User Story 2 - A visitor filters a listing by series (Priority: P2)

A visitor who cares about only one series (e.g. a specific dance) narrows either listing — the home page
(`/whats-on`) or the history page (`/what-was-on`) — to that series, seeing only its dances; clearing the filter
shows all series again. The filter is reflected in the page's address so a narrowed view can be shared or
bookmarked.

**Why this priority**: A convenience that sharpens both listings once they exist. It depends on the listings
(US1 delivers the history one; the home one already exists), so it is P2.

**Independent Test**: On each listing, apply a series filter and confirm only that series' dances show; clear it
and confirm all return; confirm the narrowed view is reachable by its address.

**Acceptance Scenarios**:

1. **Given** dances of several series on a listing, **When** the visitor selects one series, **Then** only that
   series' dances are shown (the page's other rules — window and order — still apply).
2. **Given** a filtered listing, **When** the visitor clears the filter, **Then** all series' dances return.
3. **Given** a filtered listing, **When** the visitor shares/opens its address, **Then** the same filtered view
   loads.
4. **Given** the filter applies to **both** pages, **When** the visitor filters `/whats-on` and `/what-was-on`
   the same way, **Then** each shows only that series' dances within its own window.

### Edge Cases

- **Empty history / empty filtered view**: if no dance matches (no past dances, or none of the selected series),
  the page shows an appropriate empty state rather than an error.
- **Boundary with the home window**: `/whats-on` shows `event_date ≥ today − 2`; `/what-was-on` shows
  `event_date < today`. The two-day overlap is intentional (US1 scenario 4); there is no gap and no de-dup.
- **Unknown/invalid series in the address**: a filter value that matches no series yields an empty (not broken)
  listing.
- **Detail page unaffected**: the per-dance detail page is unchanged; both listings link to it.
- **Long history**: the history list may be long; see Assumptions for pagination.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A public page `/what-was-on` MUST list every dance dated **before today**.
- **FR-002**: `/what-was-on` MUST order dances **most recent first** (descending by date).
- **FR-003**: Each `/what-was-on` entry MUST link to the **same** per-dance detail page as `/whats-on` (i.e.
  `/whats-on/<eventId>`); no separate history detail page.
- **FR-004**: `/what-was-on` MUST present the same public-safe details as `/whats-on` — activity/series name,
  venue, start time, cancelled marker, and advertised price (when shown).
- **FR-005**: Both `/whats-on` and `/what-was-on` MUST be **filterable by series** — when a series is selected,
  only that series' dances appear (within the page's own date window and order); with no filter, all series
  appear.
- **FR-006**: The series filter MUST be applied **server-side via a URL query parameter** (e.g.
  `?series=<key>`), so the filtered view is shareable/bookmarkable and both listings remain server-rendered (no
  client bundle).
- **FR-007**: The feature MUST remain **public and read-only** — no sign-in, no data changes, no new detail
  destination.
- **FR-008**: The `/whats-on` ↔ `/what-was-on` **overlap** for dances in the last two days MUST be preserved (a
  dance in that window appears on both pages); the two pages MUST NOT drop or de-duplicate it.
- **FR-009**: The filter MUST offer **all** club series as options — the same option set on both pages —
  independent of whether a given series has dances in the current window.

### Key Entities

- **Public dance listing (existing, reused)**: the public-safe item already shown on `/whats-on` — date,
  activity/series, venue, start time, cancelled flag, advertised price. Both pages render this shape.
- **History window**: dances with `event_date < today`, ordered descending — the new read for `/what-was-on`.
- **Series filter**: an optional selection of one series applied to a listing; absent = all series. Reflected in
  the page address (FR-006).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A visitor can view the club's past dances on `/what-was-on`, most recent first.
- **SC-002**: A dance from **last week** appears on `/what-was-on` and **not** on `/whats-on`; a dance from
  **yesterday** appears on **both**.
- **SC-003**: Selecting a series on either listing shows **only** that series' dances; clearing it restores all.
- **SC-004**: A filtered listing is reachable by its address alone (shareable/bookmarkable) and loads the same
  filtered view.
- **SC-005**: Every history entry opens the same detail page as the corresponding home-page entry.

## Assumptions

- **Filter mechanism (decided — Clarifications 2026-08-04)**: the series filter is applied **server-side via a
  URL query parameter** (e.g. `?series=<key>`); both listings stay pure server components, and the filtered view
  is shareable/bookmarkable (FR-006). Not a client-side widget.
- **Which series are offered (decided — Clarifications 2026-08-04)**: the filter offers **all** club series (the
  same option set on both pages); a selected series with no matching dances shows the empty state. Not limited to
  series with events in the window.
- **History size / pagination**: assume the full history is listed (no pagination/cap) for now; revisit if the
  list grows large.
- **Detail link target**: both listings link to `/whats-on/<eventId>` (decided, Phase 6) — the detail page is
  date-agnostic and already works for past events.
- **"Today"** is the server's current calendar date; `/what-was-on` uses `event_date < today`, consistent with
  the home window's calendar-date comparison.
- **Out of scope**: any change to the per-dance detail page; the volunteer/staff surfaces; the home window itself
  (feature 036).
