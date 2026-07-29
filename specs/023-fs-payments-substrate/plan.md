# Implementation Plan: Financial-Secretary payments substrate

**Branch**: `023-fs-payments-substrate` (solo-maintainer mode, constitution v1.3.0 — one atomic commit to
`main`) | **Date**: 2026-07-28 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/023-fs-payments-substrate/spec.md`

## Summary

Extend the feature-019 payment tables so the Financial Secretary can record checks the way she writes them —
**per-line allocation** of a check across the bookings it settles, and **voids/reissues** — and re-key the
treasurer and organizer reports so each reads the money from the correct end. The load-bearing discoveries
from the code: (1) `assertBookingsForEvent` currently **forbids** a payment settling a booking from another
event, which directly blocks the cross-event delayed-check story (FR-003) — it must relax to
"bookings exist" (the payment keeps its recorded-at `event_id`); (2) the treasurer report **filters payment
lines to same-event bookings**, so a cross-event check's line is dropped — it must widen and show a **per-line
breakdown**; (3) the **organizer** report computes performer cost from **expected** `bookings.pay_cents`, not
actual payments — FR-009 moves it to the **live per-line actual amounts by the booking's event** (with an
accrual decision for unpaid bookings, research R5). New persistence: `payment_bookings.amount_cents` and
`performer_payments` void columns, via one migration with a backfill. **Out of scope** (a later, dependent
feature): the booking-side of substitution, the re-point-blocked-once-paid guardrail, the lead cascade, and
band re-point; and B42 non-performer reimbursement.

## Technical Context

**Language/Version**: TypeScript 5.7 (strictest) · Node 24 · pnpm

**Primary Dependencies**: Next.js 16.2.10 (App Router, RSC) · React 19.2 · Drizzle · Zod. **No new runtime
dependency.**

**Storage**: PostgreSQL 16. One additive migration **`0027_payment_allocation_and_voids.sql`**:
`payment_bookings.amount_cents` (integer, NOT NULL — **backfilled**); `performer_payments.voided_at`,
`void_reason`, `replaces_payment_id` (self-FK). Backfill each existing `payment_bookings` line's amount from
its payment (one-link payments → the payment total; multi-link → split by the linked bookings' `pay_cents`,
remainder to the first — research R6).

**Testing**: Integration (node, real Postgres) for every domain change — per-line allocation + sum
reconciliation, **cross-event** settlement, **void** + settlement exclusion + reissue link, treasurer per-line
+ voided rendering, organizer actual-by-incurred re-key. Component tests (jsdom, 020 harness) for the FS
entry surface. No third-party boundary here.

**Target Platform**: Web, single tenant, staff FS/treasurer/organizer surfaces + the door money surface.

**Project Type**: Next.js App Router monolith; domain under `src/server/`, UI under `src/app/`.

**Performance Goals**: Admin-scale; per-event aggregation over a handful of payments — trivial.

**Constraints**: Money is integer cents. Per-line amounts of a check reconcile to its total. **Voided payments
never settle a booking.** Treasurer per-event keys on **recorded-at**; organizer on **incurred** (booking)
event. **No booking-less lines** (B42 out). Public/confirmed display unchanged. Existing suite stays green.

**Scale/Scope**: 1 migration; 2 table extensions; payment service (create/void/reissue/patch + relaxed
constraint + settlement helper); validation (per-line + void); treasurer + organizer report re-keying; an FS
entry surface; a substantial test set. The largest Phase 4 feature.

## Constitution Check

*GATE: Must pass before Phase 0. Re-check after Phase 1.* Constitution v1.3.0 (principles I–IV).

| Principle | Verdict |
|---|---|
| **I. Test-First** | **PASS** — each behavior lands test-first against real Postgres: per-line allocation + sum check, cross-event settlement (the relaxed constraint), void → not-settled + reissue link, treasurer per-line + voided-distinct, organizer actual-by-incurred (incl. the unpaid/accrual case per R5). The FS entry surface gets jsdom component tests. |
| **II. YAGNI** | **PASS** — reuses the 019 tables; adds only a per-line amount and void columns; no booking-less lines; the booker-side amendments are explicitly a separate feature. No speculative generalization. |
| **III. Type Safety** | **PASS** — the payment input becomes typed allocation **lines** (`{ bookingId, amount }`) and a typed void input, Zod-validated at the boundary; exhaustive; no `any`. |
| **IV. Observability** | **PASS** — create, allocate, void, reissue, and patch all go through `writeAudit` (the service already audits create/update/delete). |

**Development Workflow**: solo-maintainer mode — one atomic commit to `main`, full local gate suite as the
reviewer. Complies.

### Post-Design Re-Check

Re-evaluated after Phase 1: **still PASS.** No new table (extends two existing), no new pattern, no unlogged
mutation. The one behavioral shift (organizer expected→actual) is a spec requirement (FR-009), not a
constitution deviation; its accrual sub-decision is resolved in research R5, not left open.

## Project Structure

### Documentation (this feature)

```text
specs/023-fs-payments-substrate/
├── plan.md              # This file
├── research.md          # R1..R7 (decisions)
├── data-model.md        # payment_bookings +amount_cents; performer_payments +void; migration 0027
├── quickstart.md        # per-story validation
├── contracts/
│   ├── payment-write.md         # create (per-line) / void / reissue / patch
│   └── report-rekeying.md       # treasurer per-line + voided; organizer actual-by-incurred
├── checklists/requirements.md   # complete (from /speckit-specify)
└── tasks.md             # /speckit-tasks (NOT created here)
```

### Source Code (repository root)

```text
src/
├── server/
│   ├── db/
│   │   ├── schema/performerPayments.ts   +amount_cents on payment_bookings; +void cols on performer_payments
│   │   └── migrations/0027_payment_allocation_and_voids.sql   add cols + backfill amount_cents
│   ├── validation/payments.ts            per-line allocation input `{ bookingId, amount }[]`; void input
│   ├── domain/payments/
│   │   ├── performerPaymentService.ts     per-line writes; relax same-event constraint; voidPayment + reissue
│   │   ├── reconcile.ts                    settlement from LIVE per-line amounts (exclude voided)
│   │   └── settlement.ts (new, optional)   "amount settled per booking" helper (live lines)
│   ├── domain/treasurer/reportService.ts  per-check → per-LINE breakdown; include cross-event lines; voided distinct
│   ├── domain/organizer/reportService.ts  performer cost = live per-line actual by booking event (R5)
│   └── domain/events/eventService.ts      widen delete guardrail: block on a LIVE cross-event payment line (H1)
├── app/(admin)/payments/page.tsx          FS entry: per-line amounts + void/reissue controls
├── app/(door)/gate/page.tsx               (option) surface FS check entry here per the draft (R7)
└── tests/{integration,component}/         see research R for the test set
```

**Structure Decision**: No structural change — the established monolith. Work extends the 019 payment domain
and the two report services, adds validation + migration, and an entry surface. Reuses feature 021's
single-check-store and the 019 tables.

## Complexity Tracking

> No entries. No constitution deviation. The feature is large by breadth (schema + service + two reports +
> UI), not by architectural novelty; every piece extends an existing 019/020 pattern.
