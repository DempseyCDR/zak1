# Quickstart / Validation Guide

Proves the event label, start time (venue-local wall-clock), and public description work end-to-end.
Details in `contracts/api-deltas.md` and `data-model.md`.

## Prerequisites

- Node 24 + pnpm; local Postgres with `zak1_dev` and `zak1_test`.
- Migration `0018_event_label_time_description.sql` applied.

## Setup

```bash
pnpm run db:migrate     # apply 0018 to zak1_dev
pnpm run db:seed        # reseed (a couple of events get a label + start time + description)
```

## Automated validation (primary)

```bash
pnpm test               # Vitest against zak1_test
```

Expected green, including new/updated tests asserting:

- **Create/patch persist the fields** — creating an event with `label`, `startTime`, `description`
  stores them; patching sets/clears each. *(FR-001, FR-003, FR-005, FR-007)*
- **Same-day group events distinguishable** — two events in one group on one date with labels
  "Afternoon"/"Evening" are both returned with their labels in the public schedule. *(FR-002, SC-001)*
- **Start time is zone-independent** — a unit test asserts `formatWallClock("19:30:00") === "7:30 PM"`
  under different `TZ` values (e.g. `TZ=UTC` and `TZ=America/Los_Angeles`), never shifting. *(FR-004,
  SC-002)*
- **Public detail shows/omits description** — an event with a description renders it; one without shows
  no description. *(FR-006, SC-003)*
- **No regression** — an event created without the three fields returns `null` for them and appears in
  listings exactly as before. *(FR-008, SC-004)*

## Manual smoke check (secondary)

```bash
pnpm run dev
```

1. `/events` → create two events in one group on one date with labels "Afternoon"/"Evening", start times,
   and a description; confirm the list distinguishes them and shows the times.
2. `/whats-on` → confirm the schedule shows each event's label and start time (as entered).
3. `/whats-on/<eventId>` → confirm the detail shows label, start time, and description.
4. Change your device time zone and reload `/whats-on` → the start time is unchanged.

## Success signals

All SC-001..SC-004 hold: same-day group events distinguishable by label, start time shown exactly as
entered regardless of viewer time zone, description shown when present, and events without the fields
unchanged.
