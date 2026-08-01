---
description: "Task list for feature 026 — structured name capture when creating a performer (R5-P1)"
---

# Tasks: Consistent structured name capture when creating a performer (R5-P1)

**Input**: Design documents from `specs/026-structured-name-capture/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/
**Tests**: INCLUDED — the constitution (v1.3.0, Principle I) mandates test-first.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: parallelizable (different files, no dependency on an incomplete task)
- **[Story]**: US1..US2 (from spec.md)
- Exact file paths included.

## Notes

Capture-only fix — the one runtime route that mis-splits a name (`createPerformer`) is aligned to the
structured first/last/display shape the directory (012) and check-in (017) already use, reusing
`deriveContactNames`. **No schema change, no migration.** ⚠️ The create input contract changes (single
`displayName` → structured), so callers update in the same commit — the two create surfaces and the
`makePerformer` factory (which splits its convenience string so the existing suite stays green **and** now
produces structured contacts). Ships as one atomic commit. Out of scope: back-filling existing mis-split
contacts (R5-P2); the public join form; phones (R5-R6); dedup display (R5-R7).

---

## Phase 1: Setup

- [ ] T001 No new infra — confirm **no migration** (the `contacts` first/last/override/display/normalized columns already exist) and that the jsdom component-test harness (`tests/setup.dom.ts`, feature 020) is present. Note the input-contract change ripples to `makePerformer` (handled in T005).

---

## Phase 2: User Story 1 — Add a performer with a proper first and last name (P1) 🥇 MVP

**Goal**: Creating a performer captures structured first/last (+ optional display), the auto-created contact
stores them in their own fields, and the performer's display name is derived — indistinguishable from a
door/directory contact.

**Independent Test**: Create a brand-new performer with first + last; the created contact has first in
first-name and last in last-name (not the full name jammed into first-name) and a correct display name.

- [ ] T002 [P] [US1] Write `tests/integration/performer.nameCapture.test.ts`: `createPerformer` with `{ firstName: "Chuck", lastName: "Abell" }` → contact `first_name="Chuck"`, `last_name="Abell"`, `display_name="Chuck Abell"`, and the performer's `display_name="Chuck Abell"`; **mononym** `{ firstName: "Fiddlehead" }` → `last_name` null, sensible display, not blocked; **display override** `{ firstName:"Charles", lastName:"Abell", displayNameOverride:"Chuck Abell" }` → `display_name="Chuck Abell"` but `dedup_normalized` derives from "Charles Abell"; **link path** `{ contactId }` (existing contact) → no new contact created and the performer's `display_name` equals that contact's; **validation** neither `contactId` nor `firstName` → rejected; and **no existing contact is modified** by creating a performer — the pre-existing contact's stored names are unchanged (FR-007 guard — analyze V1).
- [ ] T003 [US1] Change `performerCreateSchema` in `src/server/validation/performers.ts`: replace the single required `displayName` with `firstName` (string) + `lastName?` + `displayNameOverride?`; keep `contactId?`/`email?`/`emailPurpose?`/`phone?`/`bio?`/`photoUrl?`; add a refinement — `contactId` present (link) **XOR** `firstName` present (create). Export the updated `PerformerCreateInput`.
- [ ] T004 [US1] Update `createPerformer` in `src/server/domain/performers/performerService.ts`: on the create path build the contact via `deriveContactNames({ firstName, lastName, displayNameOverride })` and store `first_name`/`last_name`/`display_name_override` + derived `display_name`/`name_normalized`/`dedup_normalized`; set `performers.display_name` = the derived display name; on the **link** path (`contactId`) fetch the contact and set `performers.display_name` from it (no contact created). Keep the email/phone seeding + `needs_review` behavior.
- [ ] T005 [US1] Adapt callers to the new contract (keeps the suite green): in `tests/integration/helpers/factories.ts`, `makePerformer(displayName)` splits its string on the last space into `{ firstName, lastName }` before calling `createPerformer` (single-word → firstName only); and update the direct `createPerformer({ displayName })` call(s) in `tests/integration/performers.contact.test.ts` to structured input.

**Checkpoint**: performer-created contacts are structured; the whole suite compiles and passes on the new contract.

---

## Phase 3: User Story 2 — Consistent capture across every add-performer surface (P1)

**Goal**: Both staff surfaces that create a brand-new performer present the same first/last/display fields; the
link-existing-contact path captures no name.

**Independent Test**: Create a new performer from the performers page and from the booking add-performer step;
both post structured names; linking an existing contact posts only `contactId`.

- [ ] T006 [P] [US2] Write `tests/component/performersPage.nameCapture.test.tsx` (jsdom, stubbed fetch): the performers-page create form shows first / last / display fields and POSTs `{ firstName, lastName, … }` to `/api/performers` (no single `displayName`).
- [ ] T007 [P] [US2] Write `tests/component/bookingModal.addPerformer.test.tsx` (jsdom, stubbed fetch): the add-performer **create-brand-new** step captures first/last and POSTs structured input; the **link existing contact** action POSTs only `{ contactId }` (no `displayName`).
- [ ] T008 [P] [US2] Update the create form in `src/app/(admin)/performers/page.tsx` to capture first / last / optional display and POST the structured input.
- [ ] T009 [P] [US2] Update `src/app/(admin)/_modals/BookingModal.tsx`: the "create brand-new performer" step captures first/last/display and POSTs structured input (replacing the single `displayName: q`); the add-existing-contact (`addPerformer`) POSTs only `{ contactId }` (+ the existing optionals), dropping the now-unused `displayName`.

**Checkpoint**: data quality no longer depends on which create surface was used.

---

## Phase 4: Polish + cross-cutting

- [ ] T010 Full gate (solo-maintainer mode): `pnpm exec tsc --noEmit`; `pnpm exec eslint <changed>`; `pnpm exec prettier --check <changed>`; `pnpm test` (the `makePerformer` factory now feeds structured names, so the whole suite exercises the corrected path); `pnpm build`. All green.
- [ ] T011 [P] Update `zak1_Phase5_Requirements.md`: mark **R5-P1 (structured name capture) SHIPPED as feature 026**; note R5-P2 (backfill of existing mis-split contacts) still pending.

---

## Dependencies & execution order

- **T003 (schema)** before **T004 (service)** and **T005 (factory/callers)** — both compile against the new
  input type.
- **T002 (test)** authored first (TDD); it compiles against the new schema and stays red until T004.
- **US2 UI (T008/T009)** after the server contract (T003/T004) exists; tests **T006/T007** before their UI.
- **Polish (T010/T011)** last.
- US1 (server contract + data) is the MVP; US2 (surfaces) builds on it.

### Parallelizable

- **T002** [P] (its own file). **T006, T007** [P] (distinct component-test files). **T008** (performers page)
  and **T009** (booking modal) are different files → both [P] relative to each other. **T011** [P] (docs).

## Implementation strategy

Ship as **one atomic commit** once T010 is green. Build order: US1 test → schema → service → factory/caller
adaptation (suite green) → US2 component tests → the two forms → full gate. No migration; the load-bearing
risk is the breaking input-contract ripple, contained by updating the factory + direct callers in the same
commit (T005) and covered by the full suite.

## Summary

- **Total tasks**: 11 (Setup 1 · US1 4 · US2 4 · Polish 2)
- **Test tasks**: T002, T006, T007
- **Parallel opportunities**: T006/T007; T008; T011
- **MVP scope**: **US1** (structured server contract + data) — the correctness core; US2 aligns the surfaces.
