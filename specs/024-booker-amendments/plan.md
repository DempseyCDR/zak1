# Implementation Plan: Booker amendments — lead cascade, band re-point, written-check discriminator

**Branch**: `024-booker-amendments` (solo-maintainer mode, constitution v1.3.0 — one atomic commit to `main`)
| **Date**: 2026-07-29 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/024-booker-amendments/spec.md`

## Summary

Booking-side amendments to feature 020, built on the 023 payment substrate. Three additions land in the
existing booking domain, plus one new operation: (1) a **lead status cascade** inside `patchBooking` — after a
band lead's status changes, propagate it to sibling bookings (same event + band) still **in lockstep** with the
lead's *previous* status (lockstep guarantees the move is a legal transition, so no new state machine); (2) the
**written-check discriminator** — `patchBooking` re-point and `deleteBooking` **refuse** when the booking is
settled by a **live** payment (using a small new 023 helper `bookingHasLivePayment`), and a unified
`substitutePerformer` op branches on it (unpaid → re-point; paid → keep the original as a **no-show** and add
the substitute as a **new booking**); (3) **band re-point** — a new `repointBand(eventId, fromBandId, toBandId)`
that removes the outgoing band's **unpaid** bookings, **keeps** any paid ones as a no-show (the discriminator),
and books the incoming band's roster **fresh** via the existing `bookBand`. Everyone who plays gets their own
booking because substitutes/guests are `createBooking` calls. **No schema change, no migration** — this reuses
`bookBand`/`getRoster` (008), `createBooking`/`deleteBooking`, the `bookingStatus` transition table, and 023's
per-booking settlement.

## Technical Context

**Language/Version**: TypeScript 5.7 (strictest) · Node 24 · pnpm

**Primary Dependencies**: Next.js 16.2.10 (App Router, RSC) · React 19.2 · Drizzle · Zod. **No new runtime
dependency.**

**Storage**: PostgreSQL 16. **No migration** — no schema change. Uses existing `bookings`, `bands`,
`band_members`, and the 023 `performer_payments` / `payment_bookings` for the settlement check.

**Testing**: Integration (node, real Postgres) — lead cascade (lockstep + diverged-skip + non-lead
independence), re-point/clear guardrail (refuse when paid, allow when unpaid/voided), `substitutePerformer`
(both branches), `repointBand` (remove unpaid / keep paid / fresh roster). Component tests (jsdom, 020 harness)
for the report modal's band-re-point + substitute affordances.

**Target Platform**: Web, single tenant, staff booker report + FS gate surfaces.

**Project Type**: Next.js App Router monolith; domain under `src/server/`, UI under `src/app/`.

**Performance Goals**: Admin-scale; per-event band operations over a handful of bookings — trivial.

**Constraints**: Money is integer cents. A booking settled by a **live** check is immutable (no re-point,
no clear, no removal-by-re-point) — protects 023's line-sum invariant. Cascade is **status-only**. Band
re-point never silently orphans a paid line. Existing suite stays green.

**Scale/Scope**: ~1 new helper (023), ~3 changes to `bookingService` (cascade, two guardrails,
`substitutePerformer`), 1 new `repointBand` op + route, report/gate UI affordances, a substantial test set. No
migration.

## Constitution Check

*GATE: Must pass before Phase 0. Re-check after Phase 1.* Constitution v1.3.0 (principles I–IV).

| Principle | Verdict |
|---|---|
| **I. Test-First** | **PASS** — each rule lands test-first against real Postgres: lockstep cascade (+ diverged skip + non-lead independence), the paid/unpaid/voided discriminator on re-point + clear, `substitutePerformer` both branches, `repointBand` keep-paid/remove-unpaid/fresh-roster. Report affordances get jsdom component tests. |
| **II. YAGNI** | **PASS** — reuses `bookBand`/`getRoster`, `createBooking`/`deleteBooking`, the `bookingStatus` table, and 023's settlement; the only new primitives are a per-booking live-payment helper, `substitutePerformer`, and `repointBand`. No new table, no overlap-reconciliation engine (explicitly out of scope). |
| **III. Type Safety** | **PASS** — new inputs (band re-point `{ fromBandId, toBandId }`, substitute `{ newPerformerId }`) are Zod-validated at the boundary; the cascade reuses the exhaustive `BookingStatus` enum. No `any`. |
| **IV. Observability** | **PASS** — cascade, re-point-refusal, band re-point, clear, and substitute all go through `writeAudit` (the booking service already audits create/update/delete). |

**Development Workflow**: solo-maintainer mode — one atomic commit to `main`, full local gate suite as the
reviewer. Complies.

### Post-Design Re-Check

Re-evaluated after Phase 1: **still PASS.** No new table/migration, no new pattern; the discriminator is one
helper reused by three call sites, and the state machine is untouched (lockstep keeps every cascade legal).

## Project Structure

### Documentation (this feature)

```text
specs/024-booker-amendments/
├── plan.md              # This file
├── research.md          # R1..R6 (decisions)
├── data-model.md        # no persistent change — the booking-state operations + the discriminator
├── quickstart.md        # per-story validation
├── contracts/
│   └── booking-operations.md   # cascade behavior, re-point/clear guard, substitute, band re-point
├── checklists/requirements.md  # complete (from /speckit-specify)
└── tasks.md             # /speckit-tasks (NOT created here)
```

### Source Code (repository root)

```text
src/
├── server/
│   ├── domain/
│   │   ├── payments/performerPaymentService.ts   +bookingHasLivePayment(db, bookingId) (023 settlement, per booking)
│   │   ├── bookings/
│   │   │   ├── bookingService.ts    patchBooking: lead cascade (status) + re-point guard; deleteBooking guard; +substitutePerformer
│   │   │   ├── bandRepoint.ts (new) repointBand(eventId, fromBandId, toBandId): remove unpaid / keep paid no-show / bookBand fresh
│   │   │   ├── bookBand.ts           reused for the incoming roster
│   │   │   └── bookingStatus.ts      reused (lockstep transitions; no change)
│   │   └── bands/bandService.ts      getRoster reused
│   ├── validation/performers.ts (or bands.ts)  band re-point + substitute input schemas
│   └── app/api/
│       ├── events/[id]/repoint-band/route.ts (new)   POST { fromBandId, toBandId }
│       └── bookings/[id]/substitute/route.ts (new)    POST { newPerformerId }
└── app/(admin)/bookings-report/page.tsx + _modals/BookingModal.tsx   band re-point control + substitute action; cascade is automatic on a lead status change
```

**Structure Decision**: No structural change — the established monolith. Work extends the booking domain
(`bookingService`) with a cascade and two guardrails, adds one `repointBand` op + two thin routes, and one
per-booking helper in the 023 payments domain. The booker report/modal gain the band-re-point and substitute
affordances (the cascade needs no new UI — it rides the existing lead status change).

## Complexity Tracking

> No entries. No constitution deviation, no new table/migration. The feature is a set of booking-state rules
> layered on existing 008/020/023 primitives.
