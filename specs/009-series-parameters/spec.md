# Feature Specification: Series-Scoped Rate & Expense Parameters

**Feature Branch**: `009-series-parameters`

**Created**: 2026-07-03

**Status**: Draft

**Input**: Derived from BACKLOG.md item B16 (consolidate `rateParameters` and `SeriesExpenseParameter` into one series-scoped entity), extended with a new Musician pay-rate kind — a hard prerequisite surfaced while specifying feature 008 (Band roster), which needs a series-scoped standard Musician rate to default pay when booking a band.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Set a standard performer pay rate per series (Priority: P1)

An organizer sets the standard Caller (or Sound Tech) pay rate for one series — say, Thursday Night Contra — without that rate applying to every other series. Today, a standard rate applies uniformly to every series; this lets different series pay differently.

**Why this priority**: This is the core capability the consolidation exists to deliver — rates that vary by series instead of being a single global figure.

**Independent Test**: Set a Caller rate for one series, and a different Caller rate for another series, both effective the same date; book a Caller on an event in each series and confirm each resolves its own series' rate.

**Acceptance Scenarios**:

1. **Given** no series-specific Caller rate has been set, **When** an organizer sets a Caller rate of $150 for series A effective 2026-01-01, **Then** a Caller booked on a series A event on or after that date defaults to $150.
2. **Given** series A has a $150 Caller rate, **When** an organizer separately sets a $120 Caller rate for series B effective the same date, **Then** a Caller booked on a series B event defaults to $120, and series A is unaffected.
3. **Given** a series' rate for a kind, **When** an organizer sets a new rate for that series and kind effective a later date, **Then** events before that date keep using the prior rate and events on/after it use the new one (unchanged effective-dating behavior).

---

### User Story 2 - Existing series expense parameters keep working (Priority: P1)

An organizer/treasurer continues to set and use per-series Rent and Ongoing expense parameters (feature 005) exactly as today, unaffected by the consolidation happening underneath.

**Why this priority**: This consolidation must not regress a feature that already works and that the Organizer Report depends on.

**Independent Test**: Set a Rent and an Ongoing expense for a series at an effective date; confirm the Organizer Report resolves the same figures it would have before this change.

**Acceptance Scenarios**:

1. **Given** a series with a Rent and an Ongoing expense set, **When** the Organizer Report is generated for an event in that series, **Then** it resolves the same amounts as it did before this consolidation.
2. **Given** an existing series expense parameter, **When** an organizer sets a new one for a later effective date, **Then** resolution behaves exactly as it does today (greatest effective date on/before the target date).

---

### User Story 3 - Set a standard Musician rate per series (Priority: P2)

An organizer sets a standard Musician pay rate for a series. Today, Musician and Lead Musician bookings have no standard rate at all and always require manual entry; this closes that gap and unblocks feature 008's band-booking pay defaults.

**Why this priority**: Directly required by feature 008; otherwise valuable on its own for individual musician bookings (feature 003), independent of bands.

**Independent Test**: Set a Musician rate for a series; book a Musician (or Lead Musician) on an event in that series and confirm pay defaults to that rate instead of requiring manual entry.

**Acceptance Scenarios**:

1. **Given** no standard Musician rate exists for a series, **When** a Musician is booked on an event in that series, **Then** pay defaults to $0 / manual entry, exactly as it does today.
2. **Given** a series has a standard Musician rate in effect, **When** a Musician or Lead Musician is booked on an event in that series, **Then** pay defaults to that rate, overridable per booking as today's rate defaults already are for Caller/Sound Tech.

---

### User Story 4 - A "general" series covers joint or cross-series events (Priority: P3)

An organizer sets a standard rate or expense for events that don't belong to one specific standing series (for example, a joint special event combining two series), using a "general" series instead of having to duplicate the same figure across every standing series.

**Why this priority**: A smaller, less-frequent need than the per-series rates themselves, but necessary so joint events aren't left without sensible standard rates.

**Independent Test**: Assign an event to the general series, set a rate scoped to the general series, and confirm that event resolves it.

**Acceptance Scenarios**:

1. **Given** the general series exists, **When** an organizer creates or assigns an event to it, **Then** that event resolves rates/expenses scoped to the general series exactly as any other series would.
2. **Given** a rate is set for series A only, **When** an event belongs to the general series (not series A), **Then** it does NOT inherit series A's rate — every series, including general, requires its own explicit parameter entries (no automatic fallback between series).

### Edge Cases

