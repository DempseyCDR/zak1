# Contract: enriched event detail page + extended projection

The interface this feature presents (`/whats-on/[eventId]`) and the projection it relies on. No new HTTP/API
endpoint — the page is server-rendered; the "contract" is the page's content/behavior and the two projection
additions.

## Page (`/whats-on/<eventId>`)

Rendered by the server page from one `PublicEventDetail`:

- A **hero image** at the top, from the event's **series** default static asset; when the series has no
  committed image, a **clean series-colored header** (no broken image).
- The **series** (color-coded via the R4 `seriesColor` map — the same color as the card), the **date**, the
  **start time**, the **advertised price** (omitted when null), and the **description** (omitted when null).
- A **venue block**: the venue name + the **tappable map link** (static-map image when a maps key is set, else a
  Google Maps link). A **directions note** slot is reserved for **P7-R8** (`venues.directions`) and renders only
  when that field exists. Omitted entirely when the event has no venue.
- The **confirmed lineup**: each booked **band** grouped with its **members** (by name; lead may sort first) and
  its bio/photo; then the **callers / other performers**. **"Lineup to be announced"** when nothing is confirmed.
  Only **confirmed** bookings appear (018).
- A clear **cancelled marker** when the event is cancelled (018/B25).
- **Exactly one `<h1>`** (the page title); WCAG AA (series color used as an accent, never behind normal text);
  legible at 375px with no horizontal scroll.
- An **unknown / non-public** event id returns **not-found** (retained).

**Guarantees**: the page is the shareable destination of every R4 card; a series is the same color on its card
and its page; missing venue/price/description/hero/lineup each degrade gracefully (omit or a clear message,
never blank/broken).

## Series → hero

A per-series code map (single source): series key → a committed static asset path under `public/series/`;
unmapped series → `null` (clean header). Curated committed assets only (D-4) — no upload, no DB image column.

## Public projection (`PublicEventDetail`)

Adds **`seriesKey: string`** (the stable series key — drives the color + hero) and, on each **`PublicBandBlock`**,
**`members: { name: string; isLead: boolean }[]`** (the confirmed band's roster). All existing fields unchanged.
The confirmed-bookings-only rule, the cancelled flag, and the venue/map projection are unchanged.

## Scope boundary

Presentation enrichment + the two projection additions + the series-hero map only. **No** image upload / per-event
images (D-4 defers the upload substrate), **no** `venues.is_public`/`directions` schema or directions page (P7-R8),
**no** instrument field (not in the model), **no** series landing pages (P7-R6), **no** roster/promo-link pages
(P7-R9), **no** single-source pricing (P7-R10 — uses the existing `advertisedPrice`), **no** migration, no new
public page.
