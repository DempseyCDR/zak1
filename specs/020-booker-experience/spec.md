# Feature Specification: Booker Experience (P4-1)

**Feature Branch**: `020-booker-experience`

**Created**: 2026-07-25

**Status**: Draft

**Input**: User description (condensed): A UX-focused feature for **Sean, the Booker** — a richer bookings
report, a booking-management modal, an event-management modal, a new **tentative** booking status, a
per-venue **short name**, and a **performer typeahead** with an add-performer hand-off. It layers over the
existing feature-018 booking substrate; the only new persistence is `venues.short_name` and the `tentative`
status value.

## User Scenarios & Testing *(mandatory)*

The single actor is **Sean, the Booker** (holds `booking.write`, `event.write`, `venue.write`,
`performer.write`, and `contact.pii.read`). Everyone else — any authenticated volunteer without those
grants — may **read** the bookings report and open its modals **read-only** (money is open to all
volunteers; only contact PII is gated). Stories are ordered so the at-a-glance **report** (US1) lands first
as the MVP; booking management (US2) and event management (US4) are the write surfaces it launches; the
**tentative** status (US3) and **venue short name** (US5) are smaller enhancements layered on.

### User Story 1 - Read the bookings report at a glance (Priority: P1)

Sean opens the bookings report to see, across many events, who is booked where and in what state — so he can
assure appropriate bookings and a fair spread of talent across a series. Each event is one row: its date, its
**venue short name**, and its performers grouped by role, each performer tagged with a one-letter status
marker. He can **sort by date** (ascending or descending) and **filter by performer**.

**Why this priority**: It is the Booker's primary situational-awareness surface and delivers value on its own
— even before any editing, seeing the whole booking picture is the core need. Independently testable as a
read-only view.

**Independent Test**: Load the report for a date range; confirm events are one row each with venue short name,
stacked musicians, and per-performer status letters; flip the sort direction; filter by a performer and see
only their events.

**Acceptance Scenarios**:

1. **Given** several events with bookings, **When** Sean opens the report, **Then** each event is a row
   showing its date, venue **short name**, caller, musicians (stacked), and sound tech, each performer with
   an adjacent status letter (P/R/T/C/D).
2. **Given** the report, **When** Sean toggles the sort, **Then** events reorder by event date ascending or
   descending.
3. **Given** the report, **When** Sean filters by a performer, **Then** only events featuring that performer
   remain (existing caller/musician/band/series/date-range filters unchanged).
4. **Given** an event missing a role (e.g. no sound tech yet), **When** the row renders, **Then** an
   **empty role slot** appears for each unfilled role, and a sound-tech slot is **not** shown for a
   `community_dance` event.
5. **Given** a non-Booker viewing the report, **When** the page loads, **Then** it renders read-only — the
   data is visible but no create/edit affordance offers to change it.

---

### User Story 2 - Manage a booking in a modal (Priority: P1)

Sean fills and adjusts an event's bookings without leaving the report. Clicking a **performer space** — a
filled booking or an empty role slot — opens a modal. For an empty slot it opens in **create** mode with the
role pre-filled; for a filled slot it opens in **edit** mode showing the booking's details. He sets or
overrides **pay, notes, status, and substitute**, and can email the performer via a **mailto** link. He
chooses a performer with a **search box** (typeahead), not a long dropdown; if the person isn't a performer
yet, an **add-performer** step links an existing contact and returns him to the booking to finish it.

**Why this priority**: The report is only situational awareness until Sean can act on it; booking creation and
adjustment is the Booker's core job. Depends on US1's report as the launch point.

**Independent Test**: From the report, click an empty musician slot → create a booking by searching a
performer, set pay and status, Save → it appears on the row; click a filled booking → change pay/notes/status
→ Save → the change persists; open the modal as a non-Booker → only a Close button, no Save/Cancel.

**Acceptance Scenarios**:

