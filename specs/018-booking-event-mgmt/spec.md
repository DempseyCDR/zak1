# Feature Specification: Booking & Event Management (Booker)

**Feature Branch**: `018-booking-event-mgmt`

**Created**: 2026-07-17

**Status**: Draft

**Input**: User description: "Feature 018 — Booking & event management (Phase 3 package P3-4, the Booker's
toolkit). Bundles B23 (per-booking status lifecycle), B24 (cross-event bookings report), B25 (event
cancel/delete/reschedule), B26 (recurring event generation), B22 (venue landlord contact), B27 (advertised
admission price, Webmaster-owned)."

## Clarifications

### Session 2026-07-17

- Q: B25 — should hard delete be guarded when an event already has history? → A: **Block delete when the
  event has a door record, attendance rows, or bookings with recorded payments** (check #/pay); those are
  removable only by **cancel**. Delete stays allowed for a genuinely empty (mistake) event.
- Q: B26 — what increment should recurring generation support? → A: **Weekly step (every N weeks**, default
  1 = weekly, N=2 = biweekly) from the first date through the last date, for the chosen series + start time;
  **hard-capped per run** (≤ 60 events) to prevent runaways.
- Q: B27 — who may set the advertised admission price? → A: **Both the Webmaster and the Booker.** It is an
  event **public field**: both already hold `event.public.write` in the feature-016 catalog (Webmaster
  global, Booker scoped to their series), so no new capability is introduced.
- Q: B24/B23 — public exposure of bookings? → A (Rich, 2026-07-17): **performer pay is never public**;
  **any staff (authenticated volunteer) may see the cross-event bookings report** (`base` read, per the
  feature-016 model); and **the public pages show only `confirmed` bookings** — proposed/requested/declined
  bookings are hidden from `/whats-on`. Because existing bookings predate the lifecycle and were treated as
  final, migration `0023` **backfills existing bookings to `confirmed`** (new bookings still default to
  `proposed`), so no current event loses its public performer display.

## User Scenarios & Testing *(mandatory)*

The primary actor is the **Booker** — the volunteer who programmes a series: proposing and confirming
performers, and owning the event calendar (create, reschedule, cancel, delete, generate recurring dates).
The Booker's authority is **per series** (feature 016). A second actor, the **Webmaster**, owns one
public-facing field — the **advertised admission price** — club-wide. The **public** (unauthenticated) is a
read-only actor who sees the schedule, including that a dance has been **cancelled** and its advertised
price.

Stories are ordered so the booking-status foundation (US1) lands before the report that surfaces it (US2);
the remaining stories are independent.

### User Story 1 - Per-booking status lifecycle (Priority: P1)

When the Booker lines up talent, each booking moves through a status: it starts **proposed**, becomes
**requested** when the Booker has asked the performer, and **confirmed** once the performer has agreed to
both the date and the pay rate. If the performer declines, the Booker either **re-points the slot** to a
different performer (back to proposed) or **parks the slot** as **declined** to deal with later. Status is
tracked **per booking**.

**Why this priority**: Status is the spine of the Booker's workflow and a prerequisite for the cross-event
report (US2). Today a booking has no status at all — it is implicitly "booked" the moment it is created.

**Independent Test**: Create a booking (defaults to proposed), advance it to requested then confirmed, and
separately mark one declined; confirm each booking's status persists and drives what the Booker sees.

**Acceptance Scenarios**:

1. **Given** a newly created booking, **When** the Booker views it, **Then** its status is **proposed**.
2. **Given** a proposed booking, **When** the Booker requests the performer, **Then** it becomes
   **requested**; **When** the performer agrees to date and rate, **Then** it becomes **confirmed**.
3. **Given** a requested booking the performer declines, **When** the Booker parks it, **Then** it becomes
   **declined**; **When** instead the Booker re-points the slot to another performer, **Then** it returns to
   **proposed** for the new performer.
4. **Given** a booking created by booking a band as a unit, **When** it is created, **Then** it carries a
   status like any other booking.

---

### User Story 2 - Cross-event bookings report (Priority: P2)

The Booker wants to see bookings **across many events at once** — past and future — to assure appropriate
bookings and a fair distribution of talent across a series (e.g. "show me every dance using Bob Fabinski").
The report lists, per event, the **date, caller, band (if named), musicians, and sound tech**, and can be
**filtered** by caller, band, individual musician, series, and date range.

**Why this priority**: This is the Booker's planning view and the main payoff of tracking status (US1). No
read-across-events booking view exists today — only per-event treasurer/organizer reports.

**Independent Test**: With bookings across several events, run the report filtered by a specific musician and
by a series/date range, and confirm only the matching events/bookings appear with their status.

**Acceptance Scenarios**:

1. **Given** bookings across multiple events, **When** the Booker filters by an individual musician, **Then**
   only events featuring that musician are listed.
2. **Given** the same data, **When** the Booker filters by series and a date range, **Then** only that
   series' events within the range appear.
3. **Given** a listed event, **When** the Booker reads its row, **Then** it shows date, caller, band (if
   named), musicians, sound tech, and each booking's status (US1).

---

### User Story 3 - Event cancel, delete, and reschedule (Priority: P3)

The Booker owns the event calendar. They can **reschedule** an event (change its date), **cancel** an event
(a retained state that stays in the record **and shows on the public site** so dancers know not to come),
and **delete** an event (hard removal, for a mistake).

**Why this priority**: High-value and almost entirely net-new — today the event edit cannot change the date,
there is no delete path, and there is no cancelled state. Cancellation is also the only story with an
immediate public-facing effect.

**Independent Test**: Reschedule an event to a new date; cancel another and confirm it still exists and is
marked cancelled on the public schedule; delete a third and confirm it is gone.

**Acceptance Scenarios**:

1. **Given** an event, **When** the Booker changes its date, **Then** the event moves to the new date
   (reschedule), retaining its other details.
2. **Given** an event, **When** the Booker cancels it, **Then** it is **retained** with a cancelled status
   and appears **marked cancelled** on `/whats-on`.
3. **Given** an event with **no** history, **When** the Booker deletes it, **Then** it is removed.
4. **Given** an event that has a **door record, attendance rows, or bookings with recorded payments**,
   **When** the Booker tries to hard-delete it, **Then** the delete is **refused** and the Booker is directed
   to **cancel** instead (see Clarifications 2026-07-17).

---

### User Story 4 - Recurring event generation (Priority: P4)

Rather than create weekly dances one at a time, the Booker defines a **recurrence** — a first date, an
increment, and a last date — and the system **generates many independent event rows**. Each generated event
is thereafter **independently** editable and cancellable, with no effect on its siblings (they are ordinary
rows, not a live recurrence rule).

**Why this priority**: A real time-saver (a season of Thursday-night contras or Sunday English dances is
dozens of events), but independent of the other stories and safe to add last among the larger items.

**Independent Test**: Generate a run of events from a first date, increment, and last date; confirm the
expected number of independent events exist, then edit/cancel one and confirm the others are untouched.

**Acceptance Scenarios**:

1. **Given** a first date, an increment, and a last date, **When** the Booker generates the run, **Then**
   independent events are created for each occurrence in range for the chosen series.
2. **Given** a generated run, **When** the Booker reschedules or cancels one event, **Then** the others are
   unchanged.
3. **Given** the seasonal start-time difference (e.g. winter afternoons vs. summer evenings), **When** the
   Booker runs the generator twice with different start times over different date ranges, **Then** each run's
   events carry that run's start time.
4. **Given** an every-N-weeks step (default 1), **When** the run would exceed the per-run cap (≤ 60 events),
   **Then** the generation is refused rather than producing a runaway set (see Clarifications 2026-07-17).

---

### User Story 5 - Venue landlord contact (Priority: P5)

A venue can name the **contact who is its landlord** — the party the Booker negotiates rent with — chosen
from the existing contact directory (not free text). The landlord's name and contact info can then be
surfaced on the venue's admin page.

**Why this priority**: Small, self-contained, and supportive of the Booker's rent-negotiation context; no
dependency on the other stories.

**Independent Test**: Set a venue's landlord to an existing contact and confirm it is stored and shown on the
venue page; clear it and confirm the venue has no landlord.

**Acceptance Scenarios**:

1. **Given** a venue and an existing contact, **When** the Booker designates that contact as the venue's
   landlord, **Then** the venue records the landlord and shows their name/contact on the venue page.
2. **Given** a venue with a landlord, **When** the Booker clears it, **Then** the venue has no landlord
   (the link is optional).

---

### User Story 6 - Advertised admission price (Webmaster, public) (Priority: P6)

The **Webmaster** maintains the **admission price shown on the website** for an event. The public sees this
price on the schedule. It is **display-only** — it does not feed accounting; gate/admission revenue is still
derived from the door record.

**Why this priority**: Small and public-facing, and the only story that also involves the Webmaster (the
price is an event public field both the Webmaster and the Booker may set); cleanly separable.

**Independent Test**: Set an event's advertised price as the Webmaster and confirm it displays on
`/whats-on`; confirm it does not change any accounting figure.

**Acceptance Scenarios**:

1. **Given** an event, **When** the Webmaster sets its advertised admission price, **Then** the price shows
   on `/whats-on` for that event.
2. **Given** an advertised price is set, **When** the event's revenue is computed, **Then** the price has no
   effect on any accounting figure (it is display-only).
3. **Given** a Booker (for their series) or the Webmaster, **When** either sets the advertised price, **Then**
   it is accepted — both hold `event.public.write` (see Clarifications 2026-07-17).

### Edge Cases

- **Reschedule collides** with an existing event (same series, same new date) — is that allowed (two events
  a day happens) or flagged? Assumed allowed; the club already runs same-day group events.
- **Cancel then reschedule** — a cancelled event that is later revived/rescheduled; cancellation is a
  retained state, so it must be reversible or clearly terminal (assumed reversible by editing status).
- **Delete an event inside a generated run** — deleting one generated event must not affect siblings (they
  are independent rows).
- **Recurrence generates zero events** (last date before first, or increment overshoots) — surface nothing
  created rather than an error.
- **Booking status on a band booking** — booking a band creates multiple bookings; each carries its own
  status, and re-pointing one performer must not disturb the others.
- **Landlord contact is deleted/merged** — the venue's landlord link must degrade gracefully (behaves like
  other optional contact references).
