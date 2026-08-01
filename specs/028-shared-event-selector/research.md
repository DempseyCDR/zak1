# Research: Shared filterable event selector

Decisions resolving the plan's unknowns. No open `NEEDS CLARIFICATION` — scope + the deep-link decision are
settled (Phase 5 doc + the 2026-08-01 clarification: no deep links), and the extraction source is confirmed by
reading the 025 check-in selector, `/api/events`/`/api/series`, and the four surfaces.

## R1 — One shared client component `EventSelector` that owns fetch + filters + default

**Decision**: A new client component `src/app/EventSelector.tsx` with props `{ value: string, onSelect:
(eventId: string) => void }`. It fetches `/api/events` (already returns descending — 025) and `/api/series`
once, holds the filter state (series + date range), computes the default, and reports the chosen event via
`onSelect`. It is **presentation-only** for side effects — each page's `onSelect` does the page's own work.

**Rationale**: FR-007/FR-008. Centralizing the selection logic (currently duplicated/absent across surfaces)
is the whole point (backlog B39's first real use). Owning the fetch means every surface gets identical
default/order/label/filter behavior for free; `onSelect` keeps page-specific side effects out of the component.

**Alternatives**: Pass events in as a prop from each page — rejected (re-duplicates the fetch + default logic
per surface, the exact inconsistency this removes). A hook instead of a component — rejected (the filter UI is
shared too, not just the logic).

## R2 — Native selects + client-side filtering; default fires once on open; confirm = picking the event

**Decision**: The picker renders a **native event `<select>`** (`aria-label="Event"`, options formatted `date ·
HH:MM · label` via the extracted `toHHMM`/`eventLabel`) plus the **filter controls**: a series `<select>` (from
`/api/series`) and **from/to date inputs**. The event list is filtered **client-side** from the single fetch.
The **default** (most recent event with `event_date ≤ today`, else the soonest upcoming) is computed **once**
when `value` is empty and reported via `onSelect`. Adjusting a filter narrows the option list but **never**
changes the selected event — only picking from the event `<select>` does (which is the Enter/tap confirm).

**Rationale**: FR-001/002/003/004/005. Scores of events → client-side filter is ample (YAGNI on server
pagination). Separating "filter controls" from "the event select" makes FR-005 fall out naturally: filters
don't commit a selection, so the page's side effects (opening door records) never thrash while narrowing. The
default-once-on-open matches 025 and avoids re-defaulting (and re-firing side effects) on filter changes.

**Alternatives**: A free-text typeahead/combobox over event names — rejected (filters are structured
series+date; a native select is simpler, accessible, and testable). Re-default on every filter change —
rejected (would fire side effects mid-filtering, violating FR-005).

## R3 — Per-surface integration: swap the inline selector, keep the side effect in `onSelect`

**Decision**: check-in, gate, and payments each replace their inline `<select>` (and check-in's inline
`toHHMM`/`eventLabel`/default effect) with `<EventSelector value={eventId} onSelect={…}/>`, keeping `eventId`
as page state: check-in `onSelect={setEventId}` (roster effect unchanged); gate `onSelect={openDoorRecord}`
(opens/loads the door record — D2); payments `onSelect={loadEvent}` (loads bookings/payments). The
component preserves check-in's `aria-label="Event"` + option format so feature 025's `checkin.selector.test.tsx`
stays green **unchanged**.

**Rationale**: FR-007/FR-008 + SC-006 (no regression). The page keeps ownership of its follow-on behavior; the
selector just reports the event. Preserving the check-in contract avoids editing a passing test and proves the
refactor is behavior-neutral there.

**Alternatives**: Rewrite check-in's test for the new component — rejected (unnecessary churn; the contract is
preservable).

## R4 — Treasurer: param route → single `/treasurer` page (no deep link)

**Decision**: Because the event is now **in-page state** (no per-event URL, per clarification), the treasurer
report moves from `src/app/(admin)/treasurer/[eventId]/page.tsx` to a new
`src/app/(admin)/treasurer/page.tsx` that renders `<EventSelector value={eventId} onSelect={setEventId}/>` and
the report for the selected event (relocating the existing report-fetch logic, keyed on state instead of the
route param). The `[eventId]` route is **removed**, and the nav link `/treasurer/latest` → `/treasurer` (fixing
the broken entry — FR-010). The generated route-inventory test picks up the change automatically (016).

**Rationale**: FR-006/FR-010 + the no-deep-link clarification. The old `/treasurer/latest` never resolved
("latest" isn't an event id); a single `/treasurer` page defaulting via the selector is the working entry
point. Keeping a param route would imply a deep link, which is out of scope.

**Alternatives**: Keep `/treasurer/[eventId]` + add a `/treasurer` landing that redirects — rejected
(reintroduces the per-event URL the clarification dropped, and a redirect hop for no benefit).

## R5 — No server change, no migration

**Decision**: Reuse `/api/events` (descending list) and `/api/series` as-is; filter client-side. No new
endpoint, no `listEvents` change, no schema, no migration.

**Rationale**: 025 already made `listEvents` return newest-first and it already accepts `from`/`to`; the series
list already exists. The date-range filter over scores of events is fine client-side. Adding server filtering
or pagination would be premature (YAGNI).

**Alternatives**: Server-side date filtering via `/api/events?from&to` — rejected for now (client-side is
simpler at this scale; can be added later if the event list grows large).
