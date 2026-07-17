# Feature Specification: Check-in Overhaul

**Feature Branch**: `017-checkin-overhaul`

**Created**: 2026-07-17

**Status**: Draft

**Input**: User description: "Feature 017 — Check-in overhaul (Phase 3 package P3-3). Overhaul the Door Attendant's /checkin workflow, gated to the Door Attendant role. Bundles B34 (new-contact first+last+editable display name), B33 (sortable checked-in roster), B35 (family check-in with paying children count, all series), B36 (open-band musician comp'd group-wide, community_dance rule), B29 (comp & gift-card counts captured at check-in, relocated from /gate, resolves B21)."

## Clarifications

### Session 2026-07-17

- Q: B36 — how is the open-band musician's group-wide comp represented so attendance / paying-dancers /
  revenue stay correct? → A: **Comp at each event, no cross-event counter.** The open-band flag at the
  community dance marks the musician, counts them as attending there, and increments that event's own
  comp count. Their group-wide free admission is realized at redemption: when they attend another event in
  the group they are checked in as a comp at *that* event, incrementing its own comp count. Each event keeps
  the single-event comp counter it has today; no event-group-aware counter or per-musician entitlement ledger
  is built (YAGNI). "Comped into all events of the group" is honoured as a per-attendance redemption, keeping
  comps counts-only / never-who.
- Q: B35 — where does the family children count live? → A: **Guest count on the parent's attendance row.** A
  non-negative children count is stored on the attendance row created for the parent contact; the family is
  one roster line (parent + children badge). Attendance total and the paying-dancer derivation sum the
  children counts across rows. No placeholder child rows, no event-level aggregate.
- Q: B29 — what can the FS do with the captured comp & gift-card counts on `/gate`? → A: **FS may
  edit/override on `/gate`.** Check-in pre-populates the counts onto the door record; `/gate` stays writable
  for these fields (as it is today for the comp count), so the FS confirms by accepting or adjusting during
  money reconciliation.
- Q: B29 — how does the Door Attendant capture comps/gift-card redemptions at check-in? → A (refinement
  2026-07-17): **per-check-in boolean checkboxes**, not typed aggregate counts. Each ticked box on a
  check-in **materializes** into the door record's count (`comp_count` / `gift_card_redemption_count`) by
  incrementing it — still counts-only, never attributed (nothing stored on the attendance row). This is
  carried on the existing attendance check-in call (any path, including an anonymous `unmatched` admission),
  so the earlier standalone `checkin-counts` endpoint was **removed**. The `/gate` FS override is unchanged.

## User Scenarios & Testing *(mandatory)*

