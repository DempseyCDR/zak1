# Feature Specification: Bookings report defaults to descending date

**Feature Branch**: `029-bookings-report-desc-default`

**Created**: 2026-08-01

**Status**: Draft

**Input**: User description: "P5-R2"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Booker opens the bookings report and sees the newest events first (Priority: P1)

The Booker opens the bookings report to plan and review upcoming and recent bookings. On landing —
before touching any control — the report is ordered by event date **newest-relevant-first (descending)**,
so the events they most often care about (the nearest upcoming and the most recent past) are at the top of
the list rather than buried below years of old events.

**Why this priority**: This is the entire feature — the default landing order is the one thing that
changes. It matches the direction the smart event selector already uses everywhere else (feature 025/028),
removing a jarring inconsistency where every other date-ordered surface leads with newest-relevant but this
report led with oldest.

**Independent Test**: Open the bookings report with no interaction and confirm the first row is the
newest-relevant event and rows descend by date; this alone delivers the feature's value.

**Acceptance Scenarios**:

1. **Given** a set of bookings spanning several event dates, **When** the Booker opens the bookings report
   without changing any control, **Then** the rows are ordered by event date descending (newest first).
2. **Given** the report is showing its default descending order, **When** the Booker activates the sort
   toggle once, **Then** the order flips to ascending (oldest first).
3. **Given** the Booker flipped the report to ascending, **When** they activate the sort toggle again,
   **Then** the order returns to descending — the toggle still switches between both directions, only the
   starting direction has changed.

---

### Edge Cases

- **No bookings / empty report**: the report renders its normal empty state; sort direction is immaterial
  and no error occurs.
- **All bookings on the same date**: descending-by-date leaves same-date rows in their existing secondary
  order (this feature changes only the primary date direction, not tie-breaking).
- **A request that does not specify a sort direction** (e.g. a direct report request): the report responds
  with descending order, matching the new default rather than the old ascending one.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The bookings report MUST default to **descending** event-date order (newest-relevant-first)
  when first opened, with no user interaction required.
- **FR-002**: When no explicit sort direction is requested, the report data MUST be returned in descending
  event-date order (the default direction is consistent between the initial view and any un-parameterized
  request).
- **FR-003**: The existing sort toggle MUST continue to switch between descending and ascending order in
  both directions; only the default (starting) direction changes.
- **FR-004**: No other behavior of the bookings report changes — the same bookings, columns, filters
  (series, date range, caller, band, musician), status indicators, and modals remain exactly as before.

### Key Entities

*Not applicable — this feature changes a default ordering only; no data model, entity, or persisted state
is added or altered.*

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On opening the bookings report, 100% of the time the topmost row is the newest-relevant event
  and rows descend by date, with zero clicks required.
- **SC-002**: The sort toggle still reaches both orderings (descending and ascending) from the default view,
  verified by two successive toggles returning to the original order.
- **SC-003**: Every date-ordered event surface (the smart selector on check-in/gate/payments/treasurer and
  the bookings report) now leads with newest-relevant order — no remaining surface defaults to oldest-first.
- **SC-004**: No regression in the bookings report's other outputs — the same rows, filters, and affordances
  behave identically to before the change.

## Assumptions

- The change is a **default flip only**. Feature 020 US1 introduced the report's sort with an ascending
  default and a working toggle; this feature reverses the default to descending and does not add, remove, or
  restyle any control.
- "Newest-relevant-first" is interpreted as **descending event date** (the same direction the shared event
  selector uses), consistent with the P5-R1/025 pattern.
- The default is applied in **two coordinated places** so they agree: the report view's initial state, and
  the report's behavior when no sort direction is specified. (These are implementation locations, noted here
  only to bound scope; the observable requirement is a single consistent descending default.)
- No migration, no schema change, and no new persisted preference — the sort direction remains transient UI
  state, not a saved per-user setting.
- Out of scope: changing the secondary/tie-break ordering, adding a persisted sort preference, or altering
  any other report (this affects only the bookings report).
