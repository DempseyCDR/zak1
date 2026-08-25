# Feature Specification: Single-source admission pricing & standing schedule (P7-R10)

**Feature Branch**: `054-single-source-pricing`
**Created**: 2026-08-24
**Status**: Draft
**Input**: P7-R10 — Admission prices and the standing weekly schedule become **data**, rendered wherever shown (event cards, event detail, series landings, home) from one source. Real pricing is structured: a sliding scale with labels (supporter $15 / dancer $12 / student $5), a family cap, per-special-event pricing, and "musicians free." The standing-schedule *sentence* stays curated text (no recurrence-rules engine in v1); it must carry the DST-dependent ECD start time.

## Clarifications

### Session 2026-08-24

- Q: How should admission pricing (sliding-scale tiers) be stored? → A: A **dedicated admission-pricing table** — series-scoped, effective-dated tiers (`series_id`, `label`, `amount_cents`, `sort_order`, `effective_date`) with its own audit, reusing the effective-dating pattern of `series_parameters` without overloading its closed `kind` enum.
- Q: How should a special event override the series pricing? → A: A **flat override** reusing `events.advertised_price_cents` (018) — the series tiers are the default; when an event carries that amount it shows the single special price instead. No per-event tier set in v1.
- Q: Where should the standing-schedule sentence live? → A: A **curated per-series field** (a schedule-sentence text column on the series), rendered on landing/home; carries the DST-dependent English start time as authored text.
- Q: Who may edit admission pricing? → A: **Reuse the existing rate/parameter-editing permission** (the same staff who set staff-pay rates and the till float); no new capability.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A visitor sees one consistent admission price everywhere (Priority: P1)

A prospective dancer checks the price of a Thursday contra on the home strip, the `/whats-on` card, the event detail page, and the contra landing page — and sees the **same** figures every time (e.g., supporter $15 / dancer $12 / student $5), because every surface reads the price from one source.

**Why this priority**: This is the whole point of R10 and the audit's sharpest finding — prices are hand-duplicated across FAQs, slides, event pages, and the calendar and **disagree**. Fixing the disagreement is the core deliverable.

**Independent Test**: Configure a series' admission pricing once; load the home strip, a `/whats-on` card, that event's detail page, and the series landing page, and confirm every surface shows the identical price information with no hand-entered literal anywhere.

**Acceptance Scenarios**:

1. **Given** a series with a configured sliding scale, **When** a visitor views any surface that shows its price (card, detail, landing, home), **Then** the same tier labels and amounts are shown, sourced from the single pricing record.
2. **Given** the series pricing is changed in one place, **When** a visitor reloads any of those surfaces, **Then** every surface reflects the new price — no surface is left stale with an old hand-typed figure.
3. **Given** a compact surface (a card), **When** it renders a sliding scale, **Then** it shows a concise summary (e.g., a range or short tier list) that still agrees with the full tiers shown on the detail page.

### User Story 2 - Staff set a series' admission pricing once, effective-dated (Priority: P1)

A staff member with pricing permission sets or updates a series' admission tiers in one place; the change takes effect from a chosen date and is preserved as history, so past events keep the price that applied then and future events show the new price.

**Why this priority**: Single-sourcing is only real if there is exactly one place to edit, and pricing genuinely changes over time (the machinery already effective-dates staff rates). Without this, staff would still edit prices per surface.

**Independent Test**: Set a series' pricing effective a past date, then change it effective a future date; confirm an event before the change shows the old price and an event on/after the change shows the new price, and that the edit is audited.

**Acceptance Scenarios**:

1. **Given** a staff editor with pricing permission, **When** they set a series' admission tiers effective a date, **Then** those tiers become the source for every event of that series on/after that date.
2. **Given** a later effective-dated price change, **When** events fall before vs on/after the new effective date, **Then** each event resolves the tiers that applied on its own date.
3. **Given** a non-pricing volunteer, **When** they attempt to edit admission pricing, **Then** the action is refused.
4. **Given** any pricing change, **When** it is saved, **Then** an audit record of the change is written.

### User Story 3 - A special event carries its own pricing (Priority: P2)

A one-off special (e.g., a dance weekend or a guest-band night) has admission pricing that differs from the series default; staff give that event its own pricing, which overrides the series pricing on every surface for that event only.

**Why this priority**: The audit calls out per-special-event pricing explicitly; without an override, specials would force staff back into per-surface hand-editing. It builds on the US1/US2 single source.

