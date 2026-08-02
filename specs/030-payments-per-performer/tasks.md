---
description: "Task list for feature 030 — payments page per-performer check workflow (P5-R3)"
---

# Tasks: Payments page optimized for the per-performer check workflow (P5-R3)

**Input**: Design documents from `specs/030-payments-per-performer/`
**Prerequisites**: plan.md, spec.md (clarified), research.md, data-model.md, contracts/
**Tests**: INCLUDED — the constitution (v1.3.0, Principle I) mandates test-first.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: parallelizable (different files, no dependency on an incomplete task)
- **[Story]**: US1..US6 (from spec.md)
- Exact file paths included.

## Notes

A **UI/UX redesign over the unchanged 023 substrate** — **no schema, no migration**. Per-performer rows over
the existing read (`getBookingsForEvent`, already carries `requires_check`/`is_donated`) and payment endpoints
(`createPerformerPayment` / `patchPerformerPayment` / `voidPerformerPayment`). The only new backend is **two
narrow settlement ops gated on `performer_payment.write`** (the FS/Treasurer deliberately lack `booking.write`):
`donateBookingAtSettlement` (US3) and `addSettlementPerformer` (US6).

⚠️ **Shared file**: `src/app/(admin)/payments/page.tsx` is edited by the foundational row model and by US1,
US2, US3-wiring, US4, US5, US6-wiring — those page tasks are **sequential on that file** (not `[P]` with each
other). Backend ops/routes (`bookingService.ts`, the two `route.ts`, validation) and every test file are
distinct → `[P]`. `bookingService.ts` gains two ops (US3 + US6) → those two are sequential with each other.

⚠️ **MVP = US1 + US2** (both P1): the per-performer rows with correct payable-vs-free classification.

---

## Phase 1: Setup

- [X] T001 Confirm **no schema/migration**; note the reuse points and new surfaces: read `getBookingsForEvent` (returns `payCents`/`isDonated`/`requiresCheck`/`performerType`/`performerName`) via `GET /api/events/[id]/bookings`; payments via `POST /api/performer-payments` (`createPerformerPayment`), `PATCH /api/performer-payments/[id]` (`patchPerformerPayment`), `POST /api/performer-payments/[id]/void`; reconciliation via `GET /api/events/[id]/performer-payments`. New: `POST /api/bookings/[id]/donate` + `POST /api/events/[id]/settlement-performer`, both `performer_payment.write` (FS lacks `booking.write`). New audit kinds `booking.donated`, `booking.settlement_added`.

---

## Phase 2: Foundational (blocks all rendering stories)

