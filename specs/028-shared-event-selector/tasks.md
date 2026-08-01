---
description: "Task list for feature 028 — shared filterable event selector (P5-R1)"
---

# Tasks: Shared filterable event selector (P5-R1)

**Input**: Design documents from `specs/028-shared-event-selector/`
**Prerequisites**: plan.md, spec.md (clarified), research.md, data-model.md, contracts/
**Tests**: INCLUDED — the constitution (v1.3.0, Principle I) mandates test-first.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: parallelizable (different files, no dependency on an incomplete task)
- **[Story]**: US1..US4 (from spec.md)
- Exact file paths included.

## Notes

Extract 025's smart check-in selector into **one shared client component** (`src/app/EventSelector.tsx`) used on
all four single-event surfaces. **No API change, no schema, no migration** — reuses the descending
`/api/events` and `/api/series`, filtering client-side. Per the clarification, the event is **in-page state — no deep
links/URLs**, so the **treasurer moves from `/treasurer/[eventId]` to a single `/treasurer` page**. Preserve
check-in's `Event` aria-label + `date · HH:MM · label` option format so feature 025's
`checkin.selector.test.tsx` stays green **unedited**. Ships as one atomic commit.

⚠️ **Shared file**: `EventSelector.tsx` is built in US1 (base) and extended in US2 (filters) — those tasks are
sequential on that file. The four surface pages are distinct files (parallelizable once the component exists).

---

## Phase 1: Setup

- [X] T001 No new infra — confirm **no API/schema/migration** (reuse `/api/events` desc + `/api/series`), the jsdom harness (`tests/setup.dom.ts`) is present, and note the two contracts to preserve: check-in's `Event` select aria-label + option format (keeps `checkin.selector.test.tsx` green), and the treasurer route change (`/treasurer/[eventId]` → `/treasurer`).

---

## Phase 2: User Story 1 — Land on the right event (P1) 🥇 MVP

**Goal**: One shared selector that defaults to the most recent event ≤ today, lists newest-first, and labels
`date · HH:MM · label`; every single-event surface uses it.

**Independent Test**: On each surface, opening it pre-selects the most recent event ≤ today, newest-first, with
readable labels.

- [X] T002 [P] [US1] Write `tests/component/eventSelector.test.tsx` (jsdom, stubbed `/api/events` + `/api/series`): defaults to the most recent event with `date ≤ today` (else the soonest upcoming) and calls `onSelect` once with it; options are newest-first, each `date · HH:MM · label` (time normalized to `HH:MM`); the event control has `aria-label="Event"`; an empty event list shows an empty state and selects nothing.
- [X] T003 [US1] Create `src/app/EventSelector.tsx` (props `{ value, onSelect }`): fetch `/api/events` (already descending) + `/api/series`; extract `toHHMM`/`eventLabel` from the check-in page; render the `Event` `<select>` with those options; compute + report the default once when `value` is empty; empty state. (Filters added in US2.)
- [X] T004 [P] [US1] Refactor `src/app/(door)/checkin/page.tsx` to use `<EventSelector value={eventId} onSelect={setEventId} />`, removing the inline `toHHMM`/`eventLabel`/default effect + `<select>`; keep the roster load keyed on `eventId`. `checkin.selector.test.tsx` must stay green unedited.
- [X] T005 [P] [US1] Refactor `src/app/(door)/gate/page.tsx` to use `<EventSelector value={eventId} onSelect={openDoorRecord} />` (the D2 handler opens/loads the door record), removing the inline `<select>`.
- [X] T006 [P] [US1] Refactor `src/app/(admin)/payments/page.tsx` to use `<EventSelector value={eventId} onSelect={loadEvent} />`, removing the inline `<select>`.
- [X] T007 [US1] Treasurer entry point: create `src/app/(admin)/treasurer/page.tsx` hosting `<EventSelector value={eventId} onSelect={setEventId} />` + the report (relocate the report-fetch/render from `[eventId]/page.tsx`, keyed on state); **delete** `src/app/(admin)/treasurer/[eventId]/page.tsx`; change `src/server/auth/nav.ts` `/treasurer/latest` → `/treasurer` (fixes the broken entry, FR-010).

**Checkpoint**: all four surfaces land on the right event with one shared control.

---

## Phase 3: User Story 2 — Filter by series and date range (P1)

**Goal**: The selector narrows by series and by a date range; the default/order apply within the filter.

**Independent Test**: With many events, apply a series filter and a date range and confirm the list narrows
accordingly, newest-first.

