# Feature Specification: What's On — Home Page Window

**Feature Branch**: `036-whats-on-window`

**Created**: 2026-08-04

**Status**: Draft

**Input**: Phase 6 requirement **P6-R3** (`zak1_Phase6_Requirements.md`) — `/whats-on` is the public home page,
showing dances from **two days ago** into the future in ascending order, so visitors see what just happened as
well as what's coming.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A visitor sees the current picture: recent plus upcoming dances (Priority: P1)

A member of the public opens the site's home page (`/whats-on`) and sees the club's dances from the **last two
days through the future**, earliest first — so the most-recent past dances appear at the top, followed by
what's coming up. Someone checking the morning after a dance still finds last night's dance on the home page;
someone planning ahead sees everything upcoming. The full back-catalogue of past dances is **not** here (that's
the separate history page).

**Why this priority**: This is the entire feature and the point of P6-R3 — the home page should show the current
picture (recent + upcoming), not start abruptly at "today" and hide a dance that happened hours ago. It is a
complete, demonstrable slice on its own.

**Independent Test**: With events seeded around a fixed "today", load `/whats-on` and confirm the list starts
two days ago (inclusive), excludes anything older, includes all future events, and is ordered earliest-first.

**Acceptance Scenarios**:

1. **Given** a dance that happened **yesterday**, **When** a visitor opens `/whats-on`, **Then** that dance is
   listed.
2. **Given** a dance dated **exactly two days ago**, **When** a visitor opens `/whats-on`, **Then** that dance is
   listed (the window is inclusive of the two-days-ago boundary).
3. **Given** a dance dated **three or more days ago**, **When** a visitor opens `/whats-on`, **Then** that dance
   is **not** listed.
4. **Given** dances spanning the recent past and the future, **When** the list renders, **Then** they appear in
   **ascending** date order (recent-past first, then upcoming).
5. **Given** a **cancelled** dance within the window, **When** the list renders, **Then** it still appears with
   its cancelled marker (unchanged behavior).

### Edge Cases

- **Inclusive boundary**: a dance dated exactly two days before today is included; one dated three days before is
  excluded.
- **Multiple dances on the same day**: all within-window same-day dances appear; their relative order within the
  day is unchanged from today's behavior (ordering is by date).
- **Empty window**: if no dance falls in the last two days or the future, the page shows its empty state. (The
  current empty-state wording — "No upcoming dances scheduled" — may read slightly off now that recent dances
  are included; see Assumptions.)
- **"Today" boundary**: "today" is the current calendar date; the two-day lookback is calendar-date based
  (matching how event dates are stored/compared), not a rolling 48-hour clock.
- **Detail page unaffected**: opening a specific dance's detail page is unchanged by this feature.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The public home page (`/whats-on`) MUST list dances whose date is **on or after two calendar days
  before today**.
- **FR-002**: The list MUST be ordered **ascending by date** (earliest first), so recent-past dances appear
  before upcoming ones.
- **FR-003**: The lookback MUST be a **fixed two-day** window (exactly two calendar days before today),
  consistently applied — expressed as a single, testable value.
- **FR-004**: Dances more than two days in the past MUST **not** appear on the home page (they belong to the
  separate history page, P6-R4).
- **FR-005**: For dances now included by the widened window, the existing public-safe details MUST be preserved
  — activity/series name, venue, start time, cancelled marker, and advertised price (when shown).
- **FR-006**: The feature MUST remain public and read-only — no sign-in, no data changes, no new destination.

### Key Entities

- **Home-page dance listing window**: the set of dances shown on `/whats-on` — those dated from two days before
  today onward. It reuses the existing public schedule item (date, activity/series, venue, start time, cancelled
  flag, advertised price); only the lower date bound changes (from "today" to "two days ago").

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A dance that occurred **yesterday or today** is visible on the home page.
- **SC-002**: A dance dated **exactly two days ago** is visible; a dance dated **three days ago** is not.
- **SC-003**: The home page lists dances in **ascending** date order (most-recent past first, then upcoming).
- **SC-004**: **All** future dances remain visible — the change adds recent past without removing any upcoming
  dance.

## Assumptions

- **Fixed two-day lookback**: the window is a hard-coded two calendar days, not configurable (per the Phase 6
  decision). Expressed as one clear constant so it is easy to see and to test deterministically.
- **Empty-state wording**: the existing "No upcoming dances scheduled" message may be lightly reworded to reflect
  that the page now shows recent + upcoming (e.g. "No dances to show"); treated as an optional in-scope polish,
  not a behavioral requirement.
- **Deliberate overlap with history**: the last-two-days dances will also appear on the future `/what-was-on`
  history page (P6-R4); there is intentionally no de-duplication between the two pages.
- **Out of scope**: the history page (`/what-was-on`, P6-R4) and the series filter (P6-R5) are separate features;
  the dance **detail** page is unchanged.
- **"Today"** is the server's current calendar date; the comparison is calendar-date based.
