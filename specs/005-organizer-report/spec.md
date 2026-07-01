# Feature Specification: Organizer Report & Analytics

**Feature Branch**: `005-organizer-report`

**Created**: 2026-06-18

**Status**: Draft

**Input**: Derived from CDR_Project_Context_v1.2.md — Dance Net Formula, Organizer Report structure, per-dance rows, quarterly summary, 52-week trend charts.

## Clarifications

### Session 2026-07-01

- Q: Does the organizer's Dance Net include Merchandise (vs. "admission only")? → A: Yes — Dance Net = admission (gross gate) + merchandise − rent − performer total − ongoing expense − misc expenses. The "dance income = admissions only" rule applies to treasurer/QBO receipt classification, not the organizer Dance Net.
- Q: Where does the "paying dancers" count come from? → A: Derived from attendance: paying_dancers = event attendance count − distinct booked performers − 1 (the door attendant), floored at 0. Convention: the door attendant checks in themselves and the performers, so they're in the attendance count.
- Q: How is the per-event dancer count preserved past the 90-day attendance purge? → A: Persist a per-event attendance count (a non-identifiable integer) snapshotted at event close, so the contact-tracing purge (feature 002) doesn't blank Dancers/Avg Ticket/Break-Even for older events.
- Q: How is Rent captured for Dance Net? → A: A per-series effective-dated rent rate parameter, auto-selected by event date (parallels Ongoing Expense); a venue stand-in until the deferred venue model lands.
- Q: How are Misc Expenses captured? → A: Itemized per-event ad-hoc misc-expense entries (description + amount), plus the door card fee (`pos_fee_cents`) folded in automatically.
- Correction: Avg Ticket = Gross Gate (admission) ÷ paying dancers — door card fees are NOT subtracted (no "Net Gate" concept).
- Q: When do the rolling trend charts appear? → A: When there are 12 to 53 weeks of data (12 ≤ weeks ≤ 53) — a rolling window capped at 53 weeks, shown only once ≥12 weeks exist.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See per-dance financial results (Priority: P1)

An organizer views a report with one row per dance showing the financial breakdown culminating in Dance Net, so they can judge how each event performed.

**Why this priority**: The per-dance Dance Net view is the organizer's primary decision tool and the direct replacement for the existing spreadsheets.

**Independent Test**: For a series with several completed events, render the per-dance rows and confirm each column and the Dance Net total compute correctly with positive/negative color coding.

**Acceptance Scenarios**:

1. **Given** completed dances, **When** the report renders, **Then** each row shows date, series, caller, band, dancers, gross gate, merchandise, rent, performer total, ongoing expense, misc expenses, and Dance Net.
2. **Given** a row, **When** Dance Net is computed, **Then** it equals Gross Gate + Merchandise − Rent − Performer Total − Ongoing Expense − Misc Expenses.
3. **Given** a positive Dance Net, **When** displayed, **Then** it is shown in black; a negative Dance Net is shown in red.
4. **Given** a negative Dance Net, **When** displayed, **Then** the Break-Even Dancers figure is shown (and only then).
5. **Given** a performer total, **When** the organizer drills in, **Then** a modal shows the per-performer breakdown.

---

### User Story 2 - Review quarterly summaries (Priority: P2)

An organizer reviews per-series quarterly summaries (Q1–Q4 plus YTD and Last Year) with averaged metrics, replacing the old rolling 4-week/12-week views.

**Why this priority**: Quarterly trends inform programming and budgeting decisions across the season.

**Independent Test**: Across events spanning quarters, confirm each quarter's count and averaged metrics compute correctly and YTD and Last Year columns appear.

**Acceptance Scenarios**:

1. **Given** events across the year, **When** the summary renders, **Then** it shows Q1–Q4, YTD, and Last Year columns.
2. **Given** a quarter, **When** averages are computed, **Then** count and average dancers/gross/merchandise/rent/performer total/ongoing/misc/Dance Net/ticket are shown.
3. **Given** FYI categories, **When** the quarter is summarized, **Then** donations, memberships, future event, gift cards, and misc sales totals are shown.

---

### User Story 3 - Explore rolling trends (Priority: P2)

An organizer views rolling trend charts for Dance Net and attendance, with smoothed trend lines and interactive detail on hover/tap.

**Why this priority**: Visual trends surface seasonality and decline/growth that tabular rows obscure.

**Independent Test**: Render the charts for a series with between 12 and 53 weeks of data and confirm both panels, the 4-event smoothing, color coding, and hover detail behave as specified; confirm the charts are hidden below 12 weeks.

**Acceptance Scenarios**:

1. **Given** at least 12 weeks of events (rolling window capped at 53), **When** the charts render, **Then** two panels appear: Dance Net (top) and attendance (bottom); with fewer than 12 weeks, the charts are hidden.
2. **Given** each panel, **When** rendered, **Then** it shows individual event points plus a 4-event rolling-average trend line.
3. **Given** a Dance Net point, **When** displayed, **Then** positive points are black markers and negative points are red.
4. **Given** a data point, **When** hovered or tapped, **Then** it shows date, Dance Net, dancers, caller, and band.