**Independent Test**: Give one event an override price; confirm that event shows the override everywhere while its sibling events in the same series still show the series default.

**Acceptance Scenarios**:

1. **Given** an event with an override price, **When** any surface shows that event's price, **Then** it shows the override, not the series default.
2. **Given** an event with no override, **When** any surface shows its price, **Then** it shows the series default resolved for that event's date.
3. **Given** an override is removed, **When** the event is shown again, **Then** it falls back to the series default.

### User Story 4 - A visitor reads the standing schedule sentence (Priority: P2)

A visitor sees a short, curated standing-schedule sentence for a series ("Every Thursday, 7:30–10:30; lesson at 7:00") on the series landing and/or home, including the DST-dependent English start time carried in the sentence — without the site running any recurrence-rules engine.

**Why this priority**: The audit notes the schedule is prose scattered across the site; a single curated sentence removes duplication cheaply. It is lower priority than pricing and deliberately not a rules engine.

**Independent Test**: Configure a series' schedule sentence once; confirm it renders on the series landing (and home if shown) and reads exactly as authored, including the DST note for English.

**Acceptance Scenarios**:

1. **Given** a series with a curated schedule sentence, **When** a visitor views its landing page, **Then** the sentence is shown as authored.
2. **Given** the English series whose start time shifts with DST, **When** the sentence is authored to state that, **Then** the DST-dependent time is conveyed in the sentence (the system does not compute recurrence).

### Edge Cases

