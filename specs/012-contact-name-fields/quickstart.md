# Quickstart / Validation Guide

Proves structured contact names, the overridable display name, override-immune dedup, and the export/
check-in payoffs. Details in `contracts/api-deltas.md` and `data-model.md`.

## Prerequisites

- Node 24 + pnpm; local Postgres with `zak1_dev` and `zak1_test`.
- Migration `0017_contact_names.sql` applied.

## Setup

```bash
pnpm run db:migrate     # apply 0017 to zak1_dev
pnpm run db:seed        # reseed (contacts get real first/last)
```

## Automated validation (primary)

```bash
pnpm test               # Vitest against zak1_test
```

Expected green, including new/updated tests asserting:

- **Effective display name** — first "Robert" + last "Frost" → display "Robert Frost"; setting an
  override "Bob Frost" changes only the display; editing last name leaves the override intact; clearing
  the override returns to first+last. *(FR-002..FR-004, SC-001)*
- **Blank last name** — a contact with first "Jane" and no last name saves and displays "Jane" (no
  trailing space). *(FR-001, SC-001)*
- **Pronouns** — recorded and returned on the contact. *(FR-005, SC-004)*
- **Override-immune dedup** — two contacts both first "Robert" last "Frost", one with override "Bob
  Frost", surface as a merge suggestion; and two first-only "Jane" contacts surface (dedup on first
  alone). *(FR-006, SC-006)*
- **Search by display** — searching "Bob" finds the contact whose override is "Bob Frost". *(FR-006,
  SC-006)*
- **Export first/last** — a contact with first "Ada" last "Lovelace" exports with distinct First/Last
  columns from the structured fields; a no-last-name contact exports a blank Last Name. *(FR-009, SC-003)*
- **Check-in sort** — roster orders by last name; member button shows the effective display name.
  *(FR-007, FR-008, SC-002)*
- **No regression** — reports/bookings/exports/member buttons still show the effective `display_name`.
  *(FR-010, SC-005)*
- **Migration preservation** — existing dev rows keep byte-identical display/search/dedup after `0017`.

## Manual smoke check (secondary)

```bash
pnpm run dev
```

1. `/contacts` → create a contact with first/last/pronouns; set and clear a display override; create one
   with no last name; confirm each displays correctly and pronouns show.
2. `/dedup` → confirm same-first+last contacts (incl. one overridden) appear as suggestions.
3. `/checkin` → order the roster by last name; confirm member buttons read the display name.
4. `/exports` → download a list; confirm separate First/Last columns.

## Success signals

All SC-001..SC-006 hold: overridable display name (blank-last aware), pronouns recorded, dedup
override-immune while search stays by display name, export First/Last from structured fields, roster
sortable by last name, and no name-display regression.
