# Quickstart: Shared filterable event selector

Validation scenarios per user story. Component tests use the jsdom harness (feature 020). **No migration, no
API change.**

## Prerequisites

- `pnpm run db:migrate` already current (this feature adds no migration).
- Run a file with `pnpm exec vitest run tests/component/<file>`; the whole suite with `pnpm test`.

## US1 — Land on the right event (default + order + labels)

**Component** (`tests/component/eventSelector.test.tsx`, stubbed fetch for `/api/events` + `/api/series`):

- With events before/on/after today, the selector defaults to the most recent event ≤ today (else the soonest
  upcoming) and calls `onSelect` once with it; options are newest-first, each `date · HH:MM · label`.
- Per surface: check-in keeps 025's behavior (`checkin.selector.test.tsx` stays green); the new `/treasurer`
  page lands on the default and shows that event's report.

## US2 — Filter by series + date range

**Component** (`eventSelector.test.tsx`): applying a **series** filter shows only that series' events; a
**from/to date range** shows only events in range; both narrow the list newest-first.

## US3 — Deliberate selection (confirm on pick, not on filter)

**Component** (`eventSelector.test.tsx`): typing/adjusting a filter does **not** call `onSelect`; only picking
an event from the event `<select>` does. (On the gate, this means the door record opens only on the confirmed
pick — `gate.eventSelector.test.tsx`.)

## US4 — One consistent selector; each surface keeps its side effect

**Component**:

- `gate.eventSelector.test.tsx` — selecting an event opens/loads its door record (the gate's own behavior),
  driven by the selector.
- `treasurer.page.test.tsx` — `/treasurer` renders the selector + report; switching the selected event reloads
  the report.
- check-in and payments render the same selector; behavior identical.

## Edge cases

- No events → empty state, nothing selected.
- Filter empties the list → no selection until the filter is relaxed.
- Two same-day events → distinguishable by `HH:MM` + label.

## Full gate (solo-maintainer mode)

`pnpm exec tsc --noEmit` · `pnpm exec eslint <changed>` · `pnpm exec prettier --check <changed>` · `pnpm test`
(incl. the generated route-inventory test, which picks up the treasurer route change) · `pnpm build` — all
green before the single atomic commit.
