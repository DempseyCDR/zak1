# Contract: Venue Short Name (US5)

Extends the existing venue admin. `venue.write` gates writes (Booker + Treasurer); reads are `base`.

---

## `GET /api/venues` / `GET /api/venues/:id` (existing)

Row gains `shortName` (nullable; the report/UI falls back to derived initials when null).

## `POST /api/venues` (existing) — short name default

When `shortName` is omitted at create, the service defaults it to `venueShortNameDefault(name)` — the
uppercased initials of each word ("German House" → "GH"). The Booker may supply/override it.

## `PATCH /api/venues/:id` (existing) — edit short name

`shortName` becomes an editable field (validated: trimmed, reasonable max length). Non-unique by design —
collisions are cosmetic (display-only). Change is audited via the existing `venue.updated` path.

---

## Backfill (migration 0025)

Existing venues get `short_name` = the same initials rule, applied once (idempotent, `WHERE short_name IS
NULL`). The SQL initials expression and the `venueShortNameDefault` function must agree — the function is
unit-tested; the backfill is a one-time apply of the same rule.

## Validation

`venueShortNameDefault(name)`:

- splits on whitespace, takes the uppercased first letter of each non-empty word;
- "German House" → "GH", "First Unitarian Church" → "FUC", "The Harmony" → "TH";
- empty/whitespace-only name → "" (the Booker then types one).