- A parameter kind (rate or expense) has no entry at all for a series: resolution yields $0 / no expense, exactly as it does today when nothing has been configured.
- An organizer sets a parameter effective-dated in the future: it has no effect on any event until that date arrives, consistent with today's effective-dating behavior.
- A series has a rate set, but the general series doesn't (or vice versa): each series is independent; nothing carries over between them (User Story 4, Scenario 2).
- A past parameter is superseded by a later one: previously computed booking pay and report figures do not change retroactively — only future resolutions use the new value.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST support one consolidated, effective-dated parameter model covering both standard performer pay rates (Caller, Sound Tech, Musician) and series expenses (Rent, Ongoing), each scoped to a series.
- **FR-002**: Every parameter (rate or expense) MUST be scoped to a series — there is no global, series-less parameter.
- **FR-003**: System MUST resolve the amount in effect for a given series, kind, and date as the parameter with the greatest effective date on or before that date; this resolution rule is unchanged from today's behavior and applies identically to every kind.
- **FR-004**: System MUST provide a "general" series usable for events that don't belong to one specific standing series (e.g., joint or cross-series special events), so organizers aren't forced to duplicate a rate or expense across every standing series to cover such events.
- **FR-005**: Migrating existing global Caller and Sound Tech rates to this series-scoped model MUST NOT change what any existing series resolves — today's single rate per kind must continue to resolve identically for every existing series (and the new general series) until an organizer deliberately sets a series-specific override.
- **FR-006**: System MUST support a standard Musician pay rate as one of the parameter kinds, scoped per series, defaulting pay for both Lead Musician and Musician bookings (feature 003 individually, and feature 008 when booking a Band) — there is no rate to migrate for this kind, since none exists today.
- **FR-007**: System MUST continue to support the existing per-series Rent and Ongoing expense parameters (feature 005) with no change in organizer/treasurer-facing behavior.
- **FR-008**: System MUST keep an append-only audit trail (who changed it, what it was set to, when) for every parameter change, for both rate and expense kinds alike — rate changes already have this; expense changes MUST gain the same durability.
- **FR-009**: System MUST let an organizer view, for a given series and date, which amount is currently in effect for each parameter kind.
- **FR-010**: Superseding a parameter with a new effective-dated entry MUST NOT alter historical pay or expense figures already recorded on past bookings or reports.

### Key Entities *(include if feature involves data)*

- **Series Parameter**: An effective-dated amount, scoped to a series and a kind (Caller rate, Sound Tech rate, Musician rate, Rent expense, or Ongoing expense). A new entry for the same series and kind supersedes prior ones from its effective date forward; it is never edited in place.
- **General Series**: A series usable for events that don't belong to one specific standing series, so parameters can still be scoped to something meaningful without per-series duplication or a fallback rule.
- **Parameter Change Record**: An append-only audit entry capturing who changed a parameter, what it was set to, and when — applying uniformly to rate and expense kinds.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Setting a series-specific rate for one series never changes the resolved rate for any other series, in 100% of cases.
- **SC-002**: After migrating to series-scoped parameters, every existing booking and report continues to compute the exact same figures it did before the change.
- **SC-003**: An organizer can set a distinct Musician rate for a series and see it applied automatically the next time a Musician is booked in that series, without manual entry.
- **SC-004**: An event that doesn't belong to one specific standing series can still resolve a standard rate or expense via the general series, without the organizer duplicating that figure across every other series.
- **SC-005**: 100% of parameter changes, rate or expense, are recorded in a queryable audit trail.

## Assumptions

- This consolidates two existing entities (rate parameters and series expense parameters) that are already functionally identical in shape (effective-dated, resolved by "greatest effective date ≤ target date"); the only substantive behavior change is making rates series-scoped, to match how expenses already work.
- Existing Rent/Ongoing expense behavior (feature 005) is preserved unchanged; this feature is a consolidation and retrofit of Rate parameters (feature 003) to match expense's existing series-scoped design, not a redesign of expenses.
- The Musician rate kind (FR-006) is included here specifically because feature 008 (Band roster) depends on it for its per-series pay-default behavior; it is also independently useful for individual Musician/Lead Musician bookings today.
- No automatic fallback exists between series (including to/from the general series) — every series that needs a rate or expense must have its own explicit entry. This was a deliberate simplification over an earlier nullable/global-fallback design.
- No access-control distinction is introduced for who may set parameters, consistent with this build's existing no-authentication model.
- The admin UI may continue to be presented as today's two separate pages (rate parameters, expense parameters) backed by one shared mechanism underneath; a single merged page is not required for this feature to deliver its value.
- This feature builds on feature 003 (performer bookings) and feature 005 (organizer report, expense parameters), both already implemented, and is a prerequisite for feature 008 (Band roster, spec drafted, not yet planned).
