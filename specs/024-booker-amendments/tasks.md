---
description: "Task list for feature 024 — booker amendments"
---

# Tasks: Booker amendments — lead cascade, band re-point, written-check discriminator

**Input**: Design documents from `specs/024-booker-amendments/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/
**Tests**: INCLUDED — the constitution (v1.3.0, Principle I) mandates test-first.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: parallelizable (different files, no dependency on an incomplete task)
- **[Story]**: US1..US4 (from spec.md)
- Exact file paths included.

## Notes

Booking-side amendments built on 023. **No schema change, no migration.** Reuses `bookBand`/`getRoster` (008),
`createBooking`/`deleteBooking`, the `bookingStatus` transition table, and 023's live-settlement. Ships as one
atomic commit. Out of scope: overlap reconciliation between old/new bands; B42; any change to the 023 substrate
or the treasurer/organizer reports.

---

## Phase 1: Setup

- [X] T001 No new infra — no migration, and the jsdom component-test harness (020) already exists. Confirm `tests/setup.dom.ts` is present before writing component tests.

---

## Phase 2: Foundational — the discriminator helper (blocks US2/US3)

- [X] T002 Add `bookingHasLivePayment(db, bookingId): Promise<boolean>` to `src/server/domain/payments/performerPaymentService.ts` — true iff a `payment_bookings` line for the booking belongs to a `performer_payments` row with `voided_at IS NULL` (reuses the 023 live-settlement join, scoped to one booking; a voided check does not count).

**Checkpoint**: the single source of "settled by a live check" exists.

---

## Phase 3: User Story 1 — A band lead's status moves the band (P1)

**Goal**: Changing a band lead's status cascades to lockstep members; diverged members untouched; non-lead independent.

**Independent Test**: advance the lead's status → lockstep members follow; a pre-declined member stays; a non-lead change moves no one.

- [X] T003 [P] [US1] Write `tests/integration/booking.leadCascade.test.ts`: book a band (lead + members via `bookBand`); advance the **lead** requested→confirmed and assert lockstep members → confirmed (pay/note unchanged); a member set to `declined` beforehand stays `declined`; changing a **non-lead** member changes no one.
- [X] T004 [US1] Implement the cascade in `patchBooking`'s status-transition branch (`src/server/domain/bookings/bookingService.ts`): when the patched booking is a band lead (`bandId != null` && `performerType === 'lead_musician'`) and its status changed, update sibling bookings (same `eventId`+`bandId`, not the lead) whose current status equals the lead's **previous** status → the lead's new status. Status only; audited. The re-point branch does NOT cascade.

**Checkpoint**: the lead drives the band.

---

## Phase 4: User Story 3 — The written-check discriminator (P1) 🥇 before US2 (band re-point uses it)

**Goal**: A paid booking can't be re-pointed/cleared; `substitutePerformer` keeps the no-show + adds a fresh sub booking; unpaid/voided re-points cleanly.

**Independent Test**: re-point/clear an unpaid booking (ok) and a live-paid one (refused); voided → ok; `substitutePerformer` both branches.

- [X] T005 [P] [US3] Write `tests/integration/booking.substituteDiscriminator.test.ts`: re-pointing (`patchBooking` performerId) and clearing (`deleteBooking`) a booking with a **live** payment is **refused**; with no payment (or only a **voided** one) it succeeds; `substitutePerformer` on an unpaid booking re-points the slot, on a paid booking sets the original `declined` and creates a new booking for the sub. **(analyze H1)** Also assert that substituting a **paid no-show LEAD** sets that lead's booking `declined` but does **NOT** cascade-decline the other band members (the internal decline bypasses the FR-001 cascade).
- [X] T006 [US3] Guard `patchBooking` (re-point branch) and `deleteBooking` in `src/server/domain/bookings/bookingService.ts`: refuse (validation error naming "settled by a live check") when `bookingHasLivePayment` is true.
- [X] T007 [US3] Add `substitutePerformer(db, bookingId, newPerformerId, actor?, authz?)` to `bookingService.ts`: unpaid → re-point the slot (existing reset path); paid → set the original booking `declined` (no-show) **directly** (a plain `bookings` update — NOT via the cascade-bearing status path, so substituting a no-show lead does not decline the band — analyze H1) + `createBooking` a fresh slot for the sub (same `performer_type`); audited.
- [X] T008 [US3] Add `POST /api/bookings/[id]/substitute` route (`booking.write`) with a `{ newPerformerId }` Zod schema in `src/server/validation/`.

**Checkpoint**: the discriminator protects paid bookings; substitution is one safe operation.

---

## Phase 5: User Story 2 — Re-point a whole band (P1)

**Goal**: Swap the event's band for another — remove unpaid outgoing, keep paid as no-show, book the incoming roster fresh.

**Independent Test**: `repointBand(evt, A, B)` → event carries B's roster fresh, A's unpaid bookings gone, any paid A member kept `declined`.

- [X] T009 [P] [US2] Write `tests/integration/bandRepoint.test.ts`: book band A on an event, `repointBand(evt, A, B)`; assert B's roster is booked fresh (`proposed`, standard rates, lead = `lead_musician`), A's unpaid bookings are removed, and an A member settled by a **live** check is kept as `declined`; non-band bookings (caller) untouched.
- [X] T010 [US2] Implement `repointBand(db, eventId, fromBandId, toBandId, actor?, authz?)` in `src/server/domain/bookings/bandRepoint.ts`: per outgoing `fromBandId` booking, remove if unpaid / set `declined` **directly** (a plain update, bypassing the lead cascade — analyze H1) if `bookingHasLivePayment`; act **only on `fromBandId`** (other bands / non-band bookings untouched — analyze L1); then `bookBand(eventId, toBandId)` for the incoming roster; one transaction, audited.
- [X] T011 [US2] Add `POST /api/events/[id]/repoint-band` route (`booking.write`) with a `{ fromBandId, toBandId }` Zod schema.

**Checkpoint**: a band swaps as a unit without orphaning a paid line.

---

## Phase 6: User Story 4 — Everyone who plays gets a booking (P2)

**Goal**: substitutes and guest sit-ins each have their own booking (appearance credit).

**Independent Test**: after a paid substitution and a guest sit-in, both appear as their own booking and in `getPerformer` history.

- [X] T012 [US4] Write `tests/integration/booking.playedGetsBooking.test.ts`: a paid substitution (via `substitutePerformer`) leaves the sub with their **own** booking and the original as `declined`; a guest sit-in (`createBooking`) has their own booking; both show in the respective `getPerformer` appearance count.

**Checkpoint**: the person who played is always on the record.

---

## Phase 7: UI + Polish

- [X] T013 [P] Write `tests/component/bookingsReport.bandRepoint.test.tsx` (jsdom, stubbed fetch): the report/modal exposes a band re-point control (posts `repoint-band`) and a substitute action (posts `substitute`); a re-point refused as paid surfaces the inline "void it first / substitute" message.
- [X] T014 Add the affordances to `src/app/(admin)/bookings-report/page.tsx` + `src/app/(admin)/_modals/BookingModal.tsx`: a **band re-point** control (pick a new band) and a **substitute** action; surface the paid-refusal message inline. (The lead cascade needs no new UI — it rides the existing lead status change.)
- [X] T015 [P] Expose the **substitute add-booking** for the FS on `src/app/(door)/gate/page.tsx` (reuses the `substitute` route; `booking.write`).
- [X] T016 Full gate (solo-maintainer mode): `pnpm exec tsc --noEmit`; `pnpm exec eslint <changed>`; `pnpm exec prettier --check <changed>`; `pnpm test`; `pnpm build`. All green.
- [X] T017 [P] Update `zak1_Phase4_Requirements_v1.md` §7 to mark the **booker amendments SHIPPED as 024**; note Phase-4 remaining = Meg's door-attendant experience (Area C).

---

## Dependencies & execution order

- **T002** (discriminator helper) → US2 (T010) and US3 (T005–T007).
- **US1 (T004)** is independent of the helper (status cascade only) — can run any time after setup; test T003 first.
- **US3 (T006/T007)** before **US2 (T010)** — `repointBand` uses the same "keep paid as no-show" rule (both call `bookingHasLivePayment`); US3 also owns `substitutePerformer`.
- **UI (T014/T015)** after the service ops + routes (US2/US3) exist.
- Tests precede their impl within each story (T003→T004, T005→T007, T009→T010, T013→T014).
- **Polish (T016/T017)** last.

### Parallelizable

- Test authoring: **T003, T005, T009, T013** [P] (different files).
- **T015** [P] (gate, different file from the report); **T017** [P] (docs).

## Implementation strategy

Ship as **one atomic commit** once T016 is green. Build order: discriminator helper → lead cascade (US1) →
guardrail + `substitutePerformer` (US3) → `repointBand` (US2) → own-booking assertion (US4) → report/gate UI →
full gate. No migration; the risk is the discriminator being applied at every mutation that could orphan a paid
line (re-point, clear, band re-point) — covered by T005/T009.

## Summary

- **Total tasks**: 17 (Setup 1 · Foundational 1 · US1 2 · US3 4 · US2 3 · US4 1 · UI+Polish 5)
- **Test tasks**: T003, T005, T009, T012, T013
- **Parallel opportunities**: T003/T005/T009/T013; T015; T017
- **MVP scope**: US1 (lead cascade) + US3 (discriminator + substitute) is the safety-critical core; US2 (band re-point) and US4 build on it.
