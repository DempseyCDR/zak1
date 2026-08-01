# Feature Specification: Shared filterable event selector (P5-R1)

**Feature Branch**: `028-shared-event-selector`

**Created**: 2026-08-01

**Status**: Draft

**Input**: User description: "R1" — Phase 5 P5-R1: give the gate, payments, and treasurer surfaces the same
smart event selector the check-in page got in feature 025, and make it a single shared, filterable control
used consistently across all of them. It already shows the event the user almost certainly wants — the one
today, or the most recent past one — lists events newest-relevant-first with enough detail to tell same-day
events apart, and adds filtering (by series and date range).

## Overview

Four staff surfaces are each scoped to **one event** at a time: door **check-in**, the **gate** (money), the
performer **payments** page, and the **treasurer report**. Today they pick that event inconsistently — check-in
got a smart selector in feature 025 (defaults to the most recent event, ordered newest-first, labeled to tell
same-day events apart), but the gate's selector shows only a bare date with no default, the payments selector
is likewise bare, and the treasurer report has **no working selector at all** (its "most recent" entry link is
broken — it lands on a report for an event that can't be resolved). So the FS and treasurer hunt for the right
event, and a wrong pick silently mis-files money or shows the wrong report.

This feature makes all four surfaces use **one shared event selector** that behaves the same everywhere: it
**defaults to the event happening today, or the most recent past one**, lists events **newest-relevant-first**,
shows **date + start time + label** so two events on the same day are distinguishable, and adds **filtering by
series and by date range** so an older or specific-series event is quick to find. The user **confirms** a
choice by pressing Enter or tapping an option (it doesn't jump on every keystroke of the filter), and each
surface **opens on the default event** and lets the user switch to another **in-page**. Each surface keeps its
own follow-on behavior on selection — the gate still opens the selected event's door record, etc. — the
selector only reports which event is chosen.

The result: the FS and treasurer land on the right event without hunting, on every event-scoped page, with one
consistent control.

## Clarifications

### Session 2026-08-01

- Q: How should "openable at a specific event" (deep-link) work across the four surfaces? → A: Option C — **no
  deep links** (shareable/bookmarkable per-event URLs are YAGNI). The selector is **in-page state**: each
  surface opens on the default event and the user switches events in-page; the event is not encoded in the URL.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Land on the right event without hunting (Priority: P1)

Opening the gate, the payments page, or the treasurer report pre-selects the event the user almost certainly
wants — today's, or the most recent past one — with events listed newest-first and enough detail (date, start
time, label) to tell same-day events apart. (Check-in already does this; it now uses the same shared control
with no change in behavior.)

**Why this priority**: A wrong or blank default silently mis-files money and shows the wrong report; a good
default across every event-scoped page removes a whole class of errors and the daily friction of hunting.

**Independent Test**: With events before, on, and after today, open each of the gate, payments, and treasurer
surfaces and confirm each pre-selects the most recent event on or before today, ordered newest-first, with a
readable date + time + label.

**Acceptance Scenarios**:

1. **Given** events before, on, and after today, **When** the user opens the gate (or payments, or treasurer),
   **Then** the selector defaults to today's event if one exists, otherwise the latest event before today.
2. **Given** two events on the same day, **When** the selector is shown, **Then** each option shows the date,
   the start time, and the label so they are distinguishable.
3. **Given** the treasurer report — which had no working selector — **When** the user opens it, **Then** it
   lands on the default event via the shared selector (the previously-broken "most recent" entry now works).

### User Story 2 - Filter the event list (Priority: P1)

The user narrows the event list by **series** and by a **date range**, so working an older event or a specific
series doesn't mean scrolling a long list. The smart default and newest-first ordering still apply within the
active filter.

**Why this priority**: A plain dropdown does not scale as the event history grows; filtering is what keeps the
selector usable over time.

**Independent Test**: With many events across series and dates, apply a series filter and a date range and
confirm the list narrows accordingly and the default lands on the most recent event within the filter.

**Acceptance Scenarios**:

1. **Given** events across several series, **When** the user filters by a series, **Then** only that series'
   events are offered and the default is the most recent one within it.
2. **Given** a date range filter, **When** it is applied, **Then** only events in that range are offered,
   newest-first.
3. **Given** an active filter, **When** the filtered set is non-empty, **Then** the default selection is the
   most recent event on or before today **within** the filter.

### User Story 3 - Deliberate selection (Priority: P2)

Selecting an event is **confirmed** by an explicit action (pressing Enter or tapping an option), not fired on
every intermediate keystroke while filtering — so the surface's follow-on behavior (e.g. opening a door record)
does not thrash while the user is still narrowing the list.

**Why this priority**: Committing on every filter keystroke would repeatedly trigger side effects (opening door
records, reloading reports) before the user has actually chosen; an explicit confirm keeps selection
intentional.

**Independent Test**: Type into the filter without picking an option and confirm the selected event does not
change until Enter/tap.

**Acceptance Scenarios**:

1. **Given** the user is typing/adjusting the filter, **When** the query changes, **Then** the selected event
   does **not** change (and no follow-on action fires) until they press Enter or tap an option.
2. **Given** an option is tapped or Enter is pressed, **When** the choice is confirmed, **Then** the surface
   switches to that event and its follow-on behavior fires once.

### User Story 4 - One consistent selector across every surface (Priority: P2)

The **same** selector appears and behaves identically on check-in, gate, payments, and the treasurer report;
each surface keeps its own follow-on behavior on selection (the gate opens/loads the selected event's door
record, etc.) — the selector itself only reports which event is chosen.

**Why this priority**: The inconsistency this feature removes is *between* surfaces; a shared control is what
guarantees they stay consistent and keeps the behavior in one place.

**Independent Test**: Exercise the selector on all four surfaces and confirm identical default/order/label/
filter behavior; confirm each surface's own action still fires on selection (e.g. the gate loads the door
record).