- **Public visibility** — a cancelled event stays visible (marked cancelled); a deleted event disappears; an
  advertised price shows only when set.

## Requirements *(mandatory)*

### Functional Requirements

#### Booking status lifecycle (B23)

- **FR-001**: Every booking MUST carry a **status**: one of **proposed**, **requested**, **confirmed**, or
  **declined**, defaulting to **proposed** on creation (including bookings created by booking a band as a
  unit).
- **FR-002**: The Booker MUST be able to advance a booking proposed → requested → confirmed, and mark a
  booking **declined**.
- **FR-003**: On a decline, the Booker MUST be able to either **re-point the slot** to a different performer
  (the booking returns to **proposed** for the new performer) or **park the slot** as **declined**.
- **FR-004**: Booking status MUST be **per booking** and visible wherever bookings are listed (`/bookings`
  and the cross-event report).

#### Cross-event bookings report (B24)

- **FR-005**: The system MUST provide a **read-across-events** bookings report listing, per event, the
  **date, caller, band (if named), musicians, and sound tech**, each with its booking status. **Cancelled
  events are included, flagged as cancelled** (a cancelled event still had bookings the Booker plans around).
- **FR-006**: The report MUST be **filterable** by caller, band, individual musician, series, and date range
  (past and future events both included).
- **FR-007**: The report MUST be read-only (a planning view) and MUST NOT alter any booking.

