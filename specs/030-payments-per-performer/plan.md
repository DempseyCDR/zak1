# Implementation Plan: Payments page optimized for the per-performer check workflow (P5-R3)

**Branch**: `030-payments-per-performer` (solo-maintainer mode, constitution v1.3.0 — one atomic commit to
`main`) | **Date**: 2026-08-02 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/030-payments-per-performer/spec.md`

## Summary

Reorganize `/payments` around **one row per performer** for the event (default-selected by the shared 028
selector): each payable performer gets their own row showing role + booked amount, and the FS records a
**separate check per performer** — enter a check number and it books a payment to that performer for the
booked amount (or a typed amount). Non-paying bookings (donated / instructor / `$0`) show as **free** and
never as a gap. (Open-band musicians are comped attendees, not payments rows; only the open band's paid lead
musicians appear here.) The occasional one-check-many-bookings path moves into a **multi-apply popup**;
recorded payments are **edited inline**; a last-minute performer can be **added** (creates a booking, then a
check); and a booked-paid performer can be **donated at settlement** (`0`, no check → the booking flips to
donated). Rows commit **independently** (per-row, no batch save).

This is a **UI/UX redesign over the unchanged 023 payment substrate** — **no schema change, no migration**.
The only new backend is **two narrow settlement ops gated on `performer_payment.write`** (not `booking.write`):
donate-at-settlement and add-settlement-performer — because the FS/Treasurer deliberately do **not** hold
`booking.write`, yet both actions mutate a booking as part of paying out. Everything else reuses existing
endpoints: `createPerformerPayment` (per-row check, check-less, multi-apply), `patchPerformerPayment` (inline
edit), `voidPerformerPayment` (unchanged), and `getBookingsForEvent` (already carries `requiresCheck` /
`isDonated` — FR-012). The one small read addition: `listPerformerPayments` surfaces **`settledByBooking`**
(booking id → live settled cents, cross-event aware, from the already-computed `settledCentsByBookingForEvent`)
so a booking paid by a check recorded at **another** event classifies as paid, not outstanding (FR-016) — no
new query, no schema change; reconciliation math stays exactly as-is.

## Technical Context

**Language/Version**: TypeScript 5.7 (strictest) · Node 24 · pnpm

**Primary Dependencies**: Next.js 16.2.10 (App Router, RSC) · React 19.2 · Drizzle ORM · Zod. **No new
dependency.**

**Storage**: PostgreSQL 16 — **untouched**. No schema change, no migration. Reuses `bookings`
(`pay_cents`, `is_donated`, `requires_check`), `performer_payments`, `payment_bookings`.

**Testing**: Integration (node, real Postgres) for the two new domain ops — `donateBookingAtSettlement`
(flips `is_donated`/`pay_cents`/`requires_check`; scoped to the FS's series; refuses a live-paid or
already-donated booking) and `addSettlementPerformer` (creates a booking under payment-write; no duplicate).
Component (jsdom) for the payments page: per-performer rows + role/booked amount; check# → booked-amount
payment; typed amount; free rows have no check field and never read as a gap; the `0`-no-check donate confirm;
the positive-amount-no-check confirm **with comment box** (FR-014); multi-apply popup; inline edit; add-performer.

**Target Platform**: Web, single tenant, staff admin surface (`/payments`).

**Project Type**: Next.js App Router monolith; `/payments` is a client page over the read + payment APIs.

**Performance Goals**: Unchanged — admin-scale (a handful of performers per event); the page fetches the
event's bookings + payments once and renders rows client-side.

**Constraints**: Reuse the 023 substrate unchanged (per-line amounts, void, cross-event, reconciliation,
single-payee shared checks). The two new booking-mutating ops MUST be gated on **`performer_payment.write`**
(scoped, so an FS acts only on their series) and MUST **not** require `booking.write`. Per-row commit only —
no batch save. The check-less positive-amount path requires a confirmation + comment (stored as the payment
note). The donate flip requires a confirmation and refuses a live-paid booking.

**Scale/Scope**: 1 client page redesigned; 2 new narrow API routes + 2 domain ops + their Zod schemas + audit
kinds; reuse of 4 existing endpoints. No server reconcile change (expected already sums `pay_cents`, which is
0 for free/donated). ~6 acceptance-driving component tests + 2–3 integration tests.

## Constitution Check

*GATE: Must pass before Phase 0. Re-check after Phase 1.* Constitution v1.3.0 (principles I–IV).

| Principle | Verdict |
|---|---|
| **I. Test-First** | **PASS** — the two new domain ops get integration tests (real Postgres: donate flips the flags + is series-scoped + refuses live-paid/already-donated; add-settlement-performer creates a booking under payment-write and dedupes) and the page redesign gets jsdom component tests (rows, booked-amount default, free rows, donate confirm, check-less confirm+comment, multi-apply popup, inline edit, add-performer), all before implementation. |
| **II. YAGNI** | **PASS** — reuses the 023 substrate + 028 selector; the multi-apply popup is today's behavior relocated, not new; no schema/migration. The two new ops exist **only** because the authorization boundary requires them (see Complexity Tracking) — not speculative generality. |
| **III. Type Safety** | **PASS** — Zod at the two new route boundaries; typed domain views; the page consumes the already-typed `requires_check`/`is_donated` on the bookings view; no `any`. |
| **IV. Observability** | **PASS** — new audit kinds for the donate-at-settlement and add-settlement-performer mutations (a non-Booker changing a booking must be traceable); payment create/void already audited. |

**Development Workflow**: solo-maintainer mode — one atomic commit to `main`, full local gate as the reviewer.
Complies.

### Post-Design Re-Check

Re-evaluated after Phase 1: **still PASS.** No schema/migration; reconciliation is unchanged (free/donated
bookings contribute `pay_cents = 0` to expected already). The only new authority surface is the two narrow
`performer_payment.write`-gated ops, each scope-asserted like the existing payment create and picked up by the
route-inventory test.

## Project Structure

### Documentation (this feature)

```text
specs/030-payments-per-performer/
├── plan.md              # This file
├── research.md          # R1..R6 (decisions)
├── data-model.md        # no persistent change — reused fields + the donate state transition
├── quickstart.md        # per-story validation
├── contracts/
│   ├── settlement-donate.md          # POST /api/bookings/[id]/donate (payment-write, scoped)
│   ├── settlement-add-performer.md    # POST /api/events/[id]/settlement-performer (payment-write, scoped)
│   └── payments-page-rows.md          # per-row entry semantics over the reused payment endpoints
├── checklists/requirements.md         # complete (from /speckit-specify + /speckit-clarify)
└── tasks.md             # /speckit-tasks (NOT created here)
```

### Source Code (repository root)

```text
src/app/
├── (admin)/payments/page.tsx          MAJOR redesign: per-performer rows (role + booked), per-row check
│                                       entry (blank → booked; typed amount; check-less confirm+comment),
│                                       free rows (no check field), donate confirm, multi-apply popup,
│                                       inline edit, add-performer. Per-row independent commit.
├── api/bookings/[id]/donate/route.ts          (new) POST, requires performer_payment.write
└── api/events/[id]/settlement-performer/route.ts (new) POST, requires performer_payment.write
src/server/
├── domain/payments/performerPaymentService.ts  + `settledByBooking` on listPerformerPayments' return
│                                        (cross-event live settled cents per booking; from the existing
│                                        settledCentsByBookingForEvent — reconciliation math unchanged). FR-016.
├── domain/bookings/bookingService.ts   + donateBookingAtSettlement(db, bookingId, authz) — set is_donated,
│                                        pay_cents=0, requires_check=false; assert payment scope; refuse a
│                                        live-paid or already-donated booking (direct bookings update, not
│                                        via patchBooking — no band cascade, mirrors 024 H1); audit.
│                                        + addSettlementPerformer(db, eventId, {performerId, type}, authz) —
│                                        create a booking under payment-write scope; dedupe existing.
├── validation/performers.ts (or payments.ts)  + Zod schemas for the two new routes
└── lib/audit.ts                        + audit kinds: booking.donated, booking.settlement_added
tests/
├── integration/payments.settlementDonate.test.ts   (new) donate op: flips flags, series-scoped, guards
├── integration/payments.addSettlementPerformer.test.ts (new) creates booking under payment-write, dedupe
└── component/payments.perPerformer.test.tsx         (new/expanded) the page redesign acceptance tests
    (may split; the existing payments.allocation.test.tsx multi-apply assertions move into the popup path)
