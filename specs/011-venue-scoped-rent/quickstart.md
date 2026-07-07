# Quickstart / Validation Guide

Proves the venue-scoped rent + multi-ongoing reshape works end-to-end. Details live in
`contracts/api-deltas.md`, `data-model.md`, and `tasks.md`.

## Prerequisites

- Local Postgres with `zak1_dev` and `zak1_test`.
- Migration `0016_venue_rent_and_multi_ongoing.sql` applied.

## Setup

```bash
npm run db:migrate     # apply 0016 to zak1_dev (loads .env first if running the CLI directly)
npm run db:seed        # reseed
```

## Automated validation (primary)

```bash
npm test               # Vitest against zak1_test
```

Expected green, including new/updated tests asserting:

- **Rent precedence** — with a venue default, a series-at-venue rate, and a per-event override all set, an
  event resolves the per-event value; clearing it falls to series-at-venue; clearing that falls to venue
  default; a venue with no rent (and no override) resolves 0. *(FR-001..FR-005, SC-001, SC-002)*
- **No-venue event** — a per-event rent is used; with none set, rent is 0. *(FR-004, SC-003)*
- **Series-at-venue is per venue** — a series-at-venue rate at venue A does not affect that series' events
  at venue B. *(FR-002)*
- **Multi-ongoing sum** — two labeled ongoing charges on a series sum into Dance Net; a `$0` entry for one
  label drops only that charge after its date; earlier events keep both. *(FR-008, FR-009, SC-005)*
- **Migration freeze** — every event that existed before `0016` resolves the identical rent and Dance Net
  afterward (before/after comparison). *(FR-007, SC-004, SC-006)*
- **Report unchanged** — organizer report figures for seeded events match pre-migration values.

## Manual smoke check (secondary)

```bash
npm run dev
```

1. `/venue-rents` → set a venue default rent and a series-at-venue rent for a venue; confirm both list.
2. `/events` → set a per-event rent override on one event; clear it; confirm the override field round-trips.
3. `/expense-parameters` → add two ongoing charges ("Supplies/insurance", "Equipment loan") for a series;
   confirm rent controls are gone from this page (rent lives under `/venue-rents`).
4. `/organizer/tnc` → confirm an event's rent reflects the resolved layer and Dance Net sums both ongoing
   charges.

## Success signals

All SC-001..SC-006 hold: venue rent auto-applies, per-event override isolates to one event, no-venue rent
works, existing Dance Net is unchanged post-migration, multiple ongoing charges sum and end independently,
and no past figure shifts when a later rent/charge is added.
