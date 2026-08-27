# Contracts: Printable calendar (P7-R15)

Surfaces: (A) the domain view-model assembler + pure helpers, (B) the page/route + print contract, (C) the
footer link + reserved slug, and the test contracts. **No API, no persistence** — read-only.

## A. Domain — `src/server/domain/public/printableCalendar.ts`

```ts
export const PAGE_LINE_BUDGET = 24; // ~line-units that fit one Letter page below the header (tuned in-browser)

export type PrintableRow = {
  dateISO: string;
  dateDisplay: string;   // "Nov 27"
  series: string;        // short code, e.g. "TNC"
  band: string | null;   // confirmed band name(s), or null — rendered "<band> w/<caller>"
  caller: string | null; // confirmed caller name(s), or null
  venue: string | null;
  cancelled: boolean;
  description: string | null; // public blurb → a full-width indented sub-line under the row, or null
};
export type SeriesSchedule = { seriesKey: string; name: string; sentence: string; price: string | null };
export type PrintableCalendar = {
  startISO: string;      // the effective start used (validated ?start, or today)
  rows: PrintableRow[];
  truncated: boolean;
  seriesSchedules: SeriesSchedule[];
};

/** Pure, weight-aware: take items while running `cost` stays within `budget` (always ≥1); report if any were
 *  left out. The DYNAMIC one-page cap — a described row costs more (1 + its description lines), so fewer fit. */
export function fitRows<T>(items: T[], budget: number, cost: (item: T) => number): { rows: T[]; truncated: boolean };

/** Pure: a YYYY-MM-DD string → display date + weekday (UTC-parsed, matching the app's date convention). */
export function formatCalendarDate(dateISO: string): { dateDisplay: string; weekday: string };

/** The `?start` boundary: a valid YYYY-MM-DD (local regex + real-date Zod check, safeParse) passes;
 *  missing/malformed/non-date → today. No shared `isoDate` export — the check is defined in this module. */
export function resolveStart(raw: string | undefined): string;

/** Assemble the printable view model from `startISO` onward — capped rows + per-series schedule & price footer. */
export function getPrintableCalendar(db: Db, startISO: string): Promise<PrintableCalendar>;
```

### Guarantees

- `getPrintableCalendar` reads `getPublicSchedule(db, startISO)` (from `startISO` onward, PII-gated), fetches each
  event's description, caps via the weight-aware `fitRows`, maps to `PrintableRow` (venue = short ?? full;
  cancelled + description preserved), and echoes the effective
  `startISO`.
- `resolveStart` never throws: a valid `YYYY-MM-DD` passes through; anything else (absent/malformed/non-date)
  returns today.
- `seriesSchedules` includes **only** series with a non-empty `scheduleSentence`, each with its `pricingSummary`
  (a free series → "Free"; `null` when unpriced), in the club's series order.
- Returns display-safe fields only — no contact PII (inherits venue PII gating), no internal columns.
- Read-only: no writes, no audit.

## B. Page + print — `src/app/(public)/printable-calendar/page.tsx` (server component)

- Route: **`/printable-calendar`** (a `(public)` page → gets the public visual layer; the print CSS strips the
  shell for printing). Reads `searchParams.start` → `resolveStart(...)` → `getPrintableCalendar(db, startISO)`.
- **Screen-only start control** (rendered **outside** `[data-printable-calendar]`, so print hides it): a
  `<form method="get">` with `<input type="date" name="start" defaultValue={startISO}>` and a submit button —
  submitting reloads `/printable-calendar?start=…`. No client JS.
- Renders inside a `[data-printable-calendar]` region: a **header** (title + the effective start, e.g. "from
  Sat, Nov 1"), a **table**
  (`<table>` with a `<thead>` of `<th scope="col">` — Date, Series (short code), Band / Caller, Venue — a row per
  event, the cancelled ones marked, and — for events that have one — a **full-width `colspan=4` description
  sub-line** in an indented italic below the row), and a **footer** (`<section>`, not `<footer>`, to avoid the print-hide of site chrome)
  listing each `SeriesSchedule` (name · sentence · price) and, when `truncated`, a "…and more — see the full
  schedule online" line linking to `/whats-on`. Empty schedule → a clear "no dances currently scheduled" note,
  footer still shown.
- **Print CSS** (`PrintableCalendar.module.css`, `@media print`): the print-only-region technique (hide
  everything, reveal `[data-printable-calendar]` and its descendants, pin to top), `@page { size: letter;
  margin }`, black-on-white; the site nav/volunteer-nav/announcement/footer never print. Cells and the
  **description sub-line are clamped to ≤2 lines** (`overflow: hidden`) so each row's line count is predictable,
  which is what makes the **weight-aware `fitRows` cap** reliably fit one page (FR-010). **Screen CSS**:
  mobile-first, the table
  scrolls inside its own container only if unavoidable — target is no h-scroll at 375px.
- Server-rendered (present without JS); no client behavior.

## C. Footer link + reserved slug

- **`src/app/(public)/_components/Footer.tsx`** (MODIFY): add a `<Link href="/printable-calendar">Printable
  calendar</Link>` in the footer nav.
- **`src/server/validation/content.ts`** (MODIFY): add `"printable-calendar"` to `RESERVED_SLUGS` so a CMS page
  cannot claim the route.

## Test contracts

- **Unit** `tests/unit/printableCalendar.test.ts`:
  - `fitRows` — takes all when within budget; stops before the item that would exceed it (`truncated=true`);
    weights heavier items so fewer fit; always shows ≥1 even if it alone exceeds budget; empty → `[]`, false.
  - `formatCalendarDate` — a known `YYYY-MM-DD` → expected weekday + display date (UTC-parsed; no off-by-one).
  - `resolveStart` — a valid `YYYY-MM-DD` passes through; `undefined`, `""`, `"nope"`, `"2026-13-40"`,
    `"2026/09/01"` → **today** (no throw).
- **Integration** `tests/integration/printableCalendar.test.ts` (real Postgres): seed events + series;
  `getPrintableCalendar(db, today)` returns rows nearest-first mapped correctly (**series short code**, a seeded
  **confirmed band + caller** in `band`/`caller`, a seeded **description**, venue short-name fallback, cancelled
  flag) and echoes `startISO`; a **future `startISO`** returns only events on/after it (events before it excluded
  — proves `?start` advance-planning); the **dynamic cap** — with all-plain events exactly `PAGE_LINE_BUDGET`
  fit, and once every event carries a description **half as many** fit (`truncated === true`);
  `seriesSchedules` includes only series with a sentence, each with its price ("Free" for a
  configured-free series); an empty window → `rows=[]`, `truncated=false`, footer still populated. Read-only
  (no audit rows written).
- **Component** `tests/component/printableCalendar.test.tsx` (jsdom): given a `PrintableCalendar`, the page
  renders a table with `<th scope="col">` headers **Date · Series · Band / Caller · Venue**, a row per event
  showing the series short code + "band w/caller" (cancelled ones marked), and a **full-width (`colspan=4`)
  description sub-line only for events that have one**; the footer lists
  each series' sentence + price; the header shows the effective start; a screen-only **GET date form** with
  `name="start"` defaulted to `startISO` is present; `truncated` → the "see the full schedule online" pointer
  renders (else not); empty `rows` → the "no dances currently scheduled" note; no personal data.
- **Component** `tests/component/footer.test.tsx` (MODIFY): asserts a "Printable calendar" link to
  `/printable-calendar` is present.
- **Reserved slug**: `printable-calendar` is rejected as a content slug (covered by the existing content-slug
  validation test / RESERVED_SLUGS).
