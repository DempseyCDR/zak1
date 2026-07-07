# Feature Specification: Venue-Scoped Rent with Per-Event Override

**Feature Branch**: `011-venue-scoped-rent`

**Created**: 2026-07-07

**Status**: Draft

**Input**: User description: "specs/PHASE2_REQUIREMENTS.md — item P2-2 (reshape rate/expense parameters: move rent to venue-scoping with a per-event override; keep ongoing as a recurring series charge ended by zeroing; performer pay and misc unchanged)"

## Clarifications

### Session 2026-07-07

- Q: How many layers resolve an event's rent, and how is the middle layer keyed? → A: **Three effective-dated layers**, most specific wins: **per-event rent → series-at-venue rent → venue default → 0**. The middle layer is keyed by **(series, venue)** — a series' rent varies by venue, so a series spread across venues has a different override at each; there is no single series-wide rent. A venue with no rent contributes 0. Today's global per-series rents have no direct equivalent, so existing events are backfilled with a per-event rent equal to their current resolved rent to preserve Dance Net.
- Q: Can a series carry multiple ongoing charges at once? → A: **Yes** — multiple concurrent, independently-labeled ongoing charges per series; each is effective-dated and ended on its own schedule via a $0 entry; Dance Net sums all charges in effect on the event's date.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Rent varies by venue and can be overridden for one event (Priority: P1)

Rent is a property of *where* a dance is held, not of the series. Today rent is recorded per series,
which was a stand-in from before venues existed. Now that each event can name a venue, the organizer
wants to set a **standard rent per venue** and have every event held there pick it up automatically —
and, when a particular night's rent differs (a holiday surcharge, a one-off discount), **override the
rent for just that event**, exactly the way a performer's standard pay can be overridden on a single
booking.

**Why this priority**: This is the core new capability and the reason for the feature. It is
independently valuable and testable on its own.

**Independent Test**: Set a standard rent for a venue; create two events at that venue and confirm both
show that rent in the organizer report; override one event's rent and confirm only that event changes.

**Acceptance Scenarios**:

1. **Given** a venue with a default rent and no series-at-venue or per-event rent in effect, **When** an
   event at that venue on a later date is viewed in the organizer report, **Then** the event's rent
   equals the venue's default for that date.
2. **Given** an event whose venue has a default rent, **When** the organizer overrides that single
   event's rent, **Then** only that event's rent (and Dance Net) changes; other events at the same venue
   keep the resolved standard.
3. **Given** an event with **no** assigned venue, **When** the organizer enters a rent directly for it,
   **Then** that event uses the entered rent, and events with neither a venue nor a direct rent use 0.
4. **Given** a venue with two effective-dated default rents, **When** events fall before and after the
   later effective date, **Then** each event resolves the default in effect on its own date.
5. **Given** a venue default rent and a different series-at-venue rent for series S at that venue, **When**
   an event of series S at that venue is viewed, **Then** its rent equals the series-at-venue rent (which
   outranks the venue default).

---

### User Story 2 - Existing reports are unchanged by the re-scoping (Priority: P1)

The organizer relies on historical Dance Net figures being stable. Moving rent from series-scoping to
venue-scoping must not change any past event's rent or Dance Net on the day the change ships — the
figures may only change when the organizer deliberately edits a rent afterward.

**Why this priority**: A non-negotiable guardrail. A re-scoping that silently altered historical
financials would be a regression, so this must hold before the feature can ship.

**Independent Test**: Record every existing event's rent and Dance Net before the change; apply the
change; confirm each event resolves the identical rent and Dance Net.

**Acceptance Scenarios**:

1. **Given** the full set of existing events with their current rents, **When** the venue-scoping change
   is applied, **Then** every existing event resolves the same rent and the same Dance Net as before.
2. **Given** an existing event, **When** no organizer edit is made after the change, **Then** its rent
   figure is byte-identical to its pre-change value.

---

### User Story 3 - An ongoing charge recurs across a series and is ended by zeroing (Priority: P2)

Some costs recur for every dance in a series regardless of venue — e.g. supplies/insurance, or an
equipment loan being paid down. The organizer wants to record **one or more** such **ongoing charges**
for the series, each applying automatically to every event, and **end any one by entering a $0 amount**
at the date it stops (e.g. when the equipment is fully depreciated) — without deleting history, so past
events keep the amount they actually bore and the series' other charges are untouched.

