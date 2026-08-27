# Data Model: Printable calendar (P7-R15)

**No new persisted entities. No migration. No schema change.** The feature is a **read-only** presentation of
existing data. The only "model" is the derived, display-safe **view model** the page renders.

## Sources (existing, unchanged)

| Source | Provides |
|--------|----------|
| `getPublicSchedule(db, startISO)` → `PublicScheduleItem[]` | events from `startISO` onward (date, seriesKey, venueName, venueShortName, cancelled) — already PII-gated on venue. `startISO` = the validated `?start` or today |
| `bookings` ⋈ `bands` (confirmed, `bandId` not null) | each event's **confirmed band name(s)** (018 confirmed-only) — one query over the window's event ids |
| `bookings` ⋈ `performers` (confirmed, `performerType = 'caller'`) | each event's **confirmed caller name(s)** — one query; the column renders `<band> w/<caller>` |
| `events.description` | each event's **public blurb** — a full-width sub-line under the row; also drives the dynamic one-page cap (a described row costs more) |
| a series-key → short-code map (`tnc`→`TNC`, `ecd`→`ECD`, `community_dance`→`CD`, `general`→`Joint`) | the Series column's short code (fallback: uppercased key) |
| `series` rows (`key`, `name`, `scheduleSentence`) | the standing-schedule text per series |
| `resolveEventPricing(db, { seriesId, eventDate: today, advertisedPriceCents: null })` → `PublicPricing` → `pricingSummary` | each series' current admission price string |

## Derived view model (returned by `getPrintableCalendar`)

```ts
type PrintableRow = {
  dateISO: string;       // YYYY-MM-DD (for keys / ordering)
  dateDisplay: string;   // e.g. "Nov 27"
  series: string;        // SHORT code, e.g. "TNC" / "ECD" (day-of-week is implied; no Day/Time column)
  band: string | null;   // confirmed band name(s), or null — rendered as "<band> w/<caller>"
  caller: string | null; // confirmed caller name(s), or null
  venue: string | null;  // venue short name, falling back to full name
  cancelled: boolean;    // feature 018 marker
  description: string | null; // the event's public blurb → a full-width indented sub-line, or null
};

type SeriesSchedule = {
  seriesKey: string;
  name: string;          // series display name
  sentence: string;      // the standing-schedule sentence (only series that HAVE one appear)
  price: string | null;  // pricingSummary (e.g. "$5–$15", "Free"); null = unpriced/blank
};

type PrintableCalendar = {
  startISO: string;           // the EFFECTIVE start actually used (validated ?start, or today) — for the header
  rows: PrintableRow[];       // dynamically capped to one page, nearest-dated first, from startISO onward
  truncated: boolean;         // true when events remained beyond the page (drives the "more online" pointer)
  seriesSchedules: SeriesSchedule[]; // footer: standing schedule + price, series-with-a-sentence only
};
```

## Rules

- **Ordering**: `rows` are ascending by date (as `getPublicSchedule` returns), nearest first.
- **One-page cap (dynamic, weight-aware)**: `rows` = events taken by `fitRows` until a tuned `PAGE_LINE_BUDGET`
  of line-units is used, where each event costs `1 + descriptionLines` (0–2). A described row costs more, so
  fewer fit. `truncated = rows.length < upcoming.length`.
- **Venue**: prefer `venueShortName`; fall back to `venueName`; may be `null`.
- **Cancelled** (018): cancelled events remain listed within the cap, marked; only confirmed public events are in
  the source (the confirmed-bookings-only rule is inherited).
- **Footer series**: include a series **iff** it has a non-empty `scheduleSentence`; show its `pricingSummary`
  (a free series → "Free", distinct from a `null` unpriced one). Order by the club's series order.
- **Empty schedule**: `rows = []`, `truncated = false`; `seriesSchedules` still populated so the standing
  schedule + prices print, alongside a "no dances currently scheduled" note (rendered by the page).

## Pure helpers (unit-tested, off-DB)

- `fitRows(items, budget, cost): { rows, truncated }` — take items while running `cost` stays within `budget`
  (always ≥1); the weight-aware one-page mechanism (a described row costs more, so fewer fit).
- `formatCalendarDate(dateISO: string): { dateDisplay: string; weekday: string }` — derive the display date and
  weekday from a `YYYY-MM-DD` string (UTC-parsed, matching the app's date convention).
- `resolveStart(raw: string | undefined): string` — the `?start` boundary: a valid `YYYY-MM-DD` (via `isoDate`
  `safeParse`) passes through; anything missing/malformed/non-date returns **today**. No throw.

## Audit / persistence

- **None.** The page writes nothing; there is no new `AuditEvent` kind and no table.