The single actor throughout is the **Door Attendant** — the volunteer working the door at an event,
checking people in. This role has read/write access to `/checkin` and, per the authorization model shipped
in feature 016, **no access to `/gate`** (money is the Financial Secretary's boundary). A second actor, the
**Financial Secretary (FS)**, appears only at the tail of the flow, when they later open the door record to
reconcile money and confirm the counts the Door Attendant captured.

The stories are ordered to build on one another: capturing structured names (US1) is what makes the roster
(US2) worth sorting; the comp-capture relocation (US4) must land before the group-wide open-band comp (US5)
because US5 extends the comp model US4 moves.

### User Story 1 - New contact captured with full name and editable display name (Priority: P1)

A dancer arrives who is not yet in the directory. The Door Attendant adds them on the spot, entering a
**first name and a last name**. The system proposes a **display name** by concatenating the two ("first
last"), and the Door Attendant can **edit that proposed display name** before saving (e.g. to record a
preferred or professional name). The new contact is created and checked in for the event in one action.

**Why this priority**: This is the foundation of the package. Today the check-in new-contact form has a
single name field and captures only a first name, so the directory accrues last-name-less records that
cannot be sorted or matched reliably. Every later story that shows or sorts attendees is degraded until last
names are actually captured here.

**Independent Test**: Add a brand-new attendee at check-in with first + last name, accept or edit the
proposed display name, and confirm the contact persists with first name, last name, and the chosen display
name, and appears as checked in for the event.

**Acceptance Scenarios**:

1. **Given** a person not in the directory, **When** the Door Attendant enters first and last name and
   saves without touching the display name, **Then** a contact is created whose effective display name is
   "first last" and who is checked in for the event.
2. **Given** the same flow, **When** the Door Attendant edits the proposed display name before saving,
   **Then** the contact is created with the edited value as its display-name override, while first and last
   name are preserved separately.
3. **Given** a new contact with only a first name (last name left blank), **When** the Door Attendant
   saves, **Then** the contact is created and checked in (last name remains optional), with the display name
   defaulting to the first name.

---

### User Story 2 - Checked-in roster, sortable by first or last name (Priority: P2)

While working the door, the Door Attendant wants to see **who has already been checked in** for this event,
as a running list they can re-sort **by first name or by last name**. This lets them confirm a check-in
landed, spot duplicates, and answer "is so-and-so here yet?" without re-searching the directory.

**Why this priority**: The Door Attendant's real workflow needs a running roster; today `/checkin` only
searches the directory and records check-ins and shows no list of who is already in. It depends on US1 for
last names to be present and meaningful, but is independently valuable and testable.

**Independent Test**: Check in several attendees, open the roster panel, toggle the sort between first-name
and last-name order, and confirm the same set of attendees re-orders correctly in each mode.

**Acceptance Scenarios**:

1. **Given** several attendees checked in for an event, **When** the Door Attendant views the roster,
   **Then** every checked-in attendee is listed with a name.
2. **Given** the roster is displayed, **When** the Door Attendant sorts by last name, **Then** the list
   orders by last name (then first name for ties); **When** they sort by first name, **Then** it orders by
   first name.
3. **Given** an attendee just checked in, **When** the roster is next viewed, **Then** that attendee appears
   in it.

---

### User Story 3 - Family check-in with a paying children count (Priority: P3)

A family arrives together. The Door Attendant checks in **one adult contact (the parent)** and records a
**count of children** with them, rather than creating a separate contact per child. The children are
**paying attendees**: they raise both the total attendance and the paying-dancer count for the event.

**Why this priority**: Families are a routine door case with no clean representation today — attendance is
strictly one row per contact with no guest/child count, forcing either fake contacts or under-counting.
Getting the paying-dancer math right matters for the organizer report. Applies to **every series**, not just
community dances.

**Independent Test**: Check in a parent with N children on an event, then confirm the event's attendance
total and derived paying-dancer count both increase by the parent plus N children.

**Acceptance Scenarios**:

1. **Given** a parent contact and a children count of N, **When** the Door Attendant checks the family in,
   **Then** the event's attendance total reflects 1 + N people.
2. **Given** the same family check-in, **When** paying dancers are derived for the event, **Then** the N
   children are counted as paying (added, not subtracted as comps).
3. **Given** a children count of 0, **When** the Door Attendant checks in the parent, **Then** behaviour is
   identical to a plain single-contact check-in.

---

### User Story 4 - Comp and gift-card counts captured at check-in for FS confirmation (Priority: P4)

The Door Attendant is the person who actually sees who is admitted **free** (a "next dance free" card, a
performer's "plus one") and who **redeems a gift card**. They tick a **comp** and/or **gift-card-redeemed**
checkbox on that person's check-in; each tick **increments** the event's door-record count. Later, when the
FS opens that door record to reconcile money, they **see the materialized counts and confirm/override them**.
Counts only are captured — never which attendee was comped or redeemed.

**Why this priority**: This relocates comp capture from `/gate` (feature 014) to `/checkin`, aligning
capture with the role that observes it and honouring the Door Attendant's `/gate` exclusion. It also gives
the long-orphaned gift-card **redemption count** its capture point (resolves B21). It is sequenced before
US5 because the open-band group comp extends the comp model this story relocates.

**Independent Test**: At check-in, tick the comp and gift-card boxes on some check-ins; confirm the door
record's counts increment accordingly, are visible to the FS on `/gate` for confirmation/override, and that
comps still reduce paying dancers exactly as when captured at `/gate`.

**Acceptance Scenarios**:

1. **Given** the Door Attendant at check-in, **When** they tick the comp box and the gift-card box on
   check-ins, **Then** the event's door-record `comp_count` and `gift_card_redemption_count` each increment.
2. **Given** counts captured at check-in, **When** the FS opens the event on `/gate`, **Then** the FS sees
   the materialized comp and gift-card redemption counts to confirm.
3. **Given** a comp count captured at check-in, **When** paying dancers are derived, **Then** comps reduce
   the paying-dancer count exactly as before (behaviour of feature 014 preserved).
4. **Given** the Door Attendant role, **When** they capture these counts, **Then** they never gain access to
   `/gate` or to any money figure.

---

### User Story 5 - Open-band musician comped across the whole event group (Priority: P5)

At a **community dance** (its own series), the music is carried by one or more paid musicians plus several
**open-band musicians** — unpaid, non-leading players who sit in. When the Door Attendant checks in an
open-band musician, they **flag them as such**. That musician **counts as attending** the event, and — as
the community-dance rule — earns a **comp that applies across all events in the event group**, not only the
event they played.

**Why this priority**: This looked like the one genuinely new modeling problem in the package — feature
014's comp count is single-event and cannot express a comp **earned at one event and redeemed at another**.
The 2026-07-17 clarification dissolves it: the comp is recorded at whichever event the musician is admitted
free (each event keeps its own counter), so no new group-comp structure is built. It stays lowest priority
because it affects the fewest events (community dances only) and adds the open-band flag + count-as-attending
semantics on top of the earlier stories.

**Independent Test**: At a community-dance event, check in an open-band musician; confirm they count as
attending and are recorded as a comp at that event. Then at another event in the same event group, check
them in as a comp and confirm that event's own comp count reflects it — with no cross-event counter
involved.

**Acceptance Scenarios**:

1. **Given** a community-dance event, **When** the Door Attendant checks in an open-band musician and flags
   them, **Then** that musician is recorded as attending the event.
2. **Given** an open-band musician flagged at a community dance, **When** the event's paying dancers are
   derived, **Then** they count as attending *and* as a comp at that event (admitted free), so they raise
   attendance but not paying dancers there.
3. **Given** the same musician later attends another event in the same event group, **When** the Door
   Attendant admits them free, **Then** that is recorded as a comp at *that* event — each event tallies its
   own comps; there is no cross-event counter or per-musician entitlement ledger (see Clarifications
   2026-07-17).
4. **Given** a contact who is a booked performer for a community-dance event, **When** the Door Attendant
   tries to flag them as an open-band musician at check-in, **Then** the flag is rejected (FR-022a) — they
   are already counted as a performer.

---

### Edge Cases

- **Duplicate at the door**: the Door Attendant tries to check in someone already checked in for this event
  — the system should surface that they are already on the roster rather than silently double-count.
- **New contact collides with an existing one**: a person entered as "new" matches an existing directory
  contact (same name) — resolution is the existing dedup behaviour; this feature does not change matching.
- **Negative or absurd children/comp/gift counts**: counts must be non-negative integers; blank means zero.
- **FS adjusts a captured count**: after the Door Attendant captures comp/gift counts, the FS finds a
  discrepancy during reconciliation — the FS may edit/override the counts on `/gate` (the fields stay
  writable there; check-in only pre-populates them). See Clarifications 2026-07-17.
- **Open-band musician who is also a booked/paid performer**: a paid performer must not also be counted as
  an unpaid open-band comp for the same event — the paying-dancer derivation subtracts performers *and*
  comps, so counting one person as both double-subtracts. The system **rejects** the open-band flag when the
  contact is a booked performer for that event (FR-022a).
- **Non-community event**: the open-band flag/rule applies only to the community-dance series; it must not
  appear or take effect on other series' events.
- **Roster after the 90-day purge**: attendance rows purge at 90 days (feature 002); the roster for an old
  event is legitimately empty.

## Requirements *(mandatory)*

### Functional Requirements

#### New-contact capture (B34)

- **FR-001**: The check-in new-contact form MUST accept a **first name** and a **last name** as separate
  fields (last name optional, consistent with the existing validation contract).
- **FR-002**: The system MUST propose a display name by concatenating first and last name, and MUST allow
  the Door Attendant to **edit** that proposed display name before saving.
- **FR-003**: When the Door Attendant saves an edited display name, the system MUST persist it as the
  contact's **display-name override** while preserving first and last name separately; when unedited, the
  effective display name MUST equal the derived "first last".
- **FR-004**: Creating a new contact at check-in MUST also check that contact in for the current event in a
  single action.

#### Checked-in roster (B33)

- **FR-005**: `/checkin` MUST present a **roster of attendees already checked in** for the current event.
- **FR-006**: The roster MUST be **sortable by first name and by last name**, using the structured first/last
  names, with a deterministic tiebreak.
- **FR-007**: The roster data MUST expose structured first and last names (not only a display name) so the
  ordering is by the intended field.
- **FR-008**: A newly recorded check-in MUST appear in the roster on its next view.

#### Family check-in (B35, all series)

- **FR-009**: The Door Attendant MUST be able to check in **one parent contact together with a count of
  children** in a single action, for events in **any series**.
- **FR-010**: The children count MUST be a **non-negative integer**; absent/blank MUST be treated as zero,
  making a family check-in with zero children identical to an ordinary single-contact check-in.
- **FR-011**: The children count MUST be stored on the **parent's attendance row** (a guest/children count
  on that row — not placeholder child rows nor a contact-less event aggregate) and MUST count toward the
  event's **total attendance** (attendance total = attendance rows + the sum of children counts).
- **FR-012**: Children MUST count as **paying**: the paying-dancer derivation MUST **add** the summed
  children count (children are not comps and are not subtracted).

#### Comp & gift-card capture relocation (B29, resolves B21)

- **FR-013**: The Door Attendant MUST be able to mark each check-in with a **comp** boolean and a
  **gift-card-redeemed** boolean (checkboxes), for any check-in path including an anonymous unmatched one.
- **FR-014**: Each ticked box MUST **materialize** into the event's door record by **incrementing** the
  respective count (`comp_count` / `gift_card_redemption_count`) — counts-only, never attributed to the
  attendee (nothing is stored on the attendance row).
- **FR-015**: The FS MUST see the captured comp and gift-card redemption counts on `/gate` for
  **confirmation** during money reconciliation, and MUST be able to **edit/override** them there (check-in
  pre-populates; the fields stay writable on `/gate`).
- **FR-016**: The comp count MUST continue to reduce paying dancers exactly as in feature 014 (no change to
  the derivation's treatment of comps).
- **FR-017**: The gift-card **redemption count** (distinct from the gate gift-card **sales** dollar line)
  MUST now have a capture point and be persisted; gift-card redeemers remain counted as **paying** (no
  change to that rule).
- **FR-018**: Comp/gift-card capture MUST NOT grant the Door Attendant any access to `/gate` or to money
  figures; capture happens entirely within `/checkin`.

#### Open-band musician group comp (B36, community-dance rule)

- **FR-019**: At a **community-dance** event, the Door Attendant MUST be able to **flag a checked-in
  attendee as an open-band musician** (unpaid, non-leading). This flag is set **manually at check-in** — the
  musician is not scheduled by the Booker and MUST NOT be sourced from `bookings`/`performers`; the system
  offers the flag and the Door Attendant applies it by observation.
- **FR-020**: An open-band musician so flagged MUST **count as attending** the event.
- **FR-021**: Flagging an open-band musician at a community dance MUST record a comp at **that** event (they
  are admitted free — counted as attending, subtracted from paying dancers there). Their group-wide free
  admission MUST be realized **at redemption**: attending another event in the same event group is recorded
  as a comp at that event, via each event's own comp count. The system MUST NOT build a cross-event comp
  counter or a per-musician entitlement ledger — comps remain single-event and counts-only (Clarifications
  2026-07-17).
- **FR-022**: The open-band flag/rule MUST apply **only** to the community-dance series and MUST have no
  effect on events of other series.
- **FR-022a**: The system MUST **reject** the open-band flag when the checked-in contact is a **booked
  performer** for that event. A booked performer is already accounted in the performer subtraction of the
  paying-dancer derivation; counting them additionally as an open-band comp would double-subtract. (This is
  the sole cross-check against booking data — detection of open-band musicians is otherwise manual per
  FR-019.)

#### Cross-cutting / authorization

- **FR-023**: All new check-in capabilities MUST be gated to the **Door Attendant** role (and roles that
  supersede it) under the feature-016 authorization model; the Door Attendant's exclusion from `/gate` MUST
  be preserved.
- **FR-024**: Count and name captures at check-in MUST be validated at the boundary (non-negative integer
  counts; required first name; optional last name) and MUST be auditable consistently with existing door /
  attendance writes.

### Key Entities *(include if feature involves data)*

- **Attendance record**: today one row per checked-in contact for an event. This feature extends the row to
  carry a **children (guest) count** (a family is the parent's row + this count, summed into attendance and
  paying dancers) and to **mark the attendee as an open-band musician** at community dances. It remains
  counts/flags at the level of the check-in row, never per-child identities.
- **Contact**: gains reliable **first + last name** and an optional **display-name override** captured at
  the door (the substrate already exists from feature 012; this feature closes the capture gap).
- **Door record**: the per-event money/count record that now **receives comp and gift-card redemption counts
  captured at check-in** (relocated from `/gate`), for FS confirmation.
- **Event group**: the existing grouping of related events. Defines the set of events at which an open-band
  musician is entitled to free admission. Per the 2026-07-17 clarification, no new event-group-aware comp
  structure is built: each event still records its own comps; the group is the operational policy boundary,
  redeemed one event at a time.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of new contacts added at check-in persist a first name, a last name (when provided), and
  the intended display name (derived or overridden) — no more first-name-only door records.
- **SC-002**: The Door Attendant can view the checked-in roster and re-sort it by first vs. last name, with
  the ordering correct in both modes for a mixed set of attendees.
- **SC-003**: For a family check-in of one parent + N children, the event's attendance total and derived
  paying-dancer count each increase by exactly 1 + N.
- **SC-004**: Comp and gift-card redemption counts entered at check-in appear unchanged on the event's door
  record and are visible to the FS on `/gate`, with paying-dancer figures identical to capturing the same
  comp count at `/gate` before this feature.
- **SC-005**: An open-band musician checked in at a community dance counts as attending and yields a
  group-wide comp, leaving paying-dancer and revenue totals across the event group correct (verified against
  the accounting decision resolved in clarification).
- **SC-006**: The Door Attendant completes a routine check-in (search or add, record) without ever reaching
  `/gate` or seeing a money figure.

## Assumptions

- **Bare children count, no per-child data.** A family check-in records only a non-negative count of
  children attached to the parent's check-in; no name, age, or per-child row is captured. (Open question (b)
  resolved to the count-only default; revisit only if a downstream need for per-child data appears.)
- **Community dance is a series, not an event type.** `community_dance` is already a seeded series peer to
  `tnc` (B37 retired); no `events.type` column is added. The open-band rule keys off the event's series.
- **Open-band musicians are detected manually at the door, not derived from any schedule.** The Booker does
  **not** schedule open-band musicians — they simply show up at the community dance and sit in. There is no
  automatic detection and no lookup against `bookings`/`performers`: the musician self-identifies at the door
  and the Door Attendant ticks an "open-band musician" flag on that check-in (setting `is_open_band` on the
  attendance row). The Booker schedules only the **paid** musicians; open-band players are by definition the
  ones absent from that schedule, which is precisely why they cannot be sourced from booking data and must be
  captured at check-in. (The `performer_type` enum's `open_band_musician` value belongs to the
  performers/bookings domain and is **not** the mechanism here.)
- **Comps stay counts-only, never attributed.** Consistent with feature 014, neither comps nor gift-card
  redemptions record *who* was comped/redeemed — only per-event counts (the open-band comp adds the
  group-wide dimension, still without attendee identity).
- **Gift-card redemption vs. sales are distinct.** The redemption **count** captured here is separate from
  the gate gift-card **sales** dollar line (which stays on `/gate`); redeemers remain paying.
- **Reuses existing substrate.** First/last-name concatenation (feature 012), the `door_records.comp_count`
  and `gift_card_redemption_count` columns (feature 002/014), event groups, the Door Attendant role and its
  `/gate` exclusion (feature 016), and the contact-search picker convention (B39) are all reused, not
  rebuilt.
- **Dedup/matching unchanged.** This feature does not alter how a typed name is matched to existing contacts;
  it only enriches what is captured for a genuinely new contact.

## Dependencies

- **P3-1 (feature 015) staff auth** and **P3-2 (feature 016) authorization** — the Door Attendant role, its
  scope, and its `/gate` exclusion are prerequisites for gating the new capabilities.
- **Feature 012** (structured contact names) — supplies first/last name and display-name-override substrate.
- **Feature 014 / feature 002** (`door_records`, `comp_count`, `gift_card_redemption_count`) — the comp
  capture relocation revises feature 014 and resolves B21.
- **Event groups** (feature 002/010) — the entitlement boundary for the open-band comp (B36). Per the
  2026-07-17 clarification the single-event comp counter is **retained** (comp recorded at each event on
  redemption), so no event-group-aware comp counter is required.

## Out of Scope

- Attributing comps or gift-card redemptions to specific attendees.
- Per-child data (names, ages) for family check-in.
- Any Door Attendant access to `/gate` or money figures.
- Changes to directory dedup/matching logic.
- Group-ticket redemption (B1) and door/online membership enrollment (B30/B31) — separate packages.
- The general polished entity-picker component (B39); the existing minimal contact search is reused.