**Why this priority**: This formalizes and extends existing behavior — a series can now carry several
concurrent labeled charges, each ended on its own schedule — so it ranks below the new rent capability
but is genuinely new (today only one amount per series is possible).

**Independent Test**: Set two ongoing charges for a series; confirm every later event includes their sum;
end one with a $0 entry and confirm events on/after the stop date include only the other, while earlier
events keep both.

**Acceptance Scenarios**:

1. **Given** an ongoing charge set for a series effective 2026-01-01, **When** any series event on or
   after that date is viewed, **Then** the charge is included in its Dance Net automatically.
2. **Given** that charge, **When** a $0 entry is recorded effective 2027-06-01, **Then** events on or
   after 2027-06-01 exclude it while events before it keep the prior amount (history intact; nothing
   deleted).
3. **Given** an ongoing charge, **When** it is displayed, **Then** it carries a human-readable label of
   what the charge is.
4. **Given** a series with two concurrent ongoing charges (e.g. "Supplies/insurance" and "Equipment
   loan"), **When** one is ended with a $0 entry, **Then** events after that date include only the
   remaining charge and their ongoing total drops by exactly the ended amount.

---

### Edge Cases

- **Event with no venue, and no per-event rent** → rent is 0 (series-at-venue and venue layers need a
  venue).
- **Venue with no default rent set** → its events resolve the series-at-venue rent for that venue if set,
  else 0 (unless a per-event rent is entered).
- **A series' events spread across multiple venues** → each (series, venue) pair has its own rent; a
  series-at-venue rent set for one venue does not affect that series' events at other venues (each falls
  to its own venue's rate, then 0).
- **Removing a per-event rent override** → the event falls back to its series-at-venue rent, then its
  venue default, then 0.
- **Ongoing $0 entry dated before any event** → those events carry 0 ongoing.
- **Superseding a venue's standard rent** → only events on/after the new effective date change; already
  reported past events are untouched.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The organizer MUST be able to set a **venue** standard (default) rent as an effective-dated
  amount (a new standard supersedes the prior one from its effective date).
- **FR-002**: The organizer MUST be able to set a **series-at-venue** rent — an effective-dated amount
  keyed by (series, venue) — that takes precedence over the venue default for that series' events at that
  venue. A series that uses multiple venues can have a different rent at each; there is no single
  series-wide rent.
- **FR-003**: The organizer MUST be able to set a **per-event** rent that takes precedence over both the
  series-at-venue and venue values; it MUST apply to that event only and MUST NOT affect any other event.
- **FR-004**: An event with no assigned venue MUST support a directly-entered per-event rent; when no
  rent is set at any applicable level (per-event, series-at-venue, or venue), the resolved rent MUST be 0.
- **FR-005**: An event's rent MUST resolve by precedence, most specific first: the **per-event** rent if
  set; else the **series-at-venue** rent (for the event's series + venue) in effect on the event's date;
  else the **venue** default rent in effect on that date; else **0**. An event with no venue can resolve
  only a per-event rent, else 0.
- **FR-006**: The organizer report and Dance Net MUST use each event's resolved rent (per the FR-005
  precedence).
- **FR-007**: Introducing the new rent layers MUST NOT change any existing event's resolved rent or
  Dance Net. Because today's rent is a single per-series value with no direct equivalent in the (series,
  venue) model, existing events are preserved by backfilling each with a per-event rent equal to its
  current resolved rent; figures may change only through a subsequent deliberate organizer edit.
- **FR-008**: The organizer MUST be able to set **one or more** ongoing charges for a series, each a
  labeled, effective-dated amount that applies automatically to every event in that series on or after
  its effective date; an event's ongoing total is the **sum** of its series' charges in effect on that
  date.
- **FR-009**: Each ongoing charge MUST be endable independently by recording a later effective-dated $0
  amount for that charge; events before the stop date MUST retain the prior amount, the series' other
  ongoing charges MUST be unaffected, and no history may be deleted.
- **FR-010**: Each ongoing charge MUST carry a human-readable label describing what it is.
- **FR-011**: Performer pay (standard per performer type, overridable per booking) and misc per-event
  ad-hoc expenses MUST be unchanged in behavior by this feature.
