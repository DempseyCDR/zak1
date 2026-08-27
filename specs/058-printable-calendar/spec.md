# Feature Specification: Printable calendar (P7-R15)

**Feature Branch**: `058-printable-calendar`

**Created**: 2026-08-26

**Status**: Draft

**Input**: P7-R15 — A **print-friendly schedule view**: upcoming events as a clean **table** + the **standing-schedule text**, with CSS print styles. The audit singles this out as "clearly a valued artifact for older members" — cheap to keep, bad to lose. Renders from the same public-schedule data (single-source, R10 prices done right).

## Clarifications

### Session 2026-08-26

- Q: What horizon should the printable calendar cover? → A: **Fit one page.** The sheet is a **single Letter (8.5×11″) page** — a **header**, as many upcoming events as fit, and a **footer** carrying the standing weekly schedule and prices. Upcoming events beyond what fits are **omitted from the sheet**, with a pointer to the full schedule online (not a time window or a fixed count — a one-page space cap).
- Q: What public route should the printable calendar live at? → A: **`/printable-calendar`** — a reserved public slug (so a CMS page can't shadow it), linked from the footer.
- Q: Should the events table show a price per row, or keep prices in the footer? → A: **Footer only.** Prices appear once in the footer (per series), per R15's "prices in the footer." No per-row price column.
- Q: What columns should the events table have? → A: **Date · Series (short code) · Band / Caller · Venue.** The **day of week** is dropped (the series implies it — TNC is Thursday, ECD is Sunday) and the **time** is dropped (it lives in the footer standing schedule). The series shows a **short code** (e.g. "TNC", "ECD"); the third column shows the event's confirmed performers as **"&lt;band&gt; w/&lt;caller&gt;"**.
- Q: Should the event description be shown, and how? → A: **Yes — as a full-width, indented italic sub-line under the row**, shown **only for events that have a description**. It is clamped to two lines. Because a described row is taller, the one-page fit becomes a **dynamic, weight-aware cap**: each row costs one line plus up to two for a description, and rows are taken until the page's line budget is used — so **fewer rows fit when more carry a blurb**.
- Q: Can a visitor choose the start date? → A: **Yes — via a `start` URL parameter** (e.g. `?start=2026-09-01`), so someone can print a sheet for a **future window** (e.g. post next month's schedule in advance). The window runs from that date; **absent or invalid → today**. A small on-screen date control sets the parameter; the control does not print.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A visitor prints (or saves) a clean upcoming-schedule sheet (Priority: P1)

A visitor — often an older member who likes a paper copy on the fridge or a bulletin board — opens the printable calendar page and prints it (or saves it as a PDF from the browser). What comes out is a **clean, legible sheet**: the upcoming dances as a simple table (date, series, band/caller, venue) with a **footer** carrying the club's **standing weekly schedule** and prices, with **no website navigation or chrome**, high-contrast black-on-white, and clean page fit.

**Why this priority**: This is the whole feature — a valued, low-cost artifact the current site provides and the audit says must not be lost. A member must be able to get a tidy printed schedule in a click or two.

**Independent Test**: Open the printable calendar page and print/preview it; confirm the printout shows the upcoming events as a table + the standing schedule, with no site header/footer/nav, no clipped or overflowing content, and clean page breaks.

**Acceptance Scenarios**:

1. **Given** upcoming events exist, **When** a visitor prints the page, **Then** the output shows a clean table of upcoming dances (date, series, band/caller, venue) and a footer with the standing weekly schedule and prices, with **no** site navigation, menus, or site chrome.
2. **Given** the printed sheet, **When** it is produced at Letter (8.5×11″), **Then** it is exactly **one page** — header, the events that fit, and the footer (standing schedule + prices) — with no content clipped, no horizontal overflow, and no spill onto a second page.
3. **Given** a cancelled event in the window, **When** the sheet prints, **Then** that event is clearly marked as cancelled.
4. **Given** no upcoming events, **When** the sheet prints, **Then** it still shows the standing weekly schedule and a clear "no dances currently scheduled" note.
5. **Given** a visitor wants next month's schedule, **When** they set a start date (via the on-screen control or a `?start=YYYY-MM-DD` URL), **Then** the sheet shows the events beginning on that date and the header reflects it; an absent or invalid start date shows from **today**.

---

### User Story 2 - The calendar is always current with zero maintenance (Priority: P1)

Because the printable calendar renders from the **same data** as the rest of the public site — the same upcoming events, the same single-sourced prices (R10), and the same standing-schedule text — nobody maintains a separate calendar. When an event is added, cancelled, re-timed, or re-priced, or a series' schedule sentence is edited, the printable calendar reflects it automatically on the next load.

**Why this priority**: The value of keeping this artifact is only realized if it stays correct without extra work. A hand-maintained second calendar would drift and defeat the purpose.

**Independent Test**: Change the live schedule or a price on the site (add/cancel an event, edit a series' schedule sentence or pricing); reload the printable calendar and confirm the change appears, with no separate data entry for the calendar.

**Acceptance Scenarios**:

1. **Given** an event is added or cancelled on the site, **When** the printable calendar is reloaded, **Then** it reflects the change with no calendar-specific edit.
2. **Given** a series' admission price or standing-schedule sentence changes, **When** the printable calendar is reloaded, **Then** the new price / sentence appears.
3. **Given** the printable calendar and the on-site listing, **When** compared for the same window, **Then** their events, prices, and standing-schedule text match (one source of truth).

---

### User Story 3 - A visitor reads and finds it on screen too (Priority: P2)

Before printing, a visitor can read the calendar on screen — it is legible on a phone (no horizontal scroll), uses accessible table semantics, and is reachable from the public site (e.g., a footer link) so people can find it.

**Why this priority**: The sheet is primarily for printing, but it should not be a dead-end or unreadable on screen; discoverability and on-screen legibility make it usable and findable. Lower priority than producing a correct printout.

**Independent Test**: Open the page on a 375px-wide screen and confirm the table is legible with no horizontal scroll; confirm the page is linked from the public site (e.g., the footer).

**Acceptance Scenarios**:

1. **Given** a phone-width screen, **When** a visitor opens the page, **Then** the table is legible and there is no horizontal scroll.
2. **Given** any public page, **When** a visitor looks for the printable calendar, **Then** there is a discoverable link to it (e.g., in the footer).

---

### Edge Cases

- **No upcoming events**: the table shows a clear "no dances currently scheduled" message; the standing weekly schedule and prices still render and print.
- **More events than fit**: the sheet stays **one page** — only the nearest-dated events that fit are shown, and a brief "…and more — see the full schedule online" pointer follows; later events are omitted from the print rather than spilling to page two.
- **Cancelled events** (feature 018): still listed within the window, clearly marked cancelled; only confirmed public events appear (the confirmed-bookings-only rule is retained).
- **Free vs priced events**: a free event reads "Free" (distinct from an unpriced/blank one), consistent with the site's single-sourced pricing.
- **A series with no standing-schedule sentence**: it is simply omitted from the standing-schedule section (no empty placeholder).
- **Event with / without a description**: an event that has a public description shows it as a full-width indented sub-line under its row (clamped to two lines); an event without one shows no sub-line and its row stays compact. Because a described row is taller, fewer events fit the one page (the cap adjusts).
- **Print vs screen**: on screen the page may carry a lightweight "Print" affordance and a link back to the site; on the printed output those, and all site chrome, are suppressed.
- **Very old browser / no print styles**: the page is still readable and printable as plain content (graceful degradation).
- **Invalid / absent start parameter**: a missing, malformed, or non-date `?start` value falls back to **today** — the page never errors on a bad parameter; the on-screen date control and the printed sheet both reflect the effective start actually used.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a dedicated public page that presents the **upcoming events** as a clean, readable **table** with columns **date, series (a short code, e.g. "TNC"/"ECD"), band/caller, and venue** — **no** day-of-week column (the series implies the day), **no** time column (the time is in the footer standing schedule), and **no** per-row price column (prices are in the footer per FR-002). The **band/caller** column shows the event's **confirmed** performers (018 confirmed-only) in the form **"&lt;band&gt; w/&lt;caller&gt;"** (band alone when there is no caller, the caller alone when there is no band, a dash when neither).
- **FR-002**: The page MUST include, in a **footer** area, the **standing weekly schedule** — the club's curated per-series schedule text — and each series' single-sourced **admission price** (prices live in the footer, per R15's "done right" — not repeated per row).
- **FR-003**: The page MUST carry **print styling** so that printing it (or saving it as a PDF via the browser) yields a clean **single-page** artifact: **no** site navigation, menus, or site footer/header chrome; high-contrast (black-on-white); and no content clipped or overflowing on **one Letter (8.5×11″) page** (see FR-010).
- **FR-004**: The page MUST be **single-sourced** — it renders from the same public schedule, pricing, and standing-schedule data as the rest of the public site, with **no** separate data entry, and reflects additions, cancellations, re-timings, and re-pricing automatically.
- **FR-005**: The page MUST retain the **cancelled marker** (feature 018) and show **only confirmed** public events (the confirmed-bookings-only public rule).
- **FR-006**: The page MUST be a **first-class public route at `/printable-calendar`** (a reserved slug so a CMS page cannot shadow it), reachable from the public site via a discoverable **footer** link.
- **FR-007**: The page MUST be **legible on screen** and mobile-first — no horizontal scroll on a phone — using accessible table semantics.
- **FR-008**: When there are **no upcoming events**, the page MUST show a clear "no dances currently scheduled" message and still render the standing weekly schedule and prices.
- **FR-009**: In the footer pricing, a series that is free MUST read **"Free"** (distinct from an unpriced/blank one), consistent with the site's single-sourced pricing; a series with no standing-schedule sentence MUST simply be omitted from the standing-schedule section.
- **FR-010**: The printed sheet MUST fit on a **single Letter (8.5×11″) page** — a **header** (title / club identity), the upcoming-events table sized to **as many events as fit**, and a **footer** carrying the standing weekly schedule and prices. It MUST NOT overflow to a second page. The number of events that fit is a **dynamic, weight-aware cap**: an event with a description occupies more vertical space than one without, so fewer events fit when more carry a description.
- **FR-013**: The events table MUST show each event's **public description** (blurb), when it has one, as a **full-width, indented sub-line beneath that event's row**, clamped to at most two lines; events without a description show no sub-line (their row stays compact).
- **FR-011**: When there are **more** upcoming events than fit on the one page, the extra events MUST be **omitted** from the sheet (nearest-dated shown first), and the page MUST show a brief pointer to the **full schedule online** so a reader knows more dances follow.
- **FR-012**: The page MUST accept an optional **start date** via a URL parameter (e.g. `?start=2026-09-01`); the events window begins on that date (so a visitor can print a **future** window — e.g. next month's schedule — in advance). An **absent or invalid** start date MUST fall back to **today** (no error). The header MUST reflect the effective start. A small **on-screen** date control MUST let a visitor set the start without hand-editing the URL; that control MUST NOT appear on the printed sheet.

### Key Entities *(include if feature involves data)*

- **No new entities.** The page is a presentation of existing data: the upcoming **events** (the public schedule projection — date, series, venue, start time, cancelled flag, single-sourced price) and each **series'** curated standing-schedule sentence and admission price. Nothing is stored for this feature.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A visitor can produce a clean printed (or saved-PDF) schedule in about two clicks (open the page → print), and the printed output contains **no** site navigation, menu, or footer chrome.
- **SC-002**: 100% of the printed calendar's events, prices, and standing-schedule text match the live public site for the same window (single source) — a change made on the site appears on the next load with **no** calendar-specific edit.
- **SC-003**: The printed output is **exactly one Letter (8.5×11″) page** — header, events-that-fit, and footer — with no clipped or horizontally-overflowing content and no spill to a second page.
- **SC-004**: Cancelled events are clearly marked on both the screen and the printout.
- **SC-005**: On a 375px-wide screen the page has **no** horizontal scroll and the table is legible.
- **SC-006**: When there are no upcoming events, the page still renders the standing weekly schedule, the prices, and a clear "no dances currently scheduled" note.
- **SC-007**: A valid `?start=YYYY-MM-DD` shows the window beginning on that date (verifiable for a future start — e.g. next month), and an absent, malformed, or non-date value shows from today with no error.

## Assumptions

- **Single-sourced from the existing public schedule** — the page reads the same upcoming-events data, single-sourced prices (R10), and per-series standing-schedule sentences the rest of the public site already uses; it introduces no new stored data.
- **Print happens in the browser** — printing / "save as PDF" is the browser's own (e.g., the print dialog); this feature provides **print CSS**, not server-side PDF generation or a file download.
- **A schedule table, not a month grid** — the artifact is a clean list/table of upcoming dances plus the standing weekly schedule, matching the current site's valued artifact; a month-grid calendar view is out of scope.
- **One Letter page** *(clarified 2026-08-26)* — the sheet is sized to a single 8.5×11″ page: a header, as many upcoming events as fit, and a footer (standing schedule + prices). Fitting is achieved by capping the number of event rows to what reliably fits alongside the header/footer; events beyond that are omitted with an online pointer (FR-011). US paper (Letter) is the target; other sizes are not a goal.
- **Public, no authentication** — the page is public and read-only, like the rest of the schedule.
- **Start via a forgiving `?start` parameter** *(clarified 2026-08-26)* — an optional `start=YYYY-MM-DD` URL parameter sets the window's beginning (default and fallback: today); a bad value degrades to today rather than erroring. A small screen-only date control (a plain GET form) sets it without hand-editing the URL and is suppressed in print. A future start supports printing an upcoming month in advance.
- **New reserved public route `/printable-calendar`** *(clarified 2026-08-26)* — a dedicated public route whose slug is reserved so a CMS page cannot shadow it (per the 051 reserved-slug discipline), linked from the footer.
- **Standing weekly schedule = per-series schedule sentences** — the curated schedule text is each series' existing schedule sentence; series without one are omitted.

## Dependencies

- P7-R4 (public schedule / `/whats-on` data) — the upcoming-events source this page renders.
- P7-R10 / feature 054 (single-source pricing + per-series standing-schedule sentence) — the prices and standing-schedule text.
- Feature 018 (event status) — the cancelled marker and confirmed-bookings-only public rule.
- P7-R1 tokens / P7-R2 nav / the public footer — the on-screen shell and the discoverable link.
- Feature 051 (content pages / reserved slugs) — reserving this page's route.

## Out of Scope

- **Server-side PDF generation** or a downloadable file — printing is the browser's job; this feature ships print CSS only.
- A **month-grid calendar** view (this is a schedule list/table).
- **iCal / `.ics` export or calendar subscription** feeds — a separate concern from a printable sheet.
- **Past events / history** — the printable calendar is forward-looking (upcoming); history stays on `/what-was-on`.
- Any **editing** — the page is read-only; the underlying schedule, prices, and standing-schedule text are edited where they already are.
