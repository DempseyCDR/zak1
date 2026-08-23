# Feature Specification: `/whats-on` mobile-first event cards (P7-R4)

**Feature Branch**: `048-whats-on-cards`

**Created**: 2026-08-22

**Status**: Draft

**Input**: User description: "P7-R4 — restyle the public dance listings from text rows into tappable cards (date prominent, time, series color, venue short name, price; whole card links to detail), mobile-first on the P7-R1 tokens; add the venue-short-name + series/type projection fields and a series→color mapping; keep the ?series filter, cancelled marker, and confirmed-only bookings."

## Overview

The public dance listings (`/whats-on` upcoming, `/what-was-on` history, and the P7-R3 home "Coming up"
strip) render as plain text rows today. This feature restyles the shared dance list into **tappable
cards** — the date shown prominently, plus start time, the series **color-coded** with the P7-R1 tokens,
the venue short name, and the advertised price — where the **whole card** links to the event's detail.
The point is the dominant public question, "is there a dance tonight/soon, and where?", answered **above
the fold on a phone**. The listing logic, the `?series=` filter, the cancelled marker, and the
confirmed-bookings-only rule all stay; this is a presentation change **plus** the couple of fields the
public projection must now carry (the venue short name and the series/event-type used for color).

## Clarifications

### Session 2026-08-22

- Q: Does the card show the performer lineup (booked band/caller), or stay lean? → A: **Keep the card lean** — no lineup on the card; the booked band/caller shows on the event **detail** page (P7-R5). The card stays scan-and-tap (date/time/series/venue/price), and the list projection is not extended with lineup.
- Q: The series→R1-color mapping, and is color per-series or grouped? → A: **Per-series map** (a code constant keyed by series key): `tnc`→contra, `ecd`→english, `community_dance`→special, `general`→assembly; the `meeting` color is reserved for future meeting events; any unmapped/future series → a **neutral default** token. This resolves both the mapping and the per-series-vs-grouped decision (it is **per-series**).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A phone visitor scans the next dances as cards (Priority: P1)

A visitor opens `/whats-on` on their phone and immediately sees the upcoming dances as clean cards: the
date stands out, with time, venue, and price at a glance. Tapping anywhere on a card opens that dance's
detail. "Is there a dance soon, and where?" is answered without scrolling.

**Why this priority**: This is use case #1 and the most-used public feature; the data is already right,
only the presentation is wrong.

**Independent Test**: Load `/whats-on` at 375px and confirm each event renders as a card with a prominent
date + time + venue + price, tapping anywhere on a card opens its detail, and the next dance is visible
above the fold with no horizontal scroll.

**Acceptance Scenarios**:

1. **Given** upcoming dances, **When** `/whats-on` loads, **Then** each is a card showing a prominent date, start time, venue short name, and price (when present).
2. **Given** a card, **When** the visitor taps anywhere on it, **Then** the event's detail page opens.
3. **Given** a phone (~375px), **When** the page loads, **Then** the next dance is visible above the fold and there is no horizontal scroll.
4. **Given** a cancelled event, **When** listed, **Then** the card shows a clear cancelled marker.

---

### User Story 2 - Series color-coding at a glance (Priority: P1)

Each card is visually coded by its series (using the P7-R1 event-type colors) so a visitor can tell a
contra night from an English country dance at a glance, on the listing and consistently everywhere the
list appears.

**Why this priority**: The color coding is part of the club's identity and the fastest way to scan "what
kind of dance is this"; R1 defined the palette specifically for R4 to consume.

**Independent Test**: Confirm each card carries its series' color; the same series is the same color on
`/whats-on`, `/what-was-on`, and the home strip; and the color is used as an accent (meeting the AA rule),
not as a background behind normal text.

**Acceptance Scenarios**:

1. **Given** events of different series, **When** the cards render, **Then** each is color-coded by its series using the R1 palette.
2. **Given** a series color used on two listings, **When** compared, **Then** it is the same color (single source, no divergence).
3. **Given** the color is applied, **When** rendered, **Then** it is an accent (border/marker/label), and all text still meets WCAG AA.

---

### User Story 3 - One consistent card everywhere the list appears (Priority: P2)

The upcoming listing, the history listing, and the home "Coming up" strip all use the same card, so the
public site feels coherent and there is one thing to maintain.

**Why this priority**: The shared component means the restyle lands everywhere at once; consistency is
valuable but secondary to the card itself working.

**Independent Test**: Confirm `/whats-on`, `/what-was-on`, and the home strip render the identical card
presentation.

**Acceptance Scenarios**:

1. **Given** the shared dance list, **When** rendered on `/whats-on`, `/what-was-on`, and the home, **Then** all three show the same card.

### Edge Cases