- **FR-012**: Setting or ending a rent or ongoing charge MUST NOT alter figures already resolved for
  past events (effective-dated history is immutable).

### Key Entities *(include if feature involves data)*

- **Venue** (existing): where a dance is held. Gains a **default rent** — one or more effective-dated
  amounts; the base of the rent precedence. Events reference a venue optionally.
- **Series-at-venue rent**: an effective-dated amount keyed by (series, venue) — what a series pays at a
  particular venue — overriding that venue's default for that series' events. A series has a distinct
  value per venue (no series-wide rent).
- **Per-event rent**: an amount on a single event that overrides the series-at-venue and venue values (or
  provides a rent when the event has no venue). Mirrors the existing "standard pay, overridden on a
  booking" pattern.
- **Rent resolution**: per-event → series-at-venue → venue default → 0 (most specific wins).
- **Ongoing charge**: a series-scoped, effective-dated, labeled recurring expense. A series may carry
  several at once; each applies to every event until superseded (including by a $0 entry that ends it);
  Dance Net sums those in effect on the event's date.
- **Organizer report / Dance Net** (existing): consumes each event's resolved rent, ongoing charge, misc
  expenses, and performer total. Its arithmetic is unchanged; only where the rent figure comes from
  changes.
- **Performer pay**, **misc expense** (existing): referenced as the unchanged neighbors of rent/ongoing.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An organizer can set a venue rent once and have every event at that venue **that has no
  per-event override** reflect it in the organizer report without per-event entry.
- **SC-002**: Overriding a single event's rent changes that event's Dance Net and no other event's.
- **SC-003**: An event with no venue can be given a rent that appears in its Dance Net.
- **SC-004**: 100% of events that existed before the change resolve the identical rent and Dance Net
  immediately after the change (zero drift until a deliberate edit).
- **SC-005**: Multiple concurrent ongoing charges on a series each apply to every subsequent event and
  sum into Dance Net; ending one with a $0 entry stops only that charge for events on/after its stop date
  while the other charges and all earlier events are unchanged.
- **SC-006**: No figure already resolved for a past event changes when a later rent or ongoing charge is
  added or ended.

## Assumptions

- **Rent resolves through three effective-dated layers — venue default, series-at-venue override (keyed
  by series + venue), and per-event override — most specific winning, and 0 when none is set** (clarified
  2026-07-07). A series' rent varies by venue; there is no single series-wide rent.
- **Historical Dance Net is preserved by backfilling** each existing event with a per-event rent equal to
  its current resolved rent (today's global per-series rent has no direct equivalent in the (series,
  venue) model). Production loads fresh at go-live, so this affects only pre-go-live/seed data; the
  observable requirement is FR-007 / SC-004.
- **A series may carry multiple concurrent, independently-labeled ongoing charges** (clarified
  2026-07-07); each is effective-dated and ended on its own $0 schedule, and Dance Net sums those in
  effect. This replaces today's single-amount-per-series ongoing; today's one "Supplies/insurance" line
  per series simply becomes one labeled charge, so existing Dance Net is unchanged.
- **Whether rent, performer pay, and ongoing charges share one internal structure or are split by
  behavior, and where the per-event rent value is stored, are implementation decisions for
  `/speckit-plan`** — they do not change the behavior specified here (the P2-2 "one table vs. split" and
  "where the override lives" questions are HOW, not WHAT).
- **Per-individual performer pay** (as opposed to per performer type) stays out of scope (YAGNI); the
  standard-with-override pattern could absorb it later without new mechanism.
- Single-club scale; on-demand organizer edits only (no scheduling).

## Dependencies

- **Feature 007** (`venues` + optional `events.venue_id`) — already built; this feature adds a rent
  attribute to venues and a per-event rent to events.
- **Feature 009** (consolidated series parameters) — this feature revisits how rent is stored and
  resolved; performer-pay and ongoing resolution are reused/retained.
- **Feature 005** (organizer report / Dance Net) — the rent column now sources from the
  venue → series-at-venue → per-event precedence, and the ongoing column may be several charges summed;
  the Dance Net arithmetic (admission + merch − rent − performer total − ongoing − misc) is unchanged.
- The per-event rent override reuses the established "standard value, overridden on the instance" pattern
  already used for performer pay on bookings.