**Acceptance Scenarios**:

1. **Given** any of the four surfaces, **When** its selector is shown, **Then** its default, ordering, labels,
   and filters behave identically to the others.
2. **Given** the gate, **When** an event is selected, **Then** that event's door record is opened/loaded (the
   surface's own behavior), driven off the selector's chosen event.

### Edge Cases

- **No events at all**: the selector shows a clear empty state and nothing is selected.
- **All events in the future** (none on or before today): default to the **soonest upcoming** event.
- **Filter empties the list**: no default is selected while the filter matches nothing; clearing/relaxing the
  filter restores a default.
- **Filter excludes the current selection**: the default recomputes within the filtered set.
- **Same-day events**: always distinguishable by start time + label in the option text.
- **Gate side effect on switch**: changing the selected event loads that event's door record; switching away
  and back is safe (idempotent open).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: On each single-event surface (check-in, gate, payments, treasurer report), opening the surface
  MUST pre-select the **most recent event on or before today**; if none exists, the **soonest upcoming**; if no
  events exist, **no selection**.
- **FR-002**: The event list MUST be ordered **newest-relevant-first** (by date, then start time, descending).
- **FR-003**: Each option MUST show the **date, start time, and label**, so two events on the same day are
  distinguishable.
- **FR-004**: The selector MUST offer **filtering by series and by a date range**; the smart default and
  ordering apply **within** the active filter.
- **FR-005**: A selection MUST be **confirmed by an explicit action** (Enter or tap), not committed on every
  intermediate change while filtering.
- **FR-006**: Each surface MUST **open on the default event** (per FR-001) and let the user **switch to any
  other event via the selector, in-page**. The selected event is **in-page state** — it is **not** encoded in a
  URL, and shareable/bookmarkable per-event links are **out of scope** (YAGNI, per clarification).
- **FR-007**: The selector MUST be a **single shared control** used identically on all four surfaces
  (consistent default, ordering, labels, and filters).
- **FR-008**: Each surface MUST retain its **own follow-on behavior** on selection (e.g. the gate opens/loads
  the selected event's door record); the selector itself only reports the chosen event.
- **FR-009**: When **no event can be selected** — no events exist, or the active filter matches none — the
  surface MUST show a clear **empty state**, take no event-scoped follow-on action, and let the user
  clear/relax the filter to recover a selection.
- **FR-010**: The **treasurer report** MUST have a **working entry point** — the shared selector, defaulting to
  the most recent event on open — replacing the currently-broken "most recent" link.

### Key Entities *(include if data involved)*

- **Event**: the dance being worked on; carries a date, a start time, a label, and a series. The selector reads
  these to order, label, filter, and default; it creates or changes no event data.
- **Selected event (per surface)**: which event a surface is currently scoped to — **in-page state** driven by
  the shared selector (default on open; switchable in-page), consumed by each surface's own behavior. Not
  persisted in the URL.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On each of the four surfaces, opening it pre-selects the most recent event on or before today
  with **no manual action** in the common case.
- **SC-002**: A user can reach any past event through the series + date-range filters **without scrolling** an
  unfiltered full-history list.
- **SC-003**: Two same-day events are **always** distinguishable in the selector.
- **SC-004**: A user can switch a surface to any other event **in-page** in a single confirmed action — no URL
  editing, no page reload.
- **SC-005**: The selector's default/order/label/filter behavior is **identical** across all four surfaces.
- **SC-006**: **No regression** — check-in's existing default/sort/label behavior is unchanged, and each
  surface's follow-on action (gate door record, treasurer report load, etc.) still fires on selection.

## Assumptions

- **Builds on feature 025**: check-in already has the smart default/sort/label, and the event list already
  returns newest-first — this feature **extracts** that into one shared, filterable control and applies it to
  the other three surfaces.
- **No deep links (YAGNI, per clarification)**: the selected event is **in-page state**, not encoded in a URL;
  each surface opens on the default and the user switches in-page. Shareable/bookmarkable per-event links are
  out of scope.
- **"Most recent ≤ today"** uses the viewer's current date.
- **The bookings report is out of scope**: it is a multi-event **filtered list**, not a one-event pick, so it
  does not use this single-event selector (it may share filter conventions, but that is not required here).
- **The payments-page workflow redesign is separate (R3)**: this feature only gives the payments surface the
  shared selector, not the new payment entry flow.

## Out of Scope

- Shareable/bookmarkable per-event URLs / deep links (YAGNI, per clarification) — the selector is in-page state.
- The bookings report's multi-event filtered list (P5-R2 sort default and its own filters are separate).
- The payments-page per-performer workflow redesign (P5-R3).
- Phone normalization (P5-R6) and the dedup page's phone/email display (P5-R7).
- Any new event fields or changes to how events are created or scheduled.
