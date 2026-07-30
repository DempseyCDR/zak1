---
description: "Task list for feature 025 — door-attendant check-in experience"
---

# Tasks: Door-attendant check-in experience — roster corrections + selection & entry polish

**Input**: Design documents from `specs/025-door-checkin-experience/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/
**Tests**: INCLUDED — the constitution (v1.3.0, Principle I) mandates test-first.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: parallelizable (different files, no dependency on an incomplete task)
- **[Story]**: US1..US5 (from spec.md)
- Exact file paths included.

## Notes

Polish over 017 (check-in) + 016 (nav) plus the one new capability — per-record roster **correction**.
**No schema change, no migration**: the `attendance` table already carries `children_count`, `is_open_band`,
nullable `contact_id`, and `events.attendance_count` is already denormalized. Reuses 010 event groups,
`recordAttendance`'s dup/open-band guards, and 020's `toHHMM`. B41 (401→`/login`) already shipped as 022 → out
of scope. Ships as one atomic commit.

⚠️ **Shared-file serialization**: US1/US2/US3/US5 each edit `src/app/(door)/checkin/page.tsx`. Those page-edit
tasks (T009, T013, T017, T020) touch the **same file**, so they are **sequential** even though the stories are
otherwise independent. The *test* files and the *service/route* files are distinct and parallelizable.

---

## Phase 1: Setup

- [X] T001 No new infra — confirm **no migration is needed** (the `attendance`/`events`/`door_records` columns already exist) and that the jsdom component-test harness (`tests/setup.dom.ts`, feature 020) is present before writing component tests.

---

## Phase 2: User Story 1 — Correct a roster entry after the fact (P1) 🥇 MVP

**Goal**: The Door Attendant fixes any single roster entry from the roster — delete, edit children, reassign an
unmatched admission, toggle open-band, nudge comp/gift, or move to a same-group sibling — with the head count
staying exact.

**Independent Test**: On a mixed roster, perform each correction and assert the roster + `events.attendance_count`
(and `door_records` counts) reflect it and never drift from "present admissions + their children."

- [X] T002 [P] [US1] Write `tests/integration/attendance.corrections.test.ts`: check in matched (with children) + unmatched admissions; **delete** → row gone, `attendance_count -= (1+children)`; **edit children** → count moves by the delta; **reassign** unmatched → contact set, and reassigning to a contact already on the event is **refused** (no dup); **toggle open-band** on a community_dance row → `is_open_band` flips and `door_records.open_band_count` ±1, and toggling on for a non-community-dance event or a booked performer is **refused**; **comp/gift ±1** → `door_records.comp_count`/`gift_card_redemption_count` moves ±1, never below 0; **move** to a same-group sibling → source count down / target up by `(1+children)`; a move to a **non-sibling** event is **refused** (analyze L1); a move to a sibling where the dancer is **already checked in** is **refused** (no dup — analyze G1); and moving an **open-band** admission to a **non-community-dance** sibling **clears `is_open_band`** and **decrements the source `open_band_count`** (analyze G2). Assert no head-count drift across the sequence.
- [X] T003 [US1] Add Zod schemas to `src/server/validation/attendance.ts`: `attendancePatchSchema` (`{ childrenCount?: int≥0, contactId?: uuid, isOpenBand?: bool, eventId?: uuid }`, at least one field) and `doorCountAdjustSchema` (`{ count: 'comp'|'gift', delta: 1|-1 }`).
- [X] T004 [P] [US1] Add `getGroupSiblings(db, eventId)` to `src/server/domain/events/eventService.ts`: the **other** events sharing this event's non-null `group_id` (`{ id, eventDate, startTime, seriesKey, label }`); empty when ungrouped.
- [X] T005 [P] [US1] Add `adjustDoorCount(db, eventId, kind: 'comp'|'gift', delta: 1|-1, actor?)` to `src/server/domain/door/doorRecordService.ts`: `ensureDoorRecord` then move `comp_count`/`gift_card_redemption_count` by ±1 floored at 0; audited.
- [X] T006 [US1] Add `deleteAttendance` / `patchAttendance` / `moveAttendance` to `src/server/domain/attendance/attendanceService.ts`: keep `events.attendance_count` exact (delete `−(1+children)`, children edit `±delta`, move dec source / inc target by `(1+children)`); reassign uses `recordAttendance`'s dup guard; open-band toggle mirrors the community-dance + not-a-booked-performer guard and moves `door_records.open_band_count` ±1; move **re-derives** the sibling set server-side and refuses a non-sibling (never trusts the client), **also refuses when the dancer is already checked in on the target** (same dup guard as reassign — analyze G1), and **when moving an open-band admission to a non-community-dance target, clears `is_open_band` and decrements the source event's `open_band_count`** so no non-community-dance event carries an open-band admission and the count is never stranded (analyze G2); one transaction each, audited.
- [X] T007 [US1] Add routes: `PATCH` + `DELETE` `src/app/api/attendance/[id]/route.ts`; `GET` `src/app/api/events/[id]/group-siblings/route.ts`; `POST` `src/app/api/events/[id]/door-count/route.ts` — all `attendance.write`-scoped, Zod-validated.
- [X] T008 [P] [US1] Write `tests/component/checkin.correctionModal.test.tsx` (jsdom, stubbed fetch): clicking a roster row opens the correction modal; each action posts to the right endpoint (`PATCH`/`DELETE /api/attendance/[id]`, `POST /api/events/[id]/door-count`), the move lists group-siblings, and a dup/non-sibling refusal surfaces inline.
- [X] T009 [US1] Add the roster correction modal + make roster rows clickable in `src/app/(door)/checkin/page.tsx`: delete, edit children, reassign (contact search), open-band toggle, comp/gift ±1, and move (populated from `group-siblings`); refusals shown inline; refresh the roster + head count after each.

**Checkpoint**: the roster is correctable and the head count never drifts — the feature's core value.

---

## Phase 3: User Story 2 — Land on the right event without hunting (P1)

**Goal**: The check-in selector defaults to the most recent event ≤ today, lists events newest-first, and shows
enough detail to tell same-day events apart.

**Independent Test**: With events before/on/after today, open check-in → the selector pre-selects the most
recent event ≤ today, ordered descending, each option showing date + start time + label.

- [X] T010 [P] [US2] Write `tests/integration/events.ordering.test.ts`: `listEvents` returns events ordered by `event_date` then `start_time`, **descending**.
- [X] T011 [US2] Order `listEvents` by `desc(event_date), desc(start_time)` in `src/server/domain/events/eventService.ts` (today it has no `orderBy`).
- [X] T012 [P] [US2] Write `tests/component/checkin.selector.test.tsx` (jsdom): the selector defaults to the most recent event on or before today (today's if present, else latest past), lists descending, and renders each option as **date + start time + label** with the time shown `HH:MM`.
- [X] T013 [US2] In `src/app/(door)/checkin/page.tsx`: default-select the most recent event ≤ today, keep the descending order, and render each option label as date + start time (via 020 `toHHMM`) + label; carry `startTime` on the page's event type.

**Checkpoint**: Meg lands on the right event with no manual selection in the common case.

---

## Phase 4: User Story 3 — One-line check-in with everything on the row (P2)

**Goal**: comp/children/confirm on each candidate row (matched / new-contact / unmatched), children on the
anonymous path, and focus back to search after each confirm.

**Independent Test**: check in a matched person, a new contact, and an anonymous admission — each with children
— and confirm the options are inline, the children persist on every path (incl. unmatched), and focus returns
to search.

- [X] T014 [P] [US3] Write `tests/integration/attendance.unmatchedChildren.test.ts`: an **unmatched** admission with `childrenCount` lands the children in `events.attendance_count` (regression — was silently dropped).
- [X] T015 [US3] Relax the `unmatched` variant of `attendanceSchema` in `src/server/validation/attendance.ts` to accept `childrenCount` (the domain already reads it generically); open-band stays person-and-community-dance only.
- [X] T016 [P] [US3] Write `tests/component/checkin.inlineRow.test.tsx` (jsdom): comp/children/confirm render on each candidate row (matched / new-contact / unmatched); after a confirmed check-in, focus returns to the search box.
- [X] T017 [US3] In `src/app/(door)/checkin/page.tsx`: move comp/children/confirm inline onto each candidate row (retire the detached "This check-in" fieldset), carry children on the unmatched row, and `focus()` the search input in the post-confirm reset.

**Checkpoint**: the line moves faster and the anonymous path stops dropping children.

---

## Phase 5: User Story 4 — Reach staff tools from the home page (P2)

**Goal**: the role-aware staff nav appears on the home page when signed in.

**Independent Test**: signed in as a door attendant → the home page shows the staff nav (with Check-in),
distinct from the public content; anonymous → it does not.

- [X] T018 [P] [US4] Write `tests/component/home.staffNav.test.tsx` (jsdom): the home page renders the staff nav when a staff actor is present and omits it when anonymous.
- [X] T019 [US4] In `src/app/page.tsx`: render the role-aware `<Nav/>` (from `src/app/Nav.tsx`) when `getCurrentStaff()` is non-null, kept as a separate element from the public content (use the optional accessor, not `requireActor`).

**Checkpoint**: staff reach their tools from the landing page.

---

## Phase 6: User Story 5 — Retire the redundant "open door record" button (P3)

**Goal**: remove the vestigial manual door-record step from the check-in surface.

**Independent Test**: on a fresh event with no door record, the first check-in succeeds with no "open door
record" control present.

- [X] T020 [US5] Remove the "Open door record" button + `openDoorRecord` handler from `src/app/(door)/checkin/page.tsx` (the door record is ensured by `recordAttendance` on first check-in and by the gate); extend a check-in component test to assert the first check-in works on a fresh event with no such control.

**Checkpoint**: no internal setup step on Meg's surface.

---

## Phase 7: Polish + cross-cutting

- [X] T021 Full gate (solo-maintainer mode): `pnpm exec tsc --noEmit`; `pnpm exec eslint <changed>`; `pnpm exec prettier --check <changed>`; `pnpm test` (incl. `auth.routeInventory.test.ts` — the three new routes appear automatically and must be recognized); `pnpm build`. All green.
- [X] T022 [P] Update `zak1_Phase4_Requirements_v1.md` §7 to mark the **door-attendant experience SHIPPED as 025** and note **Phase 4 complete** (Areas A–D all delivered).

---

## Dependencies & execution order

- **US1 (T002–T009)** is the MVP and independent of the other stories; within it: schemas/service/routes
  (T003–T007) before the modal UI (T009); test T002 first, T008 before T009.
- **US2 (T011)** before its UI (T013); test T010/T012 first.
- **US3 (T015)** before its UI (T017); test T014/T016 first.
- **US4**: test T018 before T019.
- **US5 (T020)** is standalone (cleanup).
- ⚠️ **Shared file**: T009, T013, T017, T020 all edit `checkin/page.tsx` → run them **sequentially** in that
  order (do not parallelize across stories on this file).
- **Polish (T021/T022)** last.

### Parallelizable

- Test authoring: **T002, T008, T010, T012, T014, T016, T018** [P] (distinct files).
- Service/read tasks **T004, T005** [P] (different files from each other and from the validation task).
- **T022** [P] (docs).

## Implementation strategy

Ship as **one atomic commit** once T021 is green. Build order: US1 (corrections — schemas → group-siblings +
door-count → attendance mutations → routes → modal) → US2 (ordering + selector) → US3 (unmatched-children +
inline row) → US4 (home nav) → US5 (button removal) → full gate. No migration; the load-bearing risk is the
denormalized head count drifting on a correction — covered by T002's no-drift assertions across delete / edit /
move, plus the server-side sibling guard on the move.

## Summary

- **Total tasks**: 22 (Setup 1 · US1 8 · US2 4 · US3 4 · US4 2 · US5 1 · Polish 2)
- **Test tasks**: T002, T008, T010, T012, T014, T016, T018
- **Parallel opportunities**: the seven test files; T004/T005; T022
- **MVP scope**: **US1** (roster correction) — the one genuinely new capability; US2–US5 are polish layered on 017/016
