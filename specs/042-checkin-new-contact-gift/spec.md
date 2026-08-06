# Feature Specification: Gift-Card Option When Checking In a Named Contact (new or returning)

**Feature Branch**: `042-checkin-new-contact-gift`

**Created**: 2026-08-06

**Status**: Draft

**Input**: User description: "R10"

## User Scenarios & Testing *(mandatory)*

At the door, the attendant (Meg) checks people in. For a **new** person she hasn't met before, she fills in their
name (and optionally email/phone) and checks them in; for a **returning** person she finds their existing record
and checks them in. Either way she can mark them as a **comp** (free admission). But an attendee — first-time or
returning — can also arrive holding a **gift card**, and today **neither named-person path** (new-contact or
returning/matched-contact) can record that redemption; only the anonymous/unmatched path offers both comp and
gift-card. This feature adds the gift-card option to **both** named-person check-in paths so any attendee's
gift-card redemption is captured just like everyone else's.

### User Story 1 - Record a gift-card redemption for a brand-new attendee (Priority: P1)

The attendant creates and checks in a new contact who is paying with a gift card. She marks the gift-card option
and checks them in; the event's gift-card-redemption count goes up by one, and the new contact is recorded as
attending.

**Why this priority**: It's the whole feature — the new-contact path is currently the only door path that can't
record a gift-card redemption, so a first-timer with a gift card is either mis-recorded or forces the attendant to
use a different path. Small, self-contained, and closes the gap.

**Independent Test**: Check in a new contact with the gift-card option selected; confirm the attendee is recorded
and the event's gift-card-redemption count increased by one, with no effect on any other figure.

**Acceptance Scenarios**:

1. **Given** the attendant is entering a new contact's details, **When** she marks the gift-card option and checks
   them in, **Then** the contact is recorded as attending and the event's gift-card-redemption count increases by
   one.
2. **Given** a new contact, **When** the attendant marks **both** comp and gift-card and checks them in, **Then**
   the event records **one** comp admission **and** **one** gift-card redemption (the two options are
   independent).
3. **Given** a new contact, **When** the attendant checks them in with **neither** option selected, **Then**
   behavior is exactly as today — no comp, no gift-card redemption.
4. **Given** a new contact with a gift-card redemption, **When** they are checked in, **Then** their name / email /
   phone / children-count capture behaves exactly as it does today.

---

### User Story 2 - Record a gift-card redemption for a returning attendee (Priority: P1)

The attendant finds a **returning** person's existing record in the check-in search results and checks them in
with a gift card. She marks the gift-card option on that person's row and checks them in; the event's gift-card
-redemption count goes up by one.

**Why this priority**: The returning/matched-contact path has the same gap as the new-contact path — it can mark a
comp but not a gift-card redemption. Closing both together is the point of the clarified scope; equal priority
because a returning attendee with a gift card is at least as common as a first-timer.

**Independent Test**: Find and check in an existing contact with the gift-card option selected; confirm the
attendee is recorded and the event's gift-card-redemption count increased by one, with no effect on any other
figure.

**Acceptance Scenarios**:

1. **Given** the attendant has found a returning person in the search results, **When** she marks the gift-card
   option on their row and checks them in, **Then** they are recorded as attending and the event's gift-card
   -redemption count increases by one.
2. **Given** a returning person, **When** the attendant marks **both** comp and gift-card, **Then** the event
   records one comp admission **and** one gift-card redemption (independent options).
3. **Given** a returning person, **When** the attendant checks them in with the gift-card option **not** selected,
   **Then** behavior is exactly as today (no gift-card redemption), including children-count and the
   community-dance open-band option.

---

### Edge Cases

- **Both comp and gift-card selected**: both are recorded (one comp + one gift-card redemption); they are
  independent, mirroring the anonymous path.
- **Neither selected**: unchanged from today (a plain new-contact check-in).
- **Community-dance open-band interaction**: the community-dance "open band" option (already present on the
  new-contact path) is independent of the gift-card option; selecting gift-card does not change open-band
  behavior, and vice versa.
- **New contact with no email/phone**: the existing "flagged for follow-up" behavior is unchanged when the
  gift-card option is used.

## Clarifications

### Session 2026-08-06

- Q: Should the gift-card option also be added to the returning/matched-contact check-in path (not just the
  new-contact path)? → A: Yes — add it to both named-person check-in paths (new **and** returning/matched), so
  every named check-in can record a gift-card redemption like the anonymous path.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: **Both** named-person check-in paths — the **new-contact** path and the **returning/matched-contact**
  path — MUST offer a **gift-card** option alongside the existing comp option.
- **FR-002**: When the gift-card option is selected on either path, checking the person in MUST record a
  **gift-card redemption** for the event (increasing the event's gift-card-redemption count by one).
- **FR-003**: The comp and gift-card options MUST be **independent** on both paths — a person may be marked comp,
  gift-card, both, or neither (mirroring the anonymous/unmatched path).
- **FR-004**: When neither option is selected, each path's check-in MUST behave exactly as today (no comp, no
  gift-card redemption).
- **FR-005**: The gift-card option MUST NOT change any other check-in behavior on either path — new-contact name /
  email / phone capture and the follow-up flag when contact info is missing, children count, and the
  community-dance open-band option all behave as today.

### Key Entities *(include if feature involves data)*

- **Door check-in (named person)**: the act of recording a named attendee — whether a first-time (new) contact or
  a returning/matched contact. Both paths gain the ability to record a gift-card redemption, in addition to the
  existing comp option.
- **Event gift-card-redemption count**: the running count of gift cards redeemed for admission at the event
  (already maintained for the anonymous path and shown on reports). This feature lets the new-contact path
  increment it too.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A door attendant can record a gift-card redemption while checking in **either** a brand-new contact
  **or** a returning/matched contact — both impossible today.
- **SC-002**: Each named-person check-in (new or returning) marked gift-card increases the event's gift-card
  -redemption count by exactly one.
- **SC-003**: Marking a person (new or returning) both comp and gift-card records exactly one comp admission and
  one gift-card redemption.
- **SC-004**: The anonymous/unmatched check-in path is unchanged.

## Assumptions

- **Mirror the anonymous path**: both named-person paths get a gift-card option that works like the existing
  anonymous-path gift-card option — an independent toggle recorded as a redemption count. No per-card data (number,
  value) is captured, consistent with how gift-card redemptions are recorded today.
- **No schema or data change**: the event's gift-card-redemption count already exists and is already incremented
  for the anonymous path; the check-in recording already accepts a gift-card-redemption flag. This feature only
  exposes and wires the option on the new-contact and returning/matched-contact paths.
- **Gift-card *redemption*, not *sale***: this is an attendee *redeeming* a gift card for admission, not *buying*
  one (a gift-card purchase is a gate sale, out of scope here).
- **Scope — both named-person paths, per the 2026-08-06 clarification**: the new-contact path **and** the
  returning/matched-contact path. The anonymous/unmatched path already has the option and is unchanged.