1. **Given** Sean opens the booking page **directly**, **When** it loads, **Then** he first sees only an
   event selector; after selecting an event he sees its bookings. **Given** he arrives **from the report**,
   the event is passed in and the selector step is skipped.
2. **Given** an empty role slot, **When** Sean clicks it, **Then** the modal opens in **create** mode with
   the role (caller / sound tech / musician) pre-filled.
3. **Given** the performer picker, **When** Sean types part of a name, **Then** a **typeahead** lists matching
   performers by display name and selecting one fills the booking's payee — regardless of band membership.
4. **Given** a performer's pay is unset, **When** the booking is created, **Then** pay defaults to the current
   **rate** parameter for that role and series on the event date; **When** Sean edits the booking, **Then** he
   may override pay to any value.
5. **Given** a booking with a performer whose contact has a usable email, **When** the modal renders, **Then**
   a **mailto** link is offered whose recipient is the performer's email (see FR) and whose subject is
   pre-filled `Rochester Dance <event date>`; **When** no usable email exists, **Then** no mailto link is
   shown.
6. **Given** the search finds no performer, **When** Sean chooses **add performer**, **Then** he searches an
   **existing contact**, a performer is created bound to that contact (display name defaulting from the
   contact, role pre-filled from the slot), and control returns to the booking modal with the new performer
   selected; the **booking is not saved** until Sean saves it.
7. **Given** Sean has edited fields, **When** he clicks **Save**, **Then** all changes commit together;
   **When** he clicks **Cancel**, **Then** nothing is saved; there is **no** save-on-close.
8. **Given** a non-Booker opens the modal, **When** it renders, **Then** it is read-only with a **Close**
   button only — no Save, no Cancel.

---

### User Story 3 - A performer answers "maybe" (tentative) (Priority: P2)

A performer replies to a request with "maybe." Sean records that as **tentative** — a state between requested
and confirmed — so the report distinguishes a soft yes from a firm one. He can also skip it: a requested
booking may go straight to confirmed.

**Why this priority**: A real gap in the current lifecycle (there is no "maybe"), but a small addition layered
onto US1's letters and US2's status control.

**Independent Test**: Take a booking requested → tentative → confirmed; take another requested → confirmed
directly; confirm the report shows T then C; confirm a tentative booking never appears on the public site.

**Acceptance Scenarios**:

1. **Given** a **requested** booking, **When** Sean sets it tentative, **Then** its status becomes tentative
   and the report shows **T**.
2. **Given** a **tentative** booking, **When** Sean confirms or declines it, **Then** it moves to that state;
   **and** a **requested** booking may be confirmed **directly**, skipping tentative.
3. **Given** an invalid transition (e.g. proposed → tentative, or confirmed → tentative), **When** attempted,
   **Then** it is refused.
4. **Given** a **tentative** booking, **When** the public schedule renders, **Then** it is **not** shown
   (only confirmed bookings are public — unchanged).
5. **Given** a tentative or confirmed booking, **When** Sean substitutes the performer, **Then** the booking
   re-points and **resets to proposed** with any check number cleared (existing behavior).

---

### User Story 4 - Manage event attributes in a modal (Priority: P2)

Sean clicks an event's **date or label** in the report to open an event modal showing its date, start time,
venue, rent, label, and description, and edits them in place. When he **creates** a new event, the venue and
start time default from the series' previous event so he rarely retypes them; the **rent** field always shows
the resolved default so he never faces a blank he must remember.

**Why this priority**: Event upkeep is part of the Booker's job and shares the report as its entry point, but
it is secondary to seeing and filling bookings.

**Independent Test**: Click an event date → the modal shows current date/start/venue/rent/label/description;
create a new event in a series → venue and start time pre-fill from the prior event; change the venue → the
shown rent re-defaults; leave rent at the shown default → no per-event override is stored; type a rent → an
override is stored.

**Acceptance Scenarios**:

1. **Given** the report, **When** Sean clicks an event's date or label, **Then** a modal opens showing the
   event's date, start time, venue, rent, label, and description.
