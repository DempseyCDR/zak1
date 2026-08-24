# Contract: event card + extended public projection

The interface this feature presents (cards on the public listings) and the projection it relies on. No new
HTTP/API endpoint — the listings are server-rendered pages; the "contract" is the card's content/behavior
and the two projection fields.

## Card (each event on `/whats-on`, `/what-was-on`, home strip)

Rendered by `EventCard` from one `PublicScheduleItem`:

- The **whole card** is a link to `/whats-on/<eventId>` (tap/click anywhere opens detail; ≥44px).
- Shows: **date (prominent)**, **start time** (when set), **venue short name** (fallback to full name;
  omit if neither), **advertised price** (omit when null).
- A **series colour accent** — a left stripe/marker coloured by the series (via `--card-accent`), used as
  an accent only (never behind normal text), meeting WCAG AA (UI 3:1).
- A clear **cancelled marker** when the event is cancelled (018/B25).
- No `<h1>` (the page owns the single H1).

**Guarantees**: legible at 375px with no horizontal scroll; the next dance answerable above the fold;
identical card across all three surfaces (one shared component).

## Series → colour

A per-series code map (single source): `tnc`→contra, `ecd`→english, `community_dance`→special,
`general`→assembly; unmapped series → neutral (`--band`). Same series → same colour everywhere.

## Public projection (`PublicScheduleItem`)

Adds **`seriesKey: string`** (stable series key, drives the colour) and **`venueShortName: string | null`**
(the card's venue field, nullable). All existing fields unchanged. The `?series=` filter, the cancelled
marker, and the confirmed-bookings-only public rule are unchanged.

## Scope boundary

Card presentation + the two projection fields only. **No** performer lineup on the card (P7-R5 detail),
**no** single-source pricing (P7-R10 — uses the existing `advertisedPrice`), **no** schema change/migration,
no new pages.
