# Implementation Plan: Printable calendar (P7-R15)

**Branch**: `058-printable-calendar` | **Date**: 2026-08-26 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/058-printable-calendar/spec.md`

## Summary

A print-friendly public page at **`/printable-calendar`** that renders, from the **same** data as the rest of
the public site, a clean **one-Letter-page** artifact: a header, a table of upcoming dances (date, day, time,
series, venue — **no** per-row price), and a **footer** carrying the standing weekly schedule and per-series
prices. It is **single-sourced** — upcoming events via `getPublicSchedule`, prices via `resolveEventPricing`,
standing-schedule text via each series' `scheduleSentence` — so nothing is maintained separately. The window
**starts at today by default**, or at an optional **`?start=YYYY-MM-DD`** (a forgiving query parameter — invalid
or absent falls back to today), with a small screen-only date control to set it; this lets a visitor print a
future window (e.g. next month) in advance. Each event may carry a **public description** (blurb), shown as a
full-width indented sub-line under its row. To keep it to **one page**, rows are taken by a **dynamic,
weight-aware cap** — each costs one line plus up to two for a description, taken until a tuned page line-budget is
used (fewer fit when more carry a blurb); remaining events are omitted with a "…see the full schedule online"
pointer. Print CSS strips all site chrome and prints only the calendar region on
US Letter. **No** migration, schema, capability, or audit — render-only. Independent, presentational; retains the
cancelled marker and confirmed-only rule (018).

## Technical Context

**Language/Version**: TypeScript 5.7 (strict), Node 24
**Primary Dependencies**: Next.js 16 (App Router / RSC), Drizzle ORM (reads only), CSS Modules
**Storage**: PostgreSQL 16 — **reads only**, no new tables or migration
**Testing**: Vitest — real-Postgres integration, unit, jsdom component
**Target Platform**: Server-rendered web; the print target is **US Letter (8.5×11″)**; mobile-first on screen
**Performance Goals**: Standard web; one public-schedule read + a per-series pricing read per render
**Constraints**: Output fits **one Letter page** (row cap + print CSS); **no** site nav/footer chrome on the
print; high-contrast black-on-white; browser print / save-as-PDF (**no** server-side PDF); mobile-first on
screen (no h-scroll at 375px); accessible table semantics; single-sourced (no separate data); reflects
adds/cancellations/re-pricing automatically; **no** read/write of anything (read-only)
**Scale/Scope**: One club. One new route, one domain read (view-model assembler) + a couple of pure helpers,
one CSS module (screen + print), a footer link, and one reserved slug. No data-layer changes.

## Constitution Check

Constitution v1.3.0. Gates:

- **I. Test-First (NON-NEGOTIABLE)** — PASS (planned). A **unit** test for the pure `capRows` (cap + the
  `truncated` flag at the boundary) and `formatCalendarDate` (date → display date + weekday); an **integration**
  test for `getPrintableCalendar` over real Postgres (upcoming rows capped, `truncated` set, per-series footer
  = only series with a schedule sentence + their price, cancelled flag preserved, empty schedule still returns
  the footer); a **component** test for the page (table rows, footer schedule+prices, cancelled marker, empty
  state, the "more online" pointer, accessible `<th scope>`). A **footer** test asserts the new link; a
  **reserved-slug** check covers `printable-calendar`.
- **II. YAGNI** — PASS. Render-only: reuse `getPublicSchedule`, `resolveEventPricing`/`pricingSummary`, the
  series `scheduleSentence`, the `(public)` shell, and the 051 reserved-slug list. The one-page fit is a **row
  cap** (a pure array slice) — no pagination engine, no measurement, no server PDF. No new table, capability,
  or audit (nothing is written).
- **III. Type Safety (Zod at boundaries)** — PASS. The one input boundary — the `?start` query parameter — is
  Zod-validated at the page (a **local** `YYYY-MM-DD` + real-date check defined in `printableCalendar.ts`, since
  no shared `isoDate` is exported; same pattern as 054/057); a `safeParse` **failure or absence falls back to
  today** (a forgiving public GET never errors on a bad parameter). The view model is a typed, display-safe
  projection of already-validated internal data (no PII — it inherits the public schedule's venue PII gating).
- **IV. Observability** — PASS. The page is **read-only**; there is no state change to audit. (Standard request
  logging already applies.)

No violations. Complexity Tracking: none.

## Project Structure

### Documentation (this feature)

```text
specs/058-printable-calendar/
├── spec.md · plan.md · research.md · data-model.md · quickstart.md
├── contracts/printable-calendar.md
└── checklists/requirements.md
```

### Source Code (repository root)

```text
src/server/domain/public/printableCalendar.ts            # NEW — getPrintableCalendar(db, startISO) (view model) +
                                                         #        pure capRows, formatCalendarDate, resolveStart (?start → today)