```

**Structure Decision**: No structural/domain change beyond two narrow settlement ops that bridge the
payment-write role to a booking mutation. The payments page is rebuilt around per-performer rows but keeps
consuming the existing read (`getBookingsForEvent`) and payment (`createPerformerPayment` /
`patchPerformerPayment` / `voidPerformerPayment`) endpoints; the multi-apply popup is the current
payee-dropdown + booking-checkbox UI relocated. Reconciliation is untouched.

## Complexity Tracking

> One justified deviation from the norm "a booking mutation requires `booking.write`".

| Deviation | Why needed | Simpler alternative rejected because |
|-----------|------------|--------------------------------------|
| Two booking-mutating ops (`donateBookingAtSettlement`, `addSettlementPerformer`) gated on **`performer_payment.write`**, not `booking.write` | FR-007/008 and FR-011: the FS settles money and must flip a booking to donated and add a last-minute performer **as part of paying out**, but the FS/Treasurer roles deliberately hold `performer_payment.write` (scoped) and **not** `booking.write` (only Booker/Super-user do). | Granting the FS full `booking.write` would let the money role edit/re-point/delete any booking on their series — far broader than "donate a fee at settlement" or "add a player who showed up". The narrow, scope-asserted, audited ops keep the blast radius to exactly the two settlement gestures. |