#### Event lifecycle (B25)

- **FR-008**: The Booker MUST be able to **reschedule** an event by changing its **date**, retaining the
  event's other attributes.
- **FR-009**: The Booker MUST be able to **cancel** an event: the event is **retained** with a **cancelled**
  status and MUST be shown, marked cancelled, on the public schedule (`/whats-on`).
- **FR-010**: The Booker MUST be able to **delete** an event (hard removal) **only when it has no history**;
  the system MUST **refuse** the delete when the event has a **door record, attendance rows, or bookings with
  recorded payments**, directing the Booker to **cancel** instead.
- **FR-011**: A **cancelled** event MUST remain in reports/records (it is a state, not a deletion); a
  **deleted** event MUST NOT appear anywhere.

#### Recurring event generation (B26)

- **FR-012**: The Booker MUST be able to generate multiple events from a **first date, an every-N-weeks step
  (default 1)**, and a **last date**, for a chosen series (and start time), producing one event **per
  occurrence in range**.
- **FR-013**: Generated events MUST be **independent rows** — editing, rescheduling, or cancelling one MUST
  NOT affect the others.
- **FR-014**: The generator MUST create nothing when the range yields no occurrences (e.g. last before
  first), and MUST **refuse** a run that would exceed the per-run cap of **60 events**.

#### Venue landlord (B22)

- **FR-015**: A venue MUST be able to reference an **optional landlord contact** chosen from the existing
  contact directory (not free text), and surface that contact on the venue page.
- **FR-016**: The landlord link MUST be clearable (optional) and MUST degrade gracefully if the referenced
  contact is later removed/merged.

#### Advertised admission price (B27)

- **FR-017**: An event MUST be able to carry an **advertised admission price** displayed on `/whats-on`.
- **FR-018**: The advertised price MUST be **display-only** — it MUST NOT feed any accounting figure
  (gate/admission revenue stays derived from the door record).
- **FR-019**: The advertised price MUST be settable by **both** the **Webmaster** (any series) and the
  **Booker** (their series) — it is an event public field under `event.public.write`, which both hold.

#### Cross-cutting / authorization