2. **Given** Sean creates a new single event in a series, **When** the modal opens, **Then** its venue and
   start time default from the **latest event in that series with a date before the new event's date**, both
   overridable.
3. **Given** the rent field, **When** the modal renders, **Then** it **shows the resolved default rent** (the
   per-event override, else series-at-venue, else venue default, else zero); **When** Sean leaves it at that
   default, **Then** no per-event override is stored (the event keeps tracking the venue/series default);
   **When** Sean types a value, **Then** it is stored as the per-event override.
4. **Given** the event modal, **When** Sean changes the venue, **Then** the shown rent **re-defaults** to the
   new venue's resolved rent.
5. **Given** a non-Booker, **When** the event modal opens, **Then** it is read-only with a **Close** button
   only.

---

### User Story 5 - Manage a venue short name (Priority: P3)

Venues appear in the report by a **short name** (e.g. "GH" for German House) that Sean can set. A new venue's
short name defaults to the initials of its full name; existing venues receive that default too; Sean may edit
it.

**Why this priority**: A readability nicety for the report; smallest and most isolated of the stories.

**Independent Test**: A venue with no short name shows the initials of its name in the report; edit the short
name → the report reflects it.

**Acceptance Scenarios**:

1. **Given** a venue named "German House" with no short name set, **When** its short name is needed, **Then**
   it defaults to "GH".
2. **Given** a venue, **When** Sean edits its short name, **Then** the report shows the edited value.
3. **Given** two venues whose names yield the same initials, **When** both appear, **Then** both short names
   are allowed (no uniqueness enforced — the short name is display-only).

### Edge Cases

- **Empty musician slots** — the row shows the currently booked musicians plus an **"add musician"** slot;
  there is always a way to add one more.
- **Sound tech on a `community_dance` event** — no sound-tech slot is shown (that series has no sound tech).
- **mailto with multiple emails** — pick the first **active** email whose purposes include, in order of
  preference, `booking`, then `personal`, then `public_profile`; the `other` purpose is excluded; if none
  qualifies, no mailto link appears.
- **Add-performer for a non-contact** — if the person is not a contact yet, they must be created in the
  contact directory first; the add-performer step links an **existing** contact.
- **Substitute across states** — substituting always re-points to a new performer and resets the booking to
  proposed (clearing any check number), whatever state it was in.
- **Prior-event default with no prior event** — the first event in a series has no prior event; venue and
  start time then start empty and Sean sets them.
- **Recurrence generation** — bulk recurrence (B26) is unaffected: it requires explicit venue and start time
  and does **not** copy from a prior event.
- **Cancelled events in the report** — remain listed and flagged (unchanged from feature 018).

## Requirements *(mandatory)*

### Functional Requirements

#### Bookings report (US1)

- **FR-001**: The report MUST let the user sort events by **event date ascending or descending** (today it is
  ascending only).
- **FR-002**: The report MUST show each event's **venue** by its short name (see FR-024); the report does not
  surface venue today.
- **FR-003**: Each event row MUST group performers by role — caller, musicians (**stacked**), sound tech —
  and show, adjacent to each performer, a **status letter**: P proposed, R requested, T tentative, C
  confirmed, D declined. The letter carries the meaning; color reinforces it (never color alone).
- **FR-004**: The report MUST show **empty role slots** for unfilled roles — a caller slot, a sound-tech slot
  (**omitted for `community_dance`**), and the booked musicians plus an **"add musician"** slot — each
  clickable to create a booking.
- **FR-005**: Clicking a **performer space** (filled or empty) MUST open the **booking modal**; clicking an
  event's **date or label** MUST open the **event modal**.
- **FR-006**: The existing performer/caller/musician/band/series/date-range filters MUST continue to work.

#### Booking modal (US2)

- **FR-007**: Opening the booking page **directly** MUST first present an **event selector**; after selecting,
  the event's bookings show. Arriving **from the report** MUST pass the event and **skip** the selector.
