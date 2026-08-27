# Tasks: Printable calendar (P7-R15)

**Feature dir**: `specs/058-printable-calendar/` · **Branch**: `058-printable-calendar` (off `main`)
**Input**: plan.md, research.md, data-model.md, contracts/printable-calendar.md, quickstart.md, spec.md

**Constitution**: Test-First (NON-NEGOTIABLE) — the test task in each area precedes its implementation task.
**Render-only** — no migration, schema, capability, or audit. ⚠️ Reuses `getPublicSchedule`,
`resolveEventPricing`/`pricingSummary`, and each series' `scheduleSentence`. **One input boundary**: the `?start`
query param is Zod-validated (`isoDate`), and a missing/invalid value **falls back to today** (never errors).
**One Letter page** via a **dynamic, weight-aware cap** — pure `fitRows(items, budget, cost)` over a
`PAGE_LINE_BUDGET`, where an event costs 1 line + 0–2 for its description, so fewer fit when more carry a blurb
(a `truncated` flag drives the "more online" pointer). The table is **Date · Series (short code) · Band/Caller ·
Venue**, with each event's **description** on a full-width indented sub-line when present. **Print only the
calendar region** — the page wraps its content in `[data-printable-calendar]`; the screen-only start `<form>`
and site chrome sit outside it, so they never print. Retains the cancelled marker and confirmed-only rule (018).
*(The `MAX_ROWS`/`capRows` and column details in the sub-tasks below were superseded during implementation by
the band/caller column, the description sub-line, and this dynamic cap — the file paths and structure stand.)*

## Phase 1: Setup

- [x] T001 [P] Add `"printable-calendar"` to `RESERVED_SLUGS` (public group) in `src/server/validation/content.ts`
  so a CMS page cannot shadow the route.

## Phase 2: Foundational (domain view model + pure helpers — blocks the page)

- [x] T002 [P] Unit test `tests/unit/printableCalendar.test.ts`: `capRows` — fewer/equal/more than `max`
  (first `max` + `truncated` flag) and empty; `formatCalendarDate` — a known `YYYY-MM-DD` → expected weekday +
  display date (UTC-parsed, no off-by-one); `resolveStart` — a valid `YYYY-MM-DD` passes through, and `undefined`
  / `""` / `"nope"` / `"2026-13-40"` / `"2026/09/01"` all → **today** (no throw). (Test-first — fails until T004.)
- [x] T003 [P] Integration test `tests/integration/printableCalendar.test.ts` (real Postgres): seed events +
  series; `getPrintableCalendar(db, today)` returns rows nearest-first, mapped (venue short-name fallback,
  `cancelled` preserved) and echoes `startISO`; a **future `startISO`** excludes earlier events (proves `?start`
  advance-planning); with more than `MAX_ROWS` in-window, `rows.length === MAX_ROWS` and `truncated === true`;
  `seriesSchedules` includes **only** series with a `scheduleSentence`, each with its price ("Free" for a
  configured-free series); an empty window → `rows=[]`, `truncated=false`, footer still populated. (Test-first —
  fails until T004.)
- [x] T004 Implement `src/server/domain/public/printableCalendar.ts`: `MAX_ROWS` (start ~20, tuned in T012);
  types `PrintableRow` / `SeriesSchedule` / `PrintableCalendar` (with `startISO`); pure `capRows`,
  `formatCalendarDate`, `resolveStart` (validate `YYYY-MM-DD` with a **local** date check — a `^\d{4}-\d{2}-\d{2}$`
  regex + real-date guard via `safeParse`, matching the pattern in 054/057; there is **no** shared `isoDate`
  export — define it here; `safeParse` failure/absence → today); `getPrintableCalendar(db, startISO)`
  = `getPublicSchedule(db, startISO)` → `capRows` → `PrintableRow[]` (series short code; each event's confirmed
  **band** and **caller** via `bookings`⋈`bands` / `bookings`⋈`performers`, rendered `<band> w/<caller>`), plus
  the per-series footer (each series row with a `scheduleSentence`, resolved via `resolveEventPricing` →
  `pricingSummary`).

## Phase 3: User Story 1 — A visitor prints a clean one-page sheet (Priority: P1)

**Goal**: `/printable-calendar` renders a header + a clean upcoming-events table + a footer (standing schedule +
prices); prints to **one Letter page** with no site chrome; a `?start` (or the on-screen date control) sets the
window; overflow is omitted with a "see the full schedule online" pointer.
**Independent test**: open `/printable-calendar` → table + footer show; print-preview at Letter → one page, no
nav/footer chrome; set `?start=<future>` → the window shifts and the header reflects it; a bad `?start` → today.

- [x] T005 [P] [US1] Component test `tests/component/printableCalendar.test.tsx` (jsdom): given a
  `PrintableCalendar`, the page renders a `<table>` with `<th scope="col">` headers (Date, Series, Band / Caller,
  Venue) and a row per event showing the series short code + "band w/caller" (cancelled ones marked); the header shows
  the effective start; a **screen-only GET date form** with `<input name="start">` defaulted to `startISO` is
  present; the footer lists each series'
  sentence + price; `truncated` → the "see the full schedule online" pointer renders (else not); empty `rows` →
  the "no dances currently scheduled" note; no personal data. (Test-first — fails until T007.)