### Edge Cases

- The TNC report includes both TNC rows and the same-evening Community Dance rows (each with their own summary and charts); ECD is a separate report.
- Donations and other FYI categories are shown but excluded from Dance Net.
- Avg Ticket = Gross Gate (admission) ÷ paying dancers; door card fees are not subtracted.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST produce separate Organizer Reports for TNC and ECD; the TNC report MUST include Community Dance sections.
- **FR-002**: System MUST show per-dance rows with the full column set defined in the source document.
- **FR-003**: System MUST compute Dance Net = Gross Gate (admission) + Merchandise − Rent − Performer Total − Ongoing Expense − Misc Expenses. "Gross Gate" is the renamed `admission` category (feature 002); Merchandise is included in Dance Net.
- **FR-004**: System MUST display Dance Net in black when positive and red when negative.
- **FR-005**: System MUST show Break-Even Dancers only when Dance Net is negative.
- **FR-006**: System MUST compute Avg Ticket as Gross Gate (admission) ÷ paying dancers. Door card fees are NOT subtracted (no "Net Gate").
- **FR-007**: System MUST provide a per-performer drill-down of the combined Performer Total, showing each performer's name, type, and amount (reuses feature 003's booking name/type/amount).
- **FR-008**: System MUST treat Ongoing Expense as a per-series parameter with effective-date history (e.g., TNC "Equipment Depreciation" $10; ECD none).
- **FR-015**: System MUST treat Rent as a per-series effective-dated rate parameter auto-selected by event date (a venue stand-in until the deferred venue model lands); it parallels the Ongoing Expense parameter mechanism.
- **FR-016**: System MUST compute Misc Expenses per event as the sum of itemized ad-hoc misc-expense entries (description + amount) plus the door card fee (`pos_fee_cents`), which is folded in automatically.
- **FR-009**: System MUST show FYI categories (donations, memberships, future event, gift cards, misc sales) as informational columns excluded from Dance Net.
- **FR-010**: System MUST produce quarterly summaries with Q1–Q4, YTD, and Last Year, including the averaged metrics and FYI quarter totals.
- **FR-011**: System MUST render rolling trend charts once at least 12 weeks of data exist, using a rolling window capped at 53 weeks (12 ≤ weeks ≤ 53); two panels (Dance Net, attendance), each showing event points and a 4-event rolling-average trend line. Below 12 weeks, the charts are not shown.
- **FR-012**: System MUST color Dance Net markers black (positive) / red (negative) and show date, Dance Net, dancers, caller, and band on hover/tap.
- **FR-013**: System MUST derive paying dancers per event as `event attendance count − distinct booked performers − 1 (door attendant)`, floored at 0, and use it for the Dancers column, Avg Ticket, and Break-Even.
- **FR-014**: System MUST persist a per-event attendance count (non-identifiable integer, snapshotted at event close) so the organizer report's per-event dancer counts survive feature 002's 90-day contact-tracing purge.

### Key Entities *(include if feature involves data)*

- **Dance Result**: A per-event computed record (inputs from door record, bookings, rent/ongoing parameters, misc expenses, and the persisted per-event attendance count) yielding Dance Net, paying dancers, Avg Ticket, and Break-Even.
- **Quarterly Summary**: Aggregated averages and FYI totals per series per quarter.
- **Ongoing Expense Parameter**: Per-series expense with effective-date history.
- **Rent Parameter**: Per-series rent with effective-date history (venue stand-in), auto-selected by event date.
- **Misc Expense**: A per-event ad-hoc expense entry (description + amount); the door card fee is added automatically.
- **Per-event attendance count**: A persisted non-identifiable integer (snapshot at close) that survives the 90-day attendance purge, used to derive paying dancers.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every per-dance row's Dance Net matches a manual recomputation in 100% of test events.
- **SC-002**: Quarterly averages match manual aggregation of their constituent events in 100% of cases.
- **SC-003**: Rolling trend charts (up to a 53-week window) render for a full-year series in under 2 seconds.
- **SC-004**: Color coding and Break-Even visibility follow the positive/negative rules in 100% of rows.
- **SC-005**: The report fully replaces the prior spreadsheets' rolling 4-week/12-week views with quarterly equivalents.

## Assumptions

- Fiscal quarters are calendar quarters in Phase 1 (configurable fiscal quarters deferred).
- This feature consumes outputs of the Door Attendance and Performers features; it does not capture raw data itself.
- Charting/visualization technology is an implementation choice; requirements describe behavior and content only.
- **Comps deferred (future phase)**: the door attendant will later record attendees admitted for free ("comps"), which will then be subtracted from paying dancers (paying_dancers = attendance − performers − door attendant − comps). In Phase 1 comps are not distinguished and count as paying dancers. See [BACKLOG.md](../BACKLOG.md) B14.