- **No events**: the listing shows a clear empty-state message (retained), not a blank area.
- **Missing venue short name**: the card falls back to the venue's full name (or omits the venue line) — it never shows a blank/broken venue.
- **No price advertised**: the card omits the price line rather than showing a placeholder.
- **A series with no obvious color mapping**: it renders in a neutral/default token, never unstyled or broken (the specific mapping is a clarification item).
- **Long venue/activity names**: wrap or truncate gracefully at 375px, no horizontal scroll.
- **Cancelled event**: still listed, with a clear cancelled marker (018 / B25).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `/whats-on` and `/what-was-on` MUST render each event as a **tappable card** (not a text row); the **whole card** links to that event's detail page.
- **FR-002**: Each card MUST show the **date prominently**, the **start time**, the **venue short name**, and the **advertised price** when one is present.
- **FR-003**: Each card MUST be **color-coded by its series/event type** using the P7-R1 event-type color tokens, applied as an **accent** (not behind normal-size text) so WCAG AA holds.
- **FR-004**: A **cancelled** event MUST still be listed with a clear cancelled marker (018 / B25 retained).
- **FR-005**: The cards MUST be **mobile-first**: legible at ~375px with **no horizontal scroll**, tap targets ≥44px, and the whole card tappable.
- **FR-006**: The card presentation MUST be used **wherever the shared dance list renders** — `/whats-on`, `/what-was-on`, and the home "Coming up" strip — with no per-page divergence.
- **FR-007**: The public schedule projection MUST carry the fields the card needs that it does not today — the **venue short name** and the **series/event-type** (for color). The existing **`?series=` filter** and the **confirmed-bookings-only** public rule MUST be unchanged.
- **FR-008**: The empty state (no events) MUST show a clear message (retained).
- **FR-009**: Each listing page MUST keep **exactly one H1** and honest heading order; WCAG AA contrast holds; the series filter still narrows the list.

### Key Entities

- **Public schedule item** (the per-event projection behind the listings): today carries date, activity,
  full venue name, label, start time, cancelled flag, and advertised price. This feature **adds** the
  **venue short name** and the **series/event-type** used for color. The series→color mapping (which of the
  five R1 type colors each series gets) is a clarification item.
- **Series → event-type color mapping** (a per-series code constant keyed by series key): `tnc`→contra,
  `ecd`→english, `community_dance`→special, `general`→assembly; `meeting` reserved for future meeting
  events; any unmapped/future series → a neutral default token.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On `/whats-on` at 375px, the next dance's date/time/venue/price is visible **above the fold** without horizontal scroll.
- **SC-002**: Every event renders as a card whose **entire surface** opens the event detail when tapped.
- **SC-003**: Every card is color-coded by its series, and the same series is the same color across `/whats-on`, `/what-was-on`, and the home strip.
- **SC-004**: The **venue short name** and the **price** (when present) appear on the card; missing price/short-name degrade gracefully.
- **SC-005**: A cancelled event is clearly marked; an empty listing shows a message.
- **SC-006**: 375px: no horizontal scroll, tap targets ≥44px, WCAG AA contrast, one H1; the `?series=` filter still narrows the list.
- **SC-007**: `/whats-on`, `/what-was-on`, and the home strip render the identical card (no divergence).

## Assumptions

- **Built on P7-R1 tokens (045) and P7-R2 nav (046)** — both merged to `main`; this feature branches off
  `main` and consumes the token palette + the event-type color map.
- **Reuses the existing listing logic** — `listPublicEvents` / the public schedule read and the shared
  `ScheduleList` / `SeriesFilter` — unchanged except for the added projection fields; this is a
  presentation change plus a **small data-projection addition** (venue short name + series/type). Unlike
  P7-R1–R3, R4 touches the public schedule domain.
- **Pricing stays as the existing `advertisedPrice`** — single-source pricing is **P7-R10** (out of
  scope); the card just displays the price the projection already carries.
- **Event detail enrichment is P7-R5** (out of scope); the card links to today's detail page.
- **The three decisions are settled** (see Clarifications): (1) the card stays **lean** — lineup on the
  detail page (R5), not the card; (2) a **per-series color map** — `tnc`→contra, `ecd`→english,
  `community_dance`→special, `general`→assembly, `meeting` reserved, unmapped→neutral default; (3) color is
  applied **per-series** (the map is the mechanism), not by a coarser grouping.

## Dependencies

- The P7-R1 tokens/color map (045), the P7-R2 nav (046), and the P7-R3 home (047) — all merged. The shared
  `ScheduleList` / `SeriesFilter` and the public schedule read (feature 037), the confirmed-only + cancelled
  rules (018), and `venues.short_name` (feature 020) for the card's venue field.