- A series with **no admission pricing configured**: surfaces show no price (as today, `null` = not shown) rather than a wrong or zero figure.
- A **"musicians free"** rule and a **family cap**: represented within the pricing (e.g., a `$0` tier or a labeled cap tier / note) so they render from the single source, not as a separate hand-typed aside.
- An event whose date is **before any effective-dated pricing** exists: no price shown for it (no retroactive invention).
- A **special event override** set to a single flat price vs a full tier set: both render coherently; a card still shows a concise summary.
- Removing all tiers for a series: reverts surfaces to "no price shown," never a blank `$` or `$0`.
- The **printable calendar** (not yet built) is out of scope as a surface, but pricing must be exposed in a form a future calendar can consume from the same single source.
- Two surfaces rendering the same event must **never disagree** — if they do, that is a defect (the single-source invariant).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST model admission pricing as data: a series-scoped, effective-dated set of labeled tiers (a label and an amount per tier, e.g., supporter/dancer/student), supporting a sliding scale of one or more tiers.
- **FR-002**: The system MUST resolve the admission pricing that applies to a given event from its series and its date (the most recent pricing effective on/before the event's date), preserving historical pricing for past events.
- **FR-003**: The system MUST allow a per-event pricing **override** for special events; when present it supersedes the series pricing for that event only, and its removal reverts the event to the series default.
- **FR-004**: The system MUST render admission pricing on every public surface that shows a price — event cards, event detail, series landing pages, and the home strip — from this single source, with no hand-entered price literals remaining on those surfaces.
- **FR-005**: On compact surfaces (cards), the system MUST render a concise price summary that is consistent with the full tiers shown on the detail page.
- **FR-006**: When a series (and event) has no configured pricing, the system MUST show no price (not `$0`, not a blank amount) — matching today's "price is optional / not shown" behavior.
- **FR-007**: The system MUST restrict admission-pricing edits to staff holding the appropriate pricing/parameter-editing permission; unauthorized actors MUST be refused.
- **FR-008**: The system MUST record an audit entry for each admission-pricing change (consistent with how staff-rate parameters are already audited).
- **FR-009**: The system MUST represent special pricing facts — a **family cap** and **"musicians free"** — within the pricing data so they render from the single source rather than as separate hand-maintained text.
- **FR-010**: The system MUST provide a curated **standing-schedule sentence** per series, rendered where the schedule is shown (series landing, and home if applicable), authored as text (no recurrence-rules engine in v1), able to convey the DST-dependent English start time.
- **FR-011**: The system MUST remove the existing hand-duplicated price/schedule literals from the surfaces it now single-sources (e.g., the community landing's hard-coded cost line and the per-event advertised-price figure where it duplicates series pricing).

### Key Entities *(include if feature involves data)*

- **Admission pricing (series-scoped, effective-dated)**: the set of labeled tiers that apply to a series from an effective date. Attributes: the series it belongs to, an effective date, and one or more tiers. Relationship: resolved per event by date (like the existing effective-dated staff-rate parameters). Preserves history.
- **Admission tier**: one line of a sliding scale — a label (e.g., "Supporter", "Dancer", "Student", "Family cap", "Musicians") and an amount (may be `$0` for free), with an order for display.
- **Per-event pricing override**: an optional pricing attached to a single event that supersedes the series pricing for that event (for specials). Absent → the event uses the series default.
- **Standing-schedule sentence**: a curated per-series text describing when the series meets (day, times, lesson time, DST note), rendered where the schedule is shown. Not machine-parsed.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For any configured series, 100% of the public surfaces that show its price (card, detail, landing, home) display identical price information for the same event — zero disagreements across surfaces.
- **SC-002**: Changing a series' admission pricing in one place updates every surface with no additional edits; the number of places a price must be typed by hand drops to **one**.
- **SC-003**: A price change effective a given date resolves correctly for events before vs on/after that date in 100% of cases (historical pricing preserved).
- **SC-004**: A special event's override price appears on every surface for that event and on no sibling event.
- **SC-005**: A series with no configured pricing shows no price anywhere (never `$0` or a blank amount).
- **SC-006**: Every admission-pricing edit is attributable via an audit record; unauthorized edit attempts are refused.

## Assumptions

- **Pricing is a dedicated admission-tiers structure, reusing the effective-dated + audited pattern of `series_parameters`** *(clarified 2026-08-24)*: a **dedicated admission-pricing table** — series-scoped, effective-dated tiers (`series_id`, `label`, `amount_cents`, `sort_order`, `effective_date`) with its own audit — rather than overloading `series_parameters` (its closed `kind` enum does not fit variable club-labeled sliding-scale tiers). It mirrors the resolver pattern (`resolveParameterCents`) so an event resolves the tiers effective on/before its date.
- **Per-event override is a flat price reusing 018's `events.advertised_price_cents`** *(clarified 2026-08-24)*: the series tiers are the default; when an event carries an `advertised_price_cents` amount it shows that single special price instead. No per-event tier set in v1.
- **Card summary is derived, not stored**: the concise card price (e.g., a range "$5–$15" or a short tier list) is computed from the tiers, so it can never disagree with the detail page.
- **Family cap and "musicians free" are modeled as tiers within the pricing**, not separate fields — a `$0` "Musicians" tier and a labeled "Family cap" tier keep them single-sourced.
- **The standing-schedule sentence is a curated per-series text field, not a rules engine** *(clarified 2026-08-24)*: a schedule-sentence column on the series, rendered on landing/home; v1 does not compute recurrence and the DST-dependent English time is authored into the sentence. The event rows themselves are still generated by the existing 013 recurrence generator (unchanged).
- **Pricing edits reuse the existing rate/parameter-editing permission** *(clarified 2026-08-24)* — the same actors who set staff rates and the till float; no new capability.
- **Rendering targets are the surfaces that exist today** — event cards (R4/048), event detail (R5/049), series landings (R6/050), and the home strip (R3). The **printable calendar** named in the R10 source does not exist yet; it is a future consumer of the same single source, not a surface built here.
- Amounts are whole-cent integers rendered as dollars (matching existing money handling); currency is USD.

## Dependencies

- Feature 018 (B27) — the current per-event `advertised_price_cents` (display-only) that this feature single-sources / repurposes as the override.
- Feature 019 US5 / parameters — `series_parameters` effective-dating + audit + `resolveParameterCents(OrNull)` resolver pattern to mirror.
- Features 048/049/050/047 (R4/R5/R6/R3) — the card, event-detail, series-landing, and home surfaces that must read from the single source.
- Feature 051 (content CMS) — related public-content surface; not used for the schedule sentence (a per-series field was chosen 2026-08-24).

## Out of Scope

- A **recurrence-rules engine** (parsing "first 4 Sundays, skip 2nd & 4th Jul–Aug", holiday skips). Event generation stays with the existing 013 recurrence generator; the schedule *sentence* is curated text.
- A **printable calendar** page/render (does not exist yet); R10 only ensures pricing is available from one source for a future calendar to consume.
- Automatic **DST computation** of start times (the sentence carries the DST note; the system does not calculate it).
- Changing how **staff pay rates / expenses / door float** are modeled (those remain the existing `series_parameters` categories); this feature adds admission pricing alongside them.
- Photo galleries (P7-R11) and the org/membership cluster (P7-R12).