- **FR-008**: The booking modal MUST have three shells: **create** (empty slot, role pre-filled), **edit**
  (existing booking), and **read-only** (a viewer lacking `booking.write` — **Close** only).
- **FR-009**: In edit/create, Sean MUST be able to set/override **pay, notes, status, and substitute**, and a
  single **Save** commits all fields at once; **Cancel** discards; there MUST be **no save-on-close**.
- **FR-010**: A booking's **pay** MUST default to the current **rate** parameter for that role and series on
  the event date, and MUST be overridable whenever Sean manages the booking (unchanged from feature 018).
- **FR-011**: The modal MUST offer a **mailto** link to the performer when a usable email exists: the first
  **active** email whose purposes include, in preference order, `booking`, then `personal`, then
  `public_profile` (excluding `other`); the subject MUST pre-fill `Rochester Dance <event date>`. With no
  usable email, **no** link is shown.
- **FR-012**: The performer picker MUST be a **typeahead search** over performers by display name (ordered by
  display name), returning a performer — replacing the dropdown. Booking any performer MUST work **regardless
  of band membership**.
- **FR-013**: When the search finds no performer, an **add-performer** step MUST let Sean search an
  **existing contact** and create a performer **bound to that contact** (display name defaulting from the
  contact, role pre-filled from the slot), then return to the booking modal with the new performer selected.
  The **booking is not committed** until Sean saves it.

#### Tentative status (US3)

- **FR-014**: The booking lifecycle MUST include **tentative**, with transitions: `proposed → requested`;
  `requested → tentative | confirmed | declined`; `tentative → confirmed | declined`. Tentative is
  **skippable** (`requested → confirmed` directly). Any other transition MUST be refused.
- **FR-015**: **Tentative** bookings MUST remain **internal** — the public schedule shows only **confirmed**
  bookings (unchanged).
- **FR-016**: Substituting a performer MUST re-point the booking and **reset it to proposed**, clearing any
  check number, from any prior state (unchanged from feature 018).

#### Event modal (US4)

- **FR-017**: The event modal MUST show and edit an event's **date, start time, venue, rent, label, and
  description** (all existing fields).
- **FR-018**: Creating a **single** new event MUST default its **venue** and **start time** from the **latest
  event in the same series with a date before the new event's date**, both overridable. Recurrence
  generation is exempt (requires explicit venue and start time).
- **FR-019**: The rent field MUST **display the resolved default** (per-event override → series-at-venue →
  venue default → 0). Leaving it at the shown default MUST store **no** per-event override; typing a value
  MUST store a per-event override. Changing the venue MUST **re-default** the shown rent.
- **FR-020**: The event modal MUST be **read-only** (Close only) for a viewer lacking `event.write`.

#### Venue short name (US5)

- **FR-024**: A venue MUST carry a **short name** managed as venue data. Its default MUST be the **initials of
  the full name** (e.g. "German House" → "GH"); existing venues MUST receive that default; Sean MUST be able
  to edit it. Short names need **not** be unique (display-only).

#### Cross-cutting

- **FR-021**: All write actions in this feature MUST respect the existing money/authority boundary: only
  holders of the relevant capability (`booking.write`, `event.write`, `venue.write`, `performer.write`) may
  change data; everyone else sees the report and modals **read-only**.
- **FR-022**: This feature MUST NOT change what the **public** site shows (still confirmed bookings only) or
  the treasurer/organizer reports.
- **FR-023**: Money remains **integer cents**; the rent resolution chain and rate defaults are reused, not
  redefined.

### Key Entities *(include if feature involves data)*

- **Venue** (existing) — gains a **short name** (defaulted from initials, editable, non-unique, display-only).
- **Booking** (existing) — its **status** gains a **tentative** value; shape otherwise unchanged. Pay,
  notes, status, and performer (substitute) are the fields Sean edits.
- **Performer** (existing) — searched by display name in the picker; the add-performer step creates one
  **bound to an existing contact**.
