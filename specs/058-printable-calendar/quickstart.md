# Quickstart / Validation: Printable calendar (P7-R15)

Read-only feature — no migration. Assumes the dev server runs and the dev DB has some upcoming events.

## 0. Setup

```bash
pnpm dev
```

## 1. Gate suite (fast, no browser)

```bash
pnpm exec vitest run \
  tests/unit/printableCalendar.test.ts \
  tests/integration/printableCalendar.test.ts \
  tests/component/printableCalendar.test.tsx \
  tests/component/footer.test.tsx
pnpm exec tsc --noEmit
pnpm run lint
```

Expected: the `capRows` cap/`truncated` boundary + `formatCalendarDate`; `getPrintableCalendar` assembly (capped
rows + per-series footer + cancelled + empty); the page renders (table/footer/cancelled/empty/"more" pointer);
the footer link.

## 2. On-screen (US3) — browser

1. Open `/printable-calendar` → a header, a clean table of upcoming dances (Date, Series, Band / Caller, Venue), and
   a footer with the standing weekly schedule + per-series prices.
2. Confirm it is reachable: the site **footer** has a "Printable calendar" link (SC — discoverable).
3. Resize to 375px → the table is legible with **no horizontal scroll** (SC-005).

## 3. Print / save-as-PDF (US1) — browser

1. Print-preview `/printable-calendar` (Cmd/Ctrl-P) at **Letter (8.5×11″)**.
2. The preview is **one page**: header + the events that fit + the footer (standing schedule + prices), with
   **no** site nav, volunteer nav, announcement banner, or site footer chrome, black-on-white (SC-001/003).
3. If more upcoming events exist than fit, the sheet shows the nearest-dated ones + a "…and more — see the full
   schedule online" line, and does **not** spill to a second page (FR-010/FR-011). Tune `MAX_ROWS` if page-two
   spill or a large empty gap appears.

## 4. Cancelled + free + single-source (SC-002/004) — browser

- A cancelled event in the window shows a clear **cancelled** marker on screen and in print (SC-004).
- The footer price for a configured-free series reads **"Free"** (not blank).
- Change the live site (add/cancel an event, edit a series' schedule sentence or price) → reload
  `/printable-calendar` → the change appears, with **no** calendar-specific edit (SC-002).

## 5. Empty state (SC-006) — browser or gate suite

- With no upcoming events, the page still renders the standing weekly schedule + prices and a clear "no dances
  currently scheduled" note.

## 6. Choose the start date (SC-007) — browser

- Use the on-screen **date control** (or edit the URL to `?start=2026-09-01`) → the list begins on that date and
  the header reflects it. A **future** start prints next month's schedule in advance.
- Try a bad value (`?start=nope`, `?start=2026-13-40`, or omit it) → the page shows from **today**, no error.

## Success criteria mapping

| Criterion | Validated by |
|-----------|--------------|
| SC-001 clean print, no chrome | §3 |
| SC-002 single-source, auto-current | §4 |
| SC-003 one Letter page, no clip/overflow | §3 |
| SC-004 cancelled marked (screen + print) | §4 |
| SC-005 no h-scroll @375px | §2 |
| SC-006 empty state still prints schedule | §5 |
| SC-007 `?start` window + forgiving fallback | §6 |