- [x] T006 [P] [US1] Create `src/app/(public)/printable-calendar/PrintableCalendar.module.css`: **screen** styles
  (mobile-first, no horizontal scroll at 375px, legible table) and an **`@media print`** block — the
  print-only-region technique (hide everything, reveal `[data-printable-calendar]` + descendants, pin to top),
  `@page { size: letter; margin }`, black-on-white. **Bound each event row to at most two lines** (clamp/truncate
  long cells, e.g. venue/series, with `overflow: hidden` + a 2-line max) so row height is **predictable** — this
  is what makes a fixed `MAX_ROWS` reliably fit one page (FR-010) even with long names; tune `MAX_ROWS` in T012
  against the 2-line worst case.
- [x] T007 [US1] Create `src/app/(public)/printable-calendar/page.tsx` (async server component): read
  `searchParams.start` → `resolveStart(...)` → `getPrintableCalendar(db, startISO)`. Render a **screen-only**
  `<form method="get">` with `<input type="date" name="start" defaultValue={startISO}>` + submit **outside**
  `[data-printable-calendar]`; inside the region, a header (title + effective start via `formatCalendarDate`), the
  events `<table>`, the footer `<section>` (standing schedule + prices), the `truncated` pointer to `/whats-on`,
  and the empty-state note.

## Phase 4: User Story 2 — Zero-maintenance, always current (Priority: P1)

**Goal**: the sheet renders from the same live data as the site — an added/cancelled event or an edited series
sentence/price appears with no calendar-specific edit.
**Independent test**: change the schedule/pricing/sentence on the site (or in the DB) → reload
`/printable-calendar` → the change appears; the calendar stores nothing of its own.

- [x] T008 [US2] Extend `tests/integration/printableCalendar.test.ts`: cancelling an event flips its
  `PrintableRow.cancelled`; editing a series' `scheduleSentence` / pricing changes the footer entry — all via the
  existing single source, with **no** calendar-specific write and no audit row. (Uses T004.)

## Phase 5: User Story 3 — On-screen legibility & discoverability (Priority: P2)

**Goal**: the page is reachable from the site (footer link) and legible on a phone.
**Independent test**: the footer has a "Printable calendar" link to `/printable-calendar`; at 375px the table has
no horizontal scroll.

- [x] T009 [US3] Add a **"Printable calendar"** `<Link href="/printable-calendar">` to the footer nav in
  `src/app/(public)/_components/Footer.tsx`.
- [x] T010 [P] [US3] Extend `tests/component/footer.test.tsx`: assert a "Printable calendar" link to
  `/printable-calendar` is present. (Test-first for T009.)

## Phase 6: Polish & validation

- [x] T011 Gate suite: `pnpm exec vitest run tests/unit/printableCalendar.test.ts
  tests/integration/printableCalendar.test.ts tests/component/printableCalendar.test.tsx
  tests/component/footer.test.tsx` (plus the content-slug validation test covering the new reserved slug), then
  `pnpm exec tsc --noEmit`, `pnpm run lint`, `pnpm exec prettier --check` on changed files. Full `pnpm test`
  green.
- [x] T012 Browser verify (quickstart §2–6): `/printable-calendar` shows header + table + footer; print-preview at
  Letter is **one page** with no nav/announcement/footer chrome, black-on-white (SC-001/003) — **tune `MAX_ROWS`**
  against the **2-line-row worst case** (verify a long venue/series name clamps to ≤2 lines and the sheet still
  fills one page without spilling); cancelled marker on screen + print (SC-004); footer link reachable and
  375px no-scroll (SC-005); empty state still prints the schedule (SC-006); `?start=<future>` shifts the window
  and the header, a bad `?start` falls back to today (SC-007).

## Dependencies

- **Setup** (T001) [P] independent. **Foundational**: (T002, T003 [P]) → T004. T004 blocks US1 (T007), US2
  (T008), and US3 has no dependency on it.
- **US1**: T005 [P] + T006 [P] → T007 (needs T004 + T006).
- **US2**: T008 extends T003's file; needs T004.
- **US3**: T010 [P] (test) → T009 (footer edit). Independent of the domain.
- **Phase 6** last.

## Parallel opportunities

- Setup T001 ∥ everything. Foundational T002 ∥ T003. US1 T005 (test) ∥ T006 (CSS). US3 T010 ∥ US1/US2 work
  (different file). US2 T008 ∥ US3 (different files).

## Implementation strategy

**MVP** = Setup + Foundational + **US1** — the domain view model + the `/printable-calendar` page (header, table,
footer, print CSS, `?start`). That delivers the printable one-page sheet end to end, reachable by URL. **US3**
(footer link + mobile check) makes it discoverable; **US2** is the single-source assertion (the page already
reads live data, so US2 is verification, not new machinery). Test-first throughout: T002/T003 before T004, T005
before T007, T010 before T009.