- [X] T002a In `src/server/domain/payments/performerPaymentService.ts`, add **`settledByBooking`** (a `Record<string, number>` of booking id → LIVE settled **cents**, cross-event aware) to `listPerformerPayments`'s return, built from the **already-computed** `settled` map (`settledCentsByBookingForEvent`) over `bookingRows` — `Object.fromEntries(bookingRows.map((b) => [b.id, settled.get(b.id) ?? 0]))`. Reconciliation math is unchanged. The route (`events/[id]/performer-payments/route.ts`) returns the whole object → no route change. (FR-016; enables cross-event paid classification.)
- [X] T002b In `src/app/(admin)/payments/page.tsx`, widen the consumed booking type to include `payCents`, `requiresCheck`, `isDonated`, `performerType` (already returned by the bookings endpoint — FR-012), consume `settledByBooking`, and assemble a **per-performer row model** with **four** states (FR-016): **free** (`requiresCheck === false`); **paid-here** (a live payment line for the booking in *this* event's `payments`); **settled-elsewhere** (`settledByBooking[id] > 0` but no local line → paid, no new-check row, no inline edit here); **payable-outstanding** (`requiresCheck === true` and `settledByBooking[id] === 0`). This row model is what US1/US2/US4/US5/US6 render.

**Checkpoint**: the page classifies every booking into free / paid-here / settled-elsewhere / outstanding — a cross-event-settled booking never reads as outstanding.

---

## Phase 3: User Story 1 — Record a separate check per performer (P1) 🥇 MVP

**Goal**: One row per payable performer (role + booked amount); entering a check number records a payment to
that performer for the booked amount (or a typed amount); rows commit independently.

**Independent Test**: On a selected event with several payable performers, enter a check number on one row
(blank amount) → a payment to that performer for the booked amount is recorded, no payee selection / no
booking checkbox.

- [X] T003 [P] [US1] Write `tests/component/payments.perPerformer.test.tsx` (jsdom, stubbed fetch): payable rows render with role + booked amount; check# + blank amount → `POST /api/performer-payments` with `payeePerformerId = the row's performer`, single line `[{ bookingId, amount = booked }]`; check# + explicit amount → that amount; an untouched row records nothing and stays outstanding; each row commits independently (recording one does not post the others); a **positive amount with no check number** opens a confirm dialog **with a comment box** and, on confirm, posts `checkNumber: null` + `overrideReason = comment` (FR-002/003/004/005/014/015).
- [X] T004 [US1] In `src/app/(admin)/payments/page.tsx`, render payable rows with per-row check# + amount inputs; resolve blank amount → booked `payCents` client-side; record each via `createPerformerPayment` (payee = row performer, single line); per-row independent commit; refresh that row to **paid**. Remove the old payee-dropdown + booking-checkbox as the default surface (relocated in US4).
- [X] T005 [US1] In `src/app/(admin)/payments/page.tsx`, add the **positive-amount-no-check** confirmation dialog with a free-text comment box (FR-014); on confirm, record a check-less payment (`checkNumber: null`, `overrideReason = comment`).

**Checkpoint**: Mary records a per-performer check in one row entry; T003 green.

---

## Phase 4: User Story 2 — Non-paying bookings never prompt a check or read as a gap (P1)

**Goal**: Donated / instructor / `$0` bookings show as **free** (no check field), excluded from payments due
and the outstanding gap. (Open-band musicians are comped attendees — not rows.)

**Independent Test**: Add a donated performer and an instructor → both render free with no check field and
neither counts toward payments due or the gap.

- [X] T006 [P] [US2] Write `tests/component/payments.freeRows.test.tsx` (jsdom): a donated booking and an instructor (and any `$0` booking) render as **free** with **no check field**, labelled donated vs. free-by-rule (from `isDonated`), and are **excluded** from the payments-due / outstanding tally; the reconciliation/gap reflects only check-requiring bookings (FR-006/013, SC-002). **Also (FR-016)**: a check-requiring booking whose `settledByBooking[id] > 0` but which has **no** payment line in this event's `payments` (a cross-event check) renders as **paid/settled**, **not** outstanding, and offers no new-check row.
- [X] T007 [US2] In `src/app/(admin)/payments/page.tsx`, render **free** rows (`requiresCheck === false`) distinctly (no check field; donated vs. free label from `isDonated`) and exclude them from the outstanding/payments-due tally.

**Checkpoint**: the roster reads complete but only payable bookings ask for a check; T006 green.

---

## Phase 5: User Story 3 — Last-minute donation at settlement (P2)

**Goal**: `0` + no check# on a paid-booked row flips the booking to **donated** via an FS-permitted settlement
action (payment-write, not booking-write); appearance kept, no gap.

**Independent Test**: On a paid-booked row, enter `0` + no check#, confirm → the booking becomes donated
(expected drops, appearance kept, no gap); works with `performer_payment.write` and without `booking.write`.

- [X] T008 [P] [US3] Write `tests/integration/payments.settlementDonate.test.ts` (node, real Postgres): `donateBookingAtSettlement` flips `is_donated=true`/`pay_cents=0`/`requires_check=false`; is **series-scoped** (an FS out of scope is refused); **refuses** a booking with a live payment (void-first) and an already-donated booking; writes the `booking.donated` audit.
- [X] T009 [P] [US3] Write `tests/component/payments.donateAtSettlement.test.tsx` (jsdom): entering `0` + no check# on a paid row opens a confirm; on confirm it calls `POST /api/bookings/[id]/donate` and the row re-renders **free** (FR-007/008 UI).
- [X] T010 [US3] Add `donateBookingAtSettlement(db, bookingId, authz)` to `src/server/domain/bookings/bookingService.ts`: assert payment scope for the booking's event (reuse the payment scope assertion); refuse live-paid (`bookingHasLivePayment`) / already-donated; **direct `bookings` update** (`is_donated=true`, `pay_cents=0`, `requires_check=false`; status unchanged, no band cascade — mirrors 024 H1); write `booking.donated` audit.
- [X] T011 [P] [US3] Add the Zod schema (if any body) and route `src/app/api/bookings/[id]/donate/route.ts` — `POST`, `withAuth({ requires: "performer_payment.write" })`, calls `donateBookingAtSettlement`; returns the updated booking view.
- [X] T012 [US3] In `src/app/(admin)/payments/page.tsx`, wire a row's `0` + no-check entry → confirm → call the donate route → refresh the row to **free**.

**Checkpoint**: the FS donates a fee at settlement without booking-write; T008/T009 green.

---

## Phase 6: User Story 4 — Occasional shared check across performers (P2)

**Goal**: A popup records **one check to a single payee** settling **multiple** bookings (today's behavior,
relocated).

**Independent Test**: Open the multi-apply popup, pick a payee + two bookings with amounts, record → one
payment settles both.

- [X] T013 [P] [US4] Adapt `tests/component/payments.allocation.test.tsx` (the existing per-line + void test) to drive the multi-apply **popup**: open the control, pick a payee + two bookings with amounts, record → `POST /api/performer-payments` with several lines and that payee; void still works (FR-009).
- [X] T014 [US4] In `src/app/(admin)/payments/page.tsx`, move the current payee-dropdown + booking-checkbox + "Record check" UI into a **popup/modal** opened by a button (one check → many bookings, single payee).

**Checkpoint**: the occasional shared check is available as the exception; T013 green.

---

## Phase 7: User Story 5 — Correct an existing payment inline (P2)

**Goal**: Click a paid row to edit its **paid amount** and **check number** in place; **void** unchanged.

**Independent Test**: Click a paid row, change amount + check#, save → the payment updates in place.

- [X] T015 [P] [US5] Write `tests/component/payments.inlineEdit.test.tsx` (jsdom): clicking a **paid** row opens an inline edit of amount + check number; saving calls `PATCH /api/performer-payments/[id]` with the new values; the existing **void** action remains available (FR-010).
- [X] T016 [US5] In `src/app/(admin)/payments/page.tsx`, make a paid row click-to-edit (amount + check#) via `patchPerformerPayment`; keep the void action unchanged.

**Checkpoint**: corrections don't require delete + re-create; T015 green.

---

## Phase 8: User Story 6 — Add a last-minute performer and pay them (P3)

**Goal**: An add-performer control creates a booking for an unbooked performer (payment-write, dedupe), then
records their per-performer check.

**Independent Test**: Add a performer not booked → a booking is created for them on the event and their row
accepts a check.

- [X] T017 [P] [US6] Write `tests/integration/payments.addSettlementPerformer.test.ts` (node, real Postgres): `addSettlementPerformer` creates a booking for a performer on the event under **payment scope** (works with `performer_payment.write`); **dedupes** — a performer already booked returns the existing booking, no duplicate; audit written.
- [X] T018 [P] [US6] Write `tests/component/payments.addPerformer.test.tsx` (jsdom): the add-performer control (performer search + role) calls `POST /api/events/[id]/settlement-performer`, then the new row records a check via the per-row path (FR-011).
- [X] T019 [US6] Add `addSettlementPerformer(db, eventId, { performerId, performerType }, authz)` to `src/server/domain/bookings/bookingService.ts`: assert payment scope for the event; create the booking (reuse `createBooking`'s pay/requiresCheck derivation); dedupe on `(event_id, performer_id)`; write `booking.settlement_added` audit. (Sequential after T010 — same file.)
- [X] T020 [P] [US6] Add the Zod schema + route `src/app/api/events/[id]/settlement-performer/route.ts` — `POST`, `withAuth({ requires: "performer_payment.write" })`, body `{ performerId, performerType }`, calls `addSettlementPerformer`; returns the booking view.
- [X] T021 [US6] In `src/app/(admin)/payments/page.tsx`, add the add-performer control (performer typeahead + role select) → create the booking → render the new per-performer row (ready to record a check).

**Checkpoint**: a walk-in can be added and paid; T017/T018 green.

---

## Phase 9: Polish + cross-cutting

- [X] T022 Full gate (solo-maintainer mode): `pnpm exec tsc --noEmit`; `pnpm exec eslint <changed>`; `pnpm exec prettier --check <changed>`; `pnpm test` (full suite green — incl. the generated `auth.routeInventory.test.ts`, which picks up the two new routes; reconciliation unchanged); `pnpm build`. All green.
- [X] T023 [P] Update `zak1_Phase5_Requirements.md`: mark **P5-R3 SHIPPED as feature 030** (payments page per-performer workflow; two narrow payment-write settlement ops; no migration).

---

## Dependencies & execution order

- **Setup (T001)** → **Foundational (T002a → T002b)** → the story phases.
- **T002a** (service `settledByBooking`) → **T002b** (page row model) — sequential (T002b consumes the field).
- **T002b (row model)** blocks every rendering story (US1/US2/US4/US5/US6) — do it first.
- Within each story, the **test task precedes** its implementation (constitution I). US3 and US6 add backend
  (ops + routes) before their page wiring.
- **US1 → US2**: US2's free rows build on the US1/T002 row model (do US1 first; US2 is still independently
  testable via free bookings).
- **US3/US6 backend** (`bookingService.ts` ops, route files) is independent of the page tasks and can proceed
  in parallel with page work — except `donateBookingAtSettlement` (T010) and `addSettlementPerformer` (T019)
  share `bookingService.ts` → sequential with each other.
- **Polish (T022/T023)** last.

### Parallelizable

- All **test files** are distinct → `[P]`: T003, T006, T008, T009, T013, T015, T017, T018.
- **Route files** are distinct → `[P]`: T011, T020.
- **Docs** T023 `[P]`.
- **Not `[P]`**: every `src/app/(admin)/payments/page.tsx` task (T002b, T004, T005, T007, T012, T014, T016,
  T021) — same file, sequential; T002a → T002b (field dependency); and T010/T019 — same `bookingService.ts`.

## Implementation strategy

Ship as **one atomic commit** once T022 is green. Build order: foundational row model → US1 (record per
performer) + US2 (free rows) = the MVP → US3 (donate op + route + wiring) → US4 (multi-apply popup) → US5
(inline edit) → US6 (add-performer op + route + wiring) → full gate → doc. No schema/migration; the load-
bearing risks are (1) the two narrow payment-write booking mutations (covered by integration tests asserting
scope + guards) and (2) correct free-vs-outstanding classification (covered by the US1/US2 component tests).

## Summary

- **Total tasks**: 24 (Setup 1 · Foundational 2 · US1 3 · US2 2 · US3 5 · US4 2 · US5 2 · US6 5 · Polish 2)
- **Per user story**: US1 = 3 (T003–T005) · US2 = 2 (T006–T007) · US3 = 5 (T008–T012) · US4 = 2 (T013–T014)
  · US5 = 2 (T015–T016) · US6 = 5 (T017–T021)
- **FR-016 (cross-event paid classification)**: T002a (service field) + T002b (four-way classification) + T006
  (assertion)
- **Test tasks**: T003, T006, T008, T009, T013, T015, T017, T018 (2 integration, 6 component)
- **Parallel opportunities**: the 8 test files; the 2 route files (T011/T020); docs (T023)
- **MVP scope**: **US1 + US2** — per-performer rows with correct payable-vs-free classification (the everyday
  "record a check per performer" plus a trustworthy reconciliation gap). US3–US6 layer on donation, shared
  checks, inline edit, and add-performer.
