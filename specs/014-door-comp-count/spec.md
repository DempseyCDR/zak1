# Feature Specification: Door Comp Count Feeding Paying Dancers

**Feature Branch**: `014-door-comp-count`

**Created**: 2026-07-08

**Status**: Draft

**Input**: User description: "specs/PHASE2_REQUIREMENTS.md — item P2-5 (record a comp count on the door record — people admitted free — and subtract it from the organizer report's paying-dancer count; gift-card redeemers stay counted as paying)"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Record comps so paying-dancer count and Avg Ticket are accurate (Priority: P1)

Some people are admitted **free** at the door — a "your next dance free" card redemption, or a
performer's guest. Today the organizer report counts everyone who attended (minus performers and the
door attendant) as a paying dancer, so these free admissions inflate the paying-dancer count and
**understate Avg Ticket**. The door/gate operator wants to record a **comp count** for the event, and
have the organizer report subtract it so the paying-dancer count — and therefore Avg Ticket — reflects
only people who actually paid at the door.

**Why this priority**: This is the whole point of the feature — an accurate paying-dancer count and Avg
Ticket. Independently valuable and testable.

**Independent Test**: Record a comp count of N on an event; confirm the organizer report's paying-dancer
count drops by N and Avg Ticket rises correspondingly.

**Acceptance Scenarios**:

1. **Given** an event with a known attendance and no comps, **When** the operator records a comp count of
   3, **Then** the organizer report's paying-dancer count for that event is 3 lower and Avg Ticket rises
   accordingly.
2. **Given** the door/gate entry surface, **When** the operator records a comp count, **Then** it is a
   distinct field from the existing gift-card redemption count.
3. **Given** an event where comps + performers + the door attendant meet or exceed attendance, **When**
   the report is computed, **Then** the paying-dancer count is floored at 0 (never negative).

---

### User Story 2 - Gift-card redeemers stay paying; no comps means no change (Priority: P2)

Gift-card redeemers already paid (when they bought the gift card), so they must **still count as paying
dancers** — recording a gift-card redemption must not reduce the paying-dancer count. And an event with
no comps must report exactly the same figures as before this feature.

**Why this priority**: A non-regression guardrail that protects existing reports and keeps the two counts
(comps vs. gift-card redemptions) doing different jobs.

**Independent Test**: For an event with a gift-card redemption but no comps, confirm the paying-dancer
count is unchanged from today; for an event with comp count 0, confirm the report matches pre-feature
values.

**Acceptance Scenarios**:

1. **Given** an event with a gift-card redemption recorded and no comps, **When** the report is computed,
   **Then** the paying-dancer count is the same as if no gift-card redemption were recorded (gift-card
   redemptions do not reduce paying dancers).
2. **Given** an event with a comp count of 0 (or none recorded), **When** the report is computed, **Then**
   its paying-dancer count and Avg Ticket equal their values before this feature.

---

### Edge Cases

- **Comps not entered** → treated as 0 (an event without a recorded comp count behaves as today).
- **Comps ≥ remaining dancers** (comps + performers + door attendant ≥ attendance) → paying dancers
  floored at 0, never negative.
- **Comps entered as a bare count** — a single number covering both "next dance free" redemptions and
  performers' guests together (not split by kind).
- **Gift-card redemptions and comps on the same event** — independent counts; only comps reduce paying
  dancers.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The door record for an event MUST support a **comp count** — the number of people admitted
  free ("your next dance free" card redemptions and performers' guests), recorded as a single combined
  count.
- **FR-002**: The door/gate-money entry surface MUST let the operator record the comp count as a field
  **distinct** from the existing gift-card redemption count.
- **FR-003**: The organizer report's **paying-dancer count MUST subtract comps**: paying dancers =
  attendance − distinct performers − 1 (door attendant) − comps, floored at 0.
- **FR-004**: **Avg Ticket** (admission ÷ paying dancers) MUST be computed from the comp-adjusted
  paying-dancer count.
- **FR-005**: **Gift-card redeemers MUST continue to count as paying dancers** — the gift-card
  redemption count MUST NOT reduce the paying-dancer count.
- **FR-006**: With a comp count of 0 (or none recorded), the paying-dancer count and Avg Ticket MUST
  equal their pre-feature values (no regression).
- **FR-007**: The comp count MUST default to 0 when not entered.

### Key Entities *(include if feature involves data)*

- **Door record** (existing, one per event): gains a **comp count** — people admitted free. Distinct from
  the existing **gift-card redemption count** (which is for revenue reconciliation and does not affect
  paying dancers).
- **Organizer report — paying dancers & Avg Ticket** (existing): the paying-dancer derivation now also
  subtracts the event's comp count; Avg Ticket derives from that adjusted count. Admission revenue, gate
  money, and attendance counts are unaffected.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Recording a comp count of N on an event lowers its paying-dancer count by N and raises Avg
  Ticket correspondingly.
- **SC-002**: An event with a gift-card redemption but no comps has the same paying-dancer count as if the
  redemption were not recorded (gift-card redemptions never reduce paying dancers).
- **SC-003**: An event with a comp count of 0 has the same paying-dancer count and Avg Ticket as before
  this feature (no regression on existing events).
- **SC-004**: The paying-dancer count is never negative — it is floored at 0 when comps (plus performers
  and the door attendant) meet or exceed attendance.

## Assumptions

- **Comps are a single combined count** — "your next dance free" redemptions and performers' guests
  together — not split by kind (settled in P2-5).
- **Gift-card redeemers count as paying** because they paid at gift-card purchase; the existing gift-card
  redemption count is for revenue reconciliation only and is unchanged by this feature.
- **The single door attendant** (the −1 in the derivation) is unchanged.
- **Comps affect only the paying-dancer / Avg Ticket derivation** — not admission revenue, gate money,
  attendance counts, or any other report line.
- This item **supersedes BACKLOG B14** (the previously-deferred "comps at the door").
- The existing `gift_card_redemption_count` is left untouched. Note it is a **dormant** field (schema +
  API only, no UI entry, no report consumer since feature 002) — deferred to **BACKLOG B21** (Phase 3,
  user roles + UI) to decide whether to surface or drop it.
- Single-club scale; operator-entered data at the door.

## Dependencies

- **Feature 002** (door record + gate-money entry) — the door record gains the comp-count field and the
  entry surface exposes it.
- **Feature 005** (organizer report: paying-dancer and Avg Ticket derivation) — the paying-dancer count
  subtracts comps; Avg Ticket follows.