- [X] T008 [US2] Extend `tests/component/eventSelector.test.tsx`: a **series** filter shows only that series' events; a **from/to date range** shows only events in range; both keep newest-first ordering.
- [X] T009 [US2] Add to `src/app/EventSelector.tsx` a series `<select>` (from `/api/series`) and **from/to date inputs**, filtering the fetched event list **client-side**; the default is computed within the current (initially empty) filter. Filters reshape the option list only — they do **not** call `onSelect`.

**Checkpoint**: the selector scales — an older or specific-series event is quick to find.

---

## Phase 4: User Story 3 — Deliberate selection (P2)

**Goal**: The selection (and each surface's follow-on side effect) commits only on an explicit pick, never on
a filter change.

**Independent Test**: Adjust a filter without picking → the selected event does not change and no side effect
fires; pick an event → it commits once.

- [X] T010 [US3] Extend `tests/component/eventSelector.test.tsx`: adjusting the series/date filter does **not** call `onSelect`; only choosing an option in the `Event` `<select>` calls `onSelect` (exactly once). (Confirms the US2 wiring keeps filters separate from the committing control.)

**Checkpoint**: filtering never thrashes a surface's side effects (e.g. opening door records).

---

## Phase 5: User Story 4 — One consistent selector; each surface keeps its side effect (P2)

**Goal**: The same control behaves identically everywhere, and each surface's own follow-on action still fires
on selection.

**Independent Test**: Exercise the selector on each surface; confirm identical behavior and that each side
effect fires on the confirmed pick.

- [X] T011 [P] [US4] Write `tests/component/gate.eventSelector.test.tsx` (jsdom): selecting an event on the gate opens/loads that event's door record (the gate's own behavior), driven by the shared selector.
- [X] T012 [P] [US4] Write `tests/component/treasurer.page.test.tsx` (jsdom): `/treasurer` renders the selector + the report for the default event, and switching the selected event reloads the report. (Check-in stays covered by the preserved `checkin.selector.test.tsx`.)
- [X] T013 [P] [US4] Write `tests/component/payments.eventSelector.test.tsx` (jsdom): selecting an event on the payments page calls its `loadEvent` handler (loads that event's bookings/payments), driven by the shared selector — the payments analog of the gate/treasurer side-effect tests (analyze G1). (Or fold this assertion into the existing `payments.allocation.test.tsx`.)

**Checkpoint**: consistency across surfaces; side effects intact.

---

## Phase 6: Polish + cross-cutting

- [X] T014 Full gate (solo-maintainer mode): `pnpm exec tsc --noEmit`; `pnpm exec eslint <changed>`; `pnpm exec prettier --check <changed>`; `pnpm test` (incl. the generated `auth.routeInventory.test.ts`, which picks up the treasurer route change); `pnpm build`. All green.
- [X] T015 [P] Update `zak1_Phase5_Requirements.md`: mark **P5-R1 SHIPPED as feature 028** (shared filterable event selector on check-in/gate/payments/treasurer; in-page state, no deep links; treasurer now `/treasurer`); note B39 (reusable picker) is realized.

---

## Dependencies & execution order

- **T002 (test)** before **T003 (component)**; **T003** before the adoptions (T004–T007) and before the
  filter work (T009).
- **US2 (T008 → T009)** after the base component exists; **US3 (T010)** after filters (T009).
- **US4 tests (T011/T012/T013)** after the gate/treasurer/payments adoptions (T005/T007/T006).
- **Polish (T014/T015)** last.
- US1 (shared control + adoption) is the MVP; US2 (filters), US3 (confirm), US4 (consistency) build on it.

### Parallelizable

- **T002** [P]. Surface adoptions **T004/T005/T006/T007** [P] (distinct files, all after T003). US4 tests
  **T011/T012/T013** [P]. Docs **T015** [P]. (T003 and T009 both touch `EventSelector.tsx` → sequential.)

## Implementation strategy

Ship as **one atomic commit** once T014 is green. Build order: component test → base component → adopt on the
four surfaces (treasurer route restructured) → add filters → confirm-behavior test → per-surface side-effect
tests → full gate. No API/schema/migration; the load-bearing risks are the treasurer route change (covered by
the route-inventory test + `treasurer.page.test.tsx`) and check-in regression (prevented by preserving its
contract so its 025 test passes unedited).

## Summary

- **Total tasks**: 15 (Setup 1 · US1 6 · US2 2 · US3 1 · US4 3 · Polish 2)
- **Test tasks**: T002, T008, T010, T011, T012, T013
- **Parallel opportunities**: T002; T004/T005/T006/T007; T011/T012/T013; T015
- **MVP scope**: **US1** — the shared selector + adoption on all four surfaces (the user-visible "land on the
  right event"); US2/US3/US4 add filtering, confirm-safety, and consistency coverage.
