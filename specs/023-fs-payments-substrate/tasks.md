---
description: "Task list for feature 023 — FS payments substrate"
---

# Tasks: Financial-Secretary payments substrate

**Input**: Design documents from `specs/023-fs-payments-substrate/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/
**Tests**: INCLUDED — the constitution (v1.3.0, Principle I) mandates test-first.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: parallelizable (different files, no dependency on an incomplete task)
- **[Story]**: US1..US5 (from spec.md)
- Exact file paths included.

## Notes

The largest Phase 4 feature: extends the 019 payment tables (per-line `amount_cents` + void columns), changes
the payment service (per-line, cross-event, void/reissue, settlement-from-live), re-keys the treasurer and
organizer reports, and updates the FS entry surface. Ships as one atomic commit. Changing the create input
(`bookingIds` → per-line `lines`) breaks existing callers/tests — they migrate in this feature (see Phase 9).
**Out of scope** (a later feature): the booking-side of substitution, the re-point-once-paid guardrail, the
lead cascade, band re-point; and B42 non-performer reimbursement.

---

## Phase 1: Setup

- [X] T001 Snapshot safety: capture `~/zak1_pre_0027.dump` from `zak1_dev` (source `.env` first), per the pre-backfill convention.

---

## Phase 2: Foundational — schema + migration (blocks all stories)

- [X] T002 Extend `src/server/db/schema/performerPayments.ts`: add `amountCents` (integer, NOT NULL) to `paymentBookings`; add `voidedAt` (timestamptz null), `voidReason` (text), `replacesPaymentId` (uuid self-FK) to `performerPayments`.
- [X] T003 Write migration `src/server/db/migrations/0027_payment_allocation_and_voids.sql`: add the columns (`payment_bookings.amount_cents` nullable first); backfill `amount_cents` (one-link payment → the payment total; multi-link → split by linked bookings' `pay_cents`, remainder to the first line so lines sum to the total — research R6); then `ALTER … SET NOT NULL`; add the void columns + self-FK.
- [X] T004 Apply to `zak1_dev` (`pnpm run db:migrate`) and verify: every `payment_bookings.amount_cents` is set and each payment's lines sum to its `amount_cents` (before/after check, like 021).

**Checkpoint**: columns present + backfilled; safe to build on.

---

## Phase 3: User Story 1 — Record a check + per-line allocation + note (P1)

**Goal**: The FS records a check (number, actual amount, note, event) with a line per booking it settles, each carrying its applied amount.

**Independent Test**: create a payment with `lines: [{ bookingId, amount }]` + note; the payment stores number/amount/note/event and the line stores `amount_cents`; total = Σ lines.

- [X] T005 [P] [US1] Write `tests/integration/paymentAllocation.test.ts`: create a payment with one line + `overrideReason`; assert the stored payment carries number/amount/note/event, the line carries `amount_cents`, and `performer_payments.amount_cents` = Σ line amounts (SC-002).
- [X] T006 [US1] Update `src/server/validation/payments.ts`: `performerPaymentCreateSchema` takes `lines: { bookingId: uuid, amount: number ≥0 }[]` (min 1) instead of `bookingIds` + top-level `amount`; add optional `replacesPaymentId`. `performerPaymentPatchSchema` takes `lines` (replaces the set). Keep `checkNumber`/`overrideReason`.
- [X] T007 [US1] Update `src/server/domain/payments/performerPaymentService.ts` `createPerformerPayment`: derive `amountCents` = Σ line amounts; insert `payment_bookings` rows **with** `amount_cents`; extend `PerformerPaymentView` (+ per-line amounts, void fields); keep `writeAudit`.

**Checkpoint**: a check records with its allocation lines.

---

## Phase 4: User Story 2 — One check, many bills, cross-event (P1)

**Goal**: One check settles multiple bookings (per-line amounts), and those bookings may belong to different events; payee may differ from the settled performers.

**Independent Test**: one check with lines settling two bookings from two events succeeds; payment event = the writing event, each line points to its own booking's event.

- [X] T008 [P] [US2] Write `tests/integration/paymentAggregation.test.ts`: (a) one check to a lead with lines settling 2+ members' bookings — payee = lead, per-line amounts sum to total; (b) **cross-event** — a check at event B with a line settling event A's booking succeeds; assert `performer_payments.event_id = B` and the line's booking event = A.
- [X] T009 [US2] Relax `assertBookingsForEvent` → `assertBookingsExist` in `performerPaymentService.ts` (and its use in create/patch): bookings must exist but MAY belong to any event (drop the `bookingEventMismatch` requirement here). Update/retire the `bookingEventMismatch` error if now unused.

**Checkpoint**: aggregation + cross-event settlement work.

---

## Phase 5: User Story 3 — Void and reissue (P1)

**Goal**: Void a check (persists, settles nothing); reissue links to it.

**Independent Test**: create → void (reason) → persists voided, booking's settled amount → 0; reissue with `replacesPaymentId` links; patch of a voided payment refused.

- [X] T010 [P] [US3] Write `tests/integration/paymentVoid.test.ts`: create → void with a reason → the payment persists with `voided_at`/`void_reason` and its booking's settled amount is 0; a reissue (create with `replacesPaymentId`) links to the voided one; patching a voided payment is refused; the event's **reconciliation excludes** the voided payment (analyze M1).
- [X] T011 [US3] Add void validation to `src/server/validation/payments.ts` (`{ reason: string min 1 }`); thread `replacesPaymentId` through create (Phase 3).
- [X] T012 [US3] In `performerPaymentService.ts`: add `voidPerformerPayment(id, reason)` (sets `voidedAt`/`voidReason`, audited); `createPerformerPayment` persists `replacesPaymentId`; `patchPerformerPayment` refuses when `voidedAt` is set; add a **settled-amount** helper = `Σ payment_bookings.amount_cents` over lines whose payment `voided_at IS NULL`. **Re-base reconciliation (analyze M1)**: update `src/server/domain/payments/reconcile.ts` and `listPerformerPayments` to **exclude voided** and reconcile an event by the **live per-line** amounts settling that event's bookings (not payments recorded at the event), so a cross-event check distorts neither event's delta; the treasurer/organizer deltas use the same.
- [X] T013 [US3] Add the void route (e.g. `POST /api/performer-payments/[id]/void`) with `withAuth({ requires: "performer_payment.write" })`.

**Checkpoint**: voids persist, never settle, and reissues link.

---

## Phase 6: User Story 4 — Treasurer per-event QBO view (P1)

**Goal**: The per-event treasurer report lists checks written there, each expandable to its per-line breakdown (incl. cross-event lines), with voided checks distinct.

**Independent Test**: an event with a normal check, a cross-event check, and a voided check → per-line breakdown incl. the cross-event line; voided shown distinctly.

- [X] T014 [P] [US4] Write `tests/integration/treasurer.paymentLines.test.ts`: at an event with a normal + a cross-event + a voided check, assert the treasurer view emits per-line rows (performer, booking, amount, account) including the cross-event line, and lists the voided check distinctly.
- [X] T015 [US4] Re-key `src/server/domain/treasurer/reportService.ts`: **drop** the `bookings.event_id = eventId` filter on the payment→booking links; emit **per-line** rows (per `payment_bookings` line: performer, booking, `amount_cents`, QBO account) instead of one aggregate line per check; separate **voided** checks; compute the reconciliation delta from **live** payments only.

**Checkpoint**: treasurer QBO view is per-line, cross-event-complete, voided-aware.

---

## Phase 7: User Story 5 — Organizer cost by incurred date (P2)

**Goal**: Organizer performer cost = one combined figure by performance date (paid actual + unpaid expected).

**Independent Test**: a delayed check → its cost lands on the performance event, not the writing event; an unpaid booking contributes its expected pay to the same combined figure; no paid/outstanding split shown.

- [X] T016 [P] [US5] Write `tests/integration/organizer.incurredCost.test.ts`: a delayed check (written at B) settling event A's booking → event A's organizer performer cost includes that amount and event B's does not (SC-005); an unpaid booking of an event contributes its expected pay to the combined figure (not $0); assert no paid/outstanding breakdown field.
- [X] T017 [US5] Re-key `src/server/domain/organizer/reportService.ts`: performer cost = `Σ` live `payment_bookings.amount_cents` whose booking belongs to the event, **plus** `Σ bookings.pay_cents` for the event's bookings with no live line — a single combined figure. Remove the plain `Σ bookings.pay_cents` performer-cost path.

**Checkpoint**: organizer costs are actual-by-incurred + outstanding, combined.

---

## Phase 8: FS entry surface (UI)

**Goal**: The FS records per-line checks and voids from the payments surface.

- [X] T018 [P] Write `tests/component/payments.allocation.test.tsx` (jsdom, stubbed fetch): entering a check with per-line amounts posts the `lines` payload; a void control posts the void.
- [X] T019 Update `src/app/(admin)/payments/page.tsx`: per-line amount inputs (one per settled booking), a total that reflects Σ lines, and void/reissue controls; post the new `lines`/void payloads.

**Checkpoint**: the FS can record allocation + voids in the UI.

---

## Phase 9: Cross-event delete guardrail (H1) + migrate callers + gate

- [X] T020 Migrate existing callers of the payment API to the per-line shape: `src/app/api/performer-payments/route.ts` (create/patch bodies), and the tests that construct payments — `tests/integration/event.delete.test.ts`, `performerPayments.test.ts`, `treasurer.paymentsCutover.test.ts`, `treasurer.performer-payments.test.ts`, `treasurer.report.test.ts` (swap `bookingIds` + `amount` → `lines: [{ bookingId, amount }]`, and update any aggregate-line assertions to per-line).
- [X] T021 [P] [US2] Write `tests/integration/eventDelete.crossEventPayment.test.ts` (analyze H1, FR-013): deleting an event whose booking is settled by a **live cross-event** payment (a check recorded at a *different* event) is **refused**; an event none of whose bookings has a live payment line is not blocked by this.
- [X] T022 [US2] Widen the `deleteEvent` guardrail in `src/server/domain/events/eventService.ts` (analyze H1, FR-013): also block when any of the event's bookings has a **live** payment line (`payment_bookings` → `performer_payments` with `voided_at IS NULL`), beyond the existing "payment recorded at this event" blocker — so a cross-event check's settled booking is never silently orphaned (preserves SC-002).
- [X] T023 Full gate (solo-maintainer mode): `pnpm exec tsc --noEmit`; `pnpm exec eslint <changed>`; `pnpm exec prettier --check <changed>`; `pnpm test`; `pnpm build`. All green.
- [X] T024 [P] Update `zak1_Phase4_Requirements_v1.md` §7 to mark the FS payments substrate **SHIPPED as 023** (migration 0027; per-line allocation + voids; **cross-event delete guardrail**; treasurer per-line; organizer combined-cost). Note the booker-side amendments remain the next (dependent) feature.

---

## Dependencies & execution order

- **T001–T004** (setup + schema + migration) → everything.
- **US1 (T006/T007)** is the base the other stories extend; **US2 (T009)**, **US3 (T011–T013)** build on the service; do US1 → US2 → US3 (same service file — sequential).
- **Reconciliation re-base (M1, folded into T012)** — exclude voided + reconcile by live per-line by booking event — must land **before** the report re-keys consume it.
- **US4 (T015)** and **US5 (T017)** depend on the settled-from-live helper + reconcile re-base (T012) and the schema (T002); the two report re-keys are independent of each other (different files) → **[P]** after US3.
- **UI (T019)** after the service/validation are per-line (US1–US3).
- **T022** (delete-guardrail widening, H1) depends on cross-event (T009) + the live-settlement helper (T012); **T021** (its test) precedes it.
- **T020** (migrate existing callers/tests) must land with the API change so **T023**'s `tsc`/suite is green.
- Tests precede their impl within each story (T005→T007, T008→T009, T010→T012, T014→T015, T016→T017, T018→T019, T021→T022).

### Parallelizable

- Test authoring: **T005, T008, T010, T014, T016, T018, T021** [P] (different files).
- After US3: the two report re-keys **T015 / T017** touch different files (sequenced only by the shared helper).
- **T024** [P] (docs).

## Implementation strategy

Ship as **one atomic commit** once T023 is green. Build order: schema+migration → payment service (per-line →
cross-event → void/reissue + settlement helper + **reconcile re-base**) → treasurer re-key → organizer re-key
→ UI → **cross-event delete guardrail** → migrate existing callers/tests → full gate. No partial delivery: the
API-shape change touches all consumers at once.

## Summary

- **Total tasks**: 24 (Setup 1 · Foundational 3 · US1 3 · US2 2 · US3 4 · US4 2 · US5 2 · UI 2 · Integrity+polish 5)
- **Test tasks**: T005, T008, T010, T014, T016, T018, T021 (+ migrated existing tests in T020)
- **Parallel opportunities**: the seven test-authoring tasks; T015/T017; T024
- **MVP scope**: US1–US3 (record + allocate + aggregate/cross-event + void, with live reconciliation and the cross-event delete guardrail) is the substrate MVP; US4/US5 are the report re-keys that make it visible to treasurer/organizer.
