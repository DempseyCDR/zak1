# Feature Specification: Event Short Label, Start Time, and Public Description

**Feature Branch**: `013-event-label-start-time`

**Created**: 2026-07-08

**Status**: Draft

**Input**: User description: "specs/PHASE2_REQUIREMENTS.md — item P2-4 (add a short label, a start time, and a long-text description to events; surface label + start time in listings and the public site, description on the public event detail)"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Tell same-day group events apart with a short label (Priority: P1)

An event group can hold more than one event on the same date — e.g. a "Pride Dance 2026" double dance
with an afternoon and an evening session. Today those two events look identical in any listing (same
series, same date, same group). The administrator wants a **short label** ("Afternoon"/"Evening", or
"English"/"Contra") that tells the two apart wherever events are listed.

**Why this priority**: Without it, same-day group events are indistinguishable in the admin, at the door,
and on the public site — the core motivation. Independently valuable and testable.

**Independent Test**: Create two events in one group on one date with labels "Afternoon" and "Evening";
confirm both are shown with their labels and can be told apart in every listing they appear in.

**Acceptance Scenarios**:

1. **Given** two events in the same group on the same date with labels "Afternoon" and "Evening",
   **When** they are listed together (admin, check-in, or public schedule), **Then** each shows its label
   and the two are distinguishable.
2. **Given** an event with no label, **When** it is listed, **Then** it shows no label and displays as it
   does today.

---

### User Story 2 - Show a start time so dancers know when to come (Priority: P1)

A dancer browsing the public schedule needs to know when a dance begins. The administrator sets a
**start time** for an event; the public schedule and event detail show it. The time is the local
wall-clock time at the venue (the club runs on local time), shown exactly as set — not shifted for the
viewer's device.

**Why this priority**: The schedule's practical purpose is telling people when to show up; a P1 payoff
of the public site.

**Independent Test**: Set an event's start time to 7:30 PM; view the public schedule/detail from any
device and confirm it shows 7:30 PM (not a time-zone-shifted value).

**Acceptance Scenarios**:

1. **Given** an event with a start time of 7:30 PM, **When** a dancer views it on the public schedule or
   event detail, **Then** it shows 7:30 PM regardless of the viewer's device time zone.
2. **Given** an event with no start time, **When** it is listed, **Then** no start time is shown (not a
   default like midnight).

---

### User Story 3 - Describe a dance on the public event detail (Priority: P2)

The club wants to add a free-form blurb about a dance — what to expect, the caller/band, a theme — shown
on the public event detail page. The administrator enters a **long-text description**; it renders on the
public detail when present.

**Why this priority**: A useful enrichment of the public listing, but secondary to identifying and timing
events.

**Independent Test**: Add a description to an event; open its public detail page and confirm the
description renders; confirm an event without one shows no description block.

**Acceptance Scenarios**:

1. **Given** an event with a description, **When** its public detail page is viewed, **Then** the
   description text is shown.
2. **Given** an event with no description, **When** its public detail page is viewed, **Then** no
   description block appears.

---

### Edge Cases

- **Two same-day group events, only one labeled**: still distinguishable — the labeled one shows its
  label; the unlabeled one shows none.
- **Event with no start time**: listings omit the time entirely (never a placeholder like "12:00 AM").
- **Start time near midnight / any hour**: shown as the local wall-clock time the admin entered; there is
  no cross-time-zone adjustment.
- **Long description with line breaks**: renders on the public detail as entered (plain text).
- **Label on a single (non-group) event**: allowed and simply shown; the label is not restricted to
  grouped events.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: An event MUST support an optional **short free-text label**.
- **FR-002**: The label MUST be shown wherever events are listed together — the public schedule and event
  detail, the check-in and events admin, and anywhere same-day group members appear — so that two events
  in the same group on the same date are distinguishable.
- **FR-003**: An event MUST support an optional **start time**, entered and interpreted as a **venue-local
  wall-clock time** with no time-zone data or conversion.
- **FR-004**: The public schedule and event detail MUST display the start time as that local wall-clock
  time (e.g., "7:30 PM"), never adjusted for the viewer's device or time zone.
- **FR-005**: An event MUST support an optional **long-text description**.
- **FR-006**: The public event detail MUST render the description when present, and show no description
  block when absent.
- **FR-007**: The administrator MUST be able to set the label, start time, and description when creating
  or editing an event.
- **FR-008**: All three fields are **optional**; an event with none set MUST display exactly as it does
  today (no label, no time shown, no description) — no regression.

### Key Entities *(include if feature involves data)*

- **Event** (existing): gains an optional **label** (short text), an optional **start time** (a
  venue-local wall-clock time), and an optional **description** (long text). Its series, date, group,
  venue, and admission behavior are unchanged.
- **Public schedule / event detail** (existing): now show each event's label and start time; the detail
  page additionally shows the description.
- **Event group** (existing): the label distinguishes its same-day member events; it complements the
  group's free-text category (kind) — the category describes the group, the label identifies an instance
  within it.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Two events in the same group on the same date are distinguishable by their labels in 100%
  of the listings they appear in.
- **SC-002**: A dancer viewing the public schedule/detail sees each event's start time exactly as the
  administrator entered it, regardless of the viewer's device time zone.
- **SC-003**: The public event detail shows a description whenever one is set, and omits the block when
  not.
- **SC-004**: An event created without a label, start time, or description displays exactly as before
  (zero change to existing listings).

## Assumptions

- **Start time is a venue-local wall-clock time with no time-zone handling** (settled in P2-4): the club
  treats all times as local, so there is no cross-zone conversion and venues need no time-zone field.
  **End time is out of scope** (YAGNI — a duration can be added later if needed).
- **Label is optional free text** (no fixed set of values).
- **Description is optional long text**, rendered as plain text; rich formatting/markdown is out of scope.
- **These fields are display/identification only** — they do not affect scheduling logic, admission, gate
  money, attendance, or reports.
- Single-club scale; administrator-entered data.

## Dependencies

- **Feature 002** (events model + admin) — the event gains the new fields and the create/edit surface
  exposes them.
- **Feature 007** (public website: schedule + event detail, and the public read model) — the label and
  start time appear on the schedule/detail, and the description on the detail.
- Complements **feature 010 / P2-1** (event-group free-text category): the label distinguishes instances
  within a group while the group's category describes the group — different, complementary fields.