- **FR-020**: All booking and event-lifecycle actions (status, reschedule, cancel, delete, recurrence,
  landlord) MUST be gated to the **Booker** for the event's/venue's **series scope** (feature 016). The
  advertised price is an `event.public.write` field, held by both the **Webmaster** (global) and the
  **Booker** (scoped). Where the event edit mixes Booker-only fields (date) and public fields (price/blurb),
  the field-level split MUST be honoured.
- **FR-021**: Public (unauthenticated) users MUST see only public-safe data — the schedule with cancelled
  markers and advertised prices — **never booking status, performer pay, or contact details**.
- **FR-022**: The public schedule/detail MUST display **only `confirmed` bookings**; proposed, requested, and
  declined bookings MUST NOT appear on `/whats-on`. (The cross-event report — staff-only, FR-005 — still
  shows all statuses.) Migration MUST backfill pre-existing bookings to `confirmed` so no current event loses
  its public performer display.

### Key Entities *(include if feature involves data)*

- **Booking**: an assignment of a performer (or band member) to an event. Gains a **status**
  (proposed/requested/confirmed/declined). Existing attributes (performer, pay, check number, donated,
  overridden, note) are unchanged; the optional **note** continues to hold free-text context such as who
  declined.
- **Event**: gains a **cancelled** state (retained, public-visible) and an **advertised admission price**
  (display-only, public). Its **date** becomes editable (reschedule). Recurrence produces many independent
  Event rows.
- **Venue**: gains an optional **landlord contact** reference into the contact directory.
- **Cross-event bookings report**: a new read model spanning events (not a stored entity) — the Booker's
  talent-distribution view.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A booking created today starts **proposed**, and the Booker can drive it through
  requested → confirmed or to declined, with the status persisting and visible on `/bookings`.
- **SC-002**: The cross-event report returns exactly the matching events for any single filter or
  combination (musician, band, caller, series, date range) and shows each booking's status.
- **SC-003**: An event can be rescheduled to a new date, cancelled (and then seen marked cancelled on
  `/whats-on`), and deleted — three outcomes the system could not produce before this feature.
- **SC-004**: A recurrence over a season produces the correct count of independent events, and editing or
  cancelling one leaves the rest unchanged.
- **SC-005**: A venue can name and clear a landlord contact; an event can show a public advertised price with
  no change to any accounting figure.
- **SC-006**: The **public** never sees booking status or performer pay and sees only confirmed bookings;
  **any authenticated staff member may read** the cross-event report (status included) but only a Booker may
  change a booking's status. The advertised price is settable only by a Booker (own series) or the Webmaster
  and never affects an accounting figure.

## Assumptions

- **Declined history is a note, not a structured log** (B23). When the Booker re-points a slot to another
  performer, the previous performer's decline is preserved only by the optional `note` free-text; no
  structured per-slot decline history is kept. (Open question (c) resolved to the backlog's accepted default.)
- **Single landlord per venue** (B22). A venue references at most **one** optional landlord contact (a
  nullable link), not a list; the landlord is an ordinary contact and is not specially flagged/roled.
  (Open question (d) resolved to the simplest default; revisit if multiple landlord contacts are needed.)
- **Cancellation is reversible** by editing the event's status; it is a retained state, not a terminal one.
- **Reschedule keeps the same event identity** (same row, new date) — bookings, door records, and history
  travel with it; it is not delete-and-recreate.
- **Recurrence generates plain rows** — no stored recurrence rule, no live series link beyond the existing
  `series`/`event_group` associations; each occurrence is a normal event.
- **Advertised price is money in integer cents**, display-only, and independent of `charges_admission`
  (an event may charge admission with or without an advertised price shown).
- **Reuses existing substrate**: bookings + book-a-band (features 003/008), events + venues + `venue_id`
  (feature 007), the event edit path (features 011/013), the public `/whats-on` site (feature 007), and the
  role × capability × scope model (feature 016).

## Dependencies

- **P3-1 (feature 015)** and **P3-2 (feature 016)** — the Booker's per-series scope and the Webmaster's
  public-field authority are prerequisites.
- **Bookings / book-a-band (003/008)** — status threads through `bookingService` and the band-booking path.
- **Events / venues (007)**, **event edit (011/013)**, **public site (007)** — cancel/reschedule/price all
  extend existing event and public-schedule surfaces.

## Out of Scope

- Door-level price overrides at the point of sale (handled by the POS device); the advertised price is not an
  accounting input.
- Structured per-slot decline history (a note suffices — see Assumptions).
- A live recurrence rule / editable series template (recurrence generates independent rows only).
- Multiple landlord contacts per venue (single optional link for now).
- Booker-owned online/advance ticket sales (that is P3-5 / B1 / 007 US2, still deferred).