src/server/validation/content.ts                          # MODIFY — RESERVED_SLUGS += "printable-calendar"

src/app/(public)/printable-calendar/page.tsx              # NEW — server component: reads searchParams.start (Zod isoDate,
                                                         #        invalid→today); a screen-only GET date form; header+table+footer
src/app/(public)/printable-calendar/PrintableCalendar.module.css # NEW — screen (mobile-first) + @media print (Letter)
src/app/(public)/_components/Footer.tsx                    # MODIFY — add the "Printable calendar" footer link

tests/unit/printableCalendar.test.ts                      # capRows + truncated + formatCalendarDate
tests/integration/printableCalendar.test.ts               # getPrintableCalendar over real Postgres
tests/component/printableCalendar.test.tsx                # page render: table, footer, cancelled, empty, "more" pointer
tests/component/footer.test.tsx                           # MODIFY — assert the printable-calendar link
```

**Structure Decision**: Single web app. Load-bearing choices: (1) **single-source, render-only** — a
`getPrintableCalendar(db, startISO)` view-model assembler composes `getPublicSchedule(db, startISO)` with each
series' `scheduleSentence` + `resolveEventPricing` (footer), so there is no second calendar to maintain and no
data-layer change. (2) **One-page fit = a dynamic, weight-aware cap** — the pure `fitRows(items, budget, cost)`
takes events until a tuned `PAGE_LINE_BUDGET` of line-units is used, where an event's cost is 1 (its row) plus
its description's line count (0–2). A described row costs more, so fewer fit; cells are CSS-clamped so heights
stay predictable. Descriptions are fetched (bounded by a scan cap) **before** the cap, since they determine it;
`getPrintableCalendar` reports `truncated` when events remain, driving the "see the full schedule online"
pointer. (3) **Print only the calendar region** — the page wraps its content in `[data-printable-calendar]`; the
CSS module's `@media print` block uses the "print-only-this-region" technique (hide everything, reveal the
region) plus `@page { size: letter }`, so the site nav/footer/announcement chrome never prints. (4) **Reserved
route** — `printable-calendar` joins `RESERVED_SLUGS` so a CMS page can't shadow it. (5) **Forgiving start
parameter** — the page reads `searchParams.start`, validates it with a **local** `YYYY-MM-DD`+real-date check
(no shared `isoDate` export; `safeParse` → today on failure/absence), and passes the effective start to
`getPrintableCalendar(db, startISO)`; a screen-only **GET
`<form>`** with `<input type="date" name="start">` sets it (no client JS), rendered **outside**
`[data-printable-calendar]` so the print-hide removes it from the sheet.

## Complexity Tracking

No constitution violations; no entries.

## Phase 0 — Research

See [research.md](research.md): the single-source view-model assembly, the row-cap one-page-fit mechanism, the
print-only-region CSS approach + `@page` Letter, the footer standing-schedule/pricing composition (series with a
sentence only), the reserved-slug + footer-link integration, and why there is no migration/Zod/audit.

## Phase 1 — Design & Contracts

- [data-model.md](data-model.md) — no new persisted entities; the derived **view model** (rows + footer +
  truncated) and its field rules.
- [contracts/printable-calendar.md](contracts/printable-calendar.md) — `getPrintableCalendar`, the pure helpers,
  the page/route + print contract, the footer link, and the test contracts.
- [quickstart.md](quickstart.md) — end-to-end validation mapped to SC-001…006 (incl. the one-page print check).
- Agent context: `CLAUDE.md` SpecKit plan reference updated to this plan.