- **Event** (existing) — date, start time, venue, rent (per-event override over the resolved chain), label,
  description — all edited in the modal; venue and start time default from the prior event on create.
- **Contact** (existing) — the source of a new performer's identity and of the mailto recipient; PII is
  gated to `contact.pii.read` holders (the Booker qualifies).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: From the report, Sean can identify every event's venue and each performer's booking state
  **at a glance** — one row per event, venue short name shown, and a status letter beside every performer.
- **SC-002**: Sean can **create or adjust** a booking (pay, notes, status, substitute) from the report in a
  single modal, committing all changes with one Save, without navigating to a separate page.
- **SC-003**: Selecting a performer takes **no scrolling of a long list** — a typed query narrows to matching
  performers, and an unknown person can be added (linked to a contact) and booked without leaving the flow.
- **SC-004**: A performer's "maybe" is recordable as **tentative** and visibly distinct from confirmed on the
  report; a tentative booking never appears on the public site.
- **SC-005**: Creating a new event pre-fills venue and start time from the series' prior event, and the rent
  field always shows a real number (never a blank), so Sean rarely retypes recurring values.
- **SC-006**: A non-Booker can **read** the report and open its modals but is offered **no** way to change
  anything (Close only).
- **SC-007**: Nothing in the public schedule, treasurer report, or organizer report changes as a result of
  this feature.

## Assumptions

- **Layers over feature 018.** The bookings report, booking CRUD, event PATCH, rate defaults, and rent
  resolution chain already exist; this feature is predominantly UX plus two small data additions
  (`venues.short_name`, the `tentative` status value).
- **Read-only for non-Bookers, not hidden.** Money and booking data are open to every volunteer to read
  (feature 016); only *writing* is gated. So the report and modals render for anyone, with edit affordances
  suppressed for non-holders.
- **Performer typeahead over the performer set (~30), not contacts (~1340).** Bookings reference performers;
  searching contacts would surface mostly non-performers and require a resolution step. This is the first
  instance of backlog **B39** (entity pickers); the same pattern can later serve other id fields.
- **Add-performer links an existing contact.** It does not mint a fresh contact; if the person is not a
  contact yet, they are created in the contact directory first. This aligns performers with the intended
  "performers are contacts" rule without enforcing it here.
- **"Prior event" = latest in the series with date < the new event's date.** Chosen deliberately; isolated so
  the rule can be revised without touching the rest.
- **Rent is dynamic (Option A).** Leaving rent at the shown default stores no override, so the event keeps
  tracking the venue/series default; only a typed value freezes a per-event override.
- **mailto opens the user's own mail app** via a standard link; the platform composes the recipient and
  subject only and sends nothing itself.
- **Status is letter + color.** The letter conveys the state (accessible); color merely reinforces it.

## Dependencies

- **Feature 018 (booking & event management)** — the bookings report (B24), booking status lifecycle (B23),
  event PATCH incl. `event_date` and cancel/delete, and recurrence (B26).
- **Feature 011 (venue-scoped rent)** — the rent resolution chain the event modal displays.
- **Feature 009 (series parameters)** — the **rate** parameters that default performer pay.
- **Feature 016 (authorization)** — the `booking.write` / `event.write` / `venue.write` / `performer.write` /
  `contact.pii.read` capabilities that gate the write surfaces.
- **Feature 001 (contacts) & 003 (performers)** — the contact and performer directories the add-performer
  hand-off and mailto draw on.

## Out of Scope

- The **Door Attendant** experience (the next milestone).
- Enforcing **"every performer must have a contact"** as a NOT-NULL data rule (a handful of performers have
  no contact today) — a separate small data-integrity item; not required by the typeahead.
- Any change to the **public** schedule, the **treasurer** report, or the **organizer** report.
- A general, polished, reusable entity-picker component library — this feature ships the **first** typeahead
  (performers, and the contact search inside add-performer); generalizing the pattern remains **B39**.
- Group tickets / online ticket sales (B1 / 007 US2) — unrelated.
