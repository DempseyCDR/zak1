# Phase 1 Data Model: Feature 020 — Booker Experience

**Date**: 2026-07-25 · **Plan**: [plan.md](plan.md) · **Research**: [research.md](research.md)

One additive migration, **`0025_booker_experience.sql`**. Everything else is behavior over existing tables.

---

## Schema changes

### `booking_status` enum — add `tentative` (US3)

```sql
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'tentative';
```

Value ordering in the enum is irrelevant (transitions are validated in code, not by enum order). Added
value is unusable in the same transaction (PG) — the migration never uses it, so no issue. `BookingStatus`
in `schema/enums.ts` gains `'tentative'`, keeping the union exhaustive.

### `venues.short_name` (US5)

| Column | Type | Notes |
|---|---|---|
| `short_name` | `text` NULL | Display-only, **non-unique**. Defaulted from initials at create; app falls back to derived initials if null. |

Backfill in the migration:

```sql
ALTER TABLE venues ADD COLUMN IF NOT EXISTS short_name text;
-- INTENTIONAL BACKFILL: initials of the full name (uppercased first letter of each word).
UPDATE venues
SET short_name = (
  SELECT string_agg(upper(left(word, 1)), '')
  FROM regexp_split_to_table(name, '\s+') AS word
  WHERE word <> ''
)
WHERE short_name IS NULL;
```

The SQL initials expression mirrors the pure `venueShortNameDefault(name)` used at create time; both must
agree (a unit test pins the function; the backfill is a one-time apply of the same rule).

---

## No new tables

Bookings, events, performers, contacts, series, `series_parameters`, `venue_rents` are all unchanged in
shape. The feature reads and writes them through existing services.

---

## State transitions — booking status (US3)

```text
proposed  ──> requested ──> tentative ──> confirmed
   │            │    │            │
   │            │    └──────────> confirmed        (tentative is skippable)
   └─> declined <┘─────────────── declined <───────┘
declined ──> proposed                               (revive)
(any state) ──[substitute performer]──> proposed    (re-point; clears check number)
```

Encoded in the `ALLOWED` map (research R1). `isAllowedBookingTransition(from, to)` allows a same-status
no-op; substitute is handled separately in `patchBooking` (re-point → `proposed`, check number cleared).

---

## Derived values and pure functions

| Function | Location | Contract |
|---|---|---|
| `venueShortNameDefault(name)` | `domain/venues/venueService.ts` | Initials: uppercased first letter of each whitespace-delimited word. "German House" → "GH"; "The Harmony" → "TH". Empty/whitespace name → "". |
| `mailtoEmailFor(emails)` | `domain/…` (or a small `contacts` helper) | First **active** email whose `purposes` include, in order, `booking` → `personal` → `public_profile`; excludes `other`; null if none. |
| `priorEventDefaults(db, seriesId, beforeDate)` | `domain/events/eventService.ts` | `{ venueId, startTime }` of the latest event in the series with `event_date < beforeDate`; both null if none. |
| `resolveEventRentCents(...)` (existing) | `domain/parameters/rentService.ts` | Reused to show the resolved default; the modal also needs a read that resolves rent for a *chosen* venue (US4 re-default). |

---

## Report row shape (US1 additions)

`assembleBookingsReport` gains:

- a `sort: "asc" | "desc"` filter option (default `asc`, preserving today's behavior), and
- **`venueShortName`** on each `BookingsReportRow` (from `events.venue_id → venues.short_name`, falling back
  to the derived initials).

- **`hasSoundTech`** on each row (the event's series flag) so the UI can omit the sound-tech empty slot for
  `community_dance`. This MUST be on the row: the `/api/series` list returns only `{id, key, name}`, so the
  UI cannot read the flag from there (analyze G1).

Everything else on the row (caller, band, `musicians[]`, soundTech, `cancelled`, per-booking `status`) is
unchanged.

---

## Data integrity notes

1. **The backfill is the one intentional non-additive act** in migration 0025 — flagged in the header, as
   0023/0024 were. Idempotent (`WHERE short_name IS NULL`).
2. **`tentative` never reaches the public path** — the confirmed-only filter guarantees it; worth an explicit
   test that a tentative booking is absent from the public display.
3. **Rent override semantics** (Option A) are the subtle bit: leaving the shown default stores `null`, not
   the number — an explicit test asserts a no-op edit leaves `events.rent_cents` null.
