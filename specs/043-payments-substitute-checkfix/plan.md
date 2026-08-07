# Implementation Plan: Move Substitution to Payments + Fix Multi-Booking Check Numbers

**Branch**: `043-payments-substitute-checkfix` | **Date**: 2026-08-06 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/043-payments-substitute-checkfix/spec.md`

## Summary

Two payments-workflow fixes. **R12**: move the performer-**substitution** control from `/gate` to `/payments` and
let the FS use it without a 403 — the substitute route is re-gated so **either** the booking-management permission
(the Booker's bookings-report modal, retained) **or** the settlement permission (the FS) authorizes it; the gate
substitute UI is removed; the 024 substitution semantics are unchanged. **D3**: on `/payments`, (a) a multi-booking
check with a positive total can no longer be saved with neither a check number nor a comment (the checkless guard
the single-row path already applies), and (b) the FS can edit the check number on a multi-booking payment in place,
preserving its per-line allocation. **No migration; no Zod/schema change** — the PATCH payment schema already
accepts a check-number-only edit that leaves `lines` untouched.

## Technical Context

**Language/Version**: TypeScript 5.7 (strictest flags)

**Primary Dependencies**: Next.js 16 App Router · Drizzle · the auth layer (`withAuth`, `can.ts`), the bookings
domain (`substitutePerformer`), the payments domain (`patchPerformerPayment`), and the `/gate` + `/payments`
pages.

**Storage**: PostgreSQL — **no migration**. D3's correction uses the existing PATCH path
(`performerPaymentPatchSchema` already has `checkNumber` nullable-optional and `lines` optional; the service only
replaces the allocation when `lines` is present).

**Testing**: Vitest against real Postgres — integration (substitute authorized by **either** capability; a
volunteer with neither is refused; 024 semantics unchanged; a check-number-only PATCH on a multi-line payment
preserves its lines) + component (jsdom: `/payments` gains a substitute control, the recordMulti checkless guard,
and a multi-line check-number edit; `/gate` no longer shows substitution). Test-first.

**Target Platform**: Web (Next.js App Router) + Postgres

**Project Type**: Single Next.js + Postgres web app

**Performance Goals**: N/A.

**Constraints**: Substitution semantics unchanged (024); a check number is **never forced** (checkless-with-comment
stays); the multi-line allocation is preserved on a check-number edit; the Booker keeps substitution (2026-08-06
clarification). No figure changes.

**Scale/Scope**: ~2 backend edits (substitute route gate; the service's scope assertion + a small `can.ts` helper)
and ~2 client edits (`/gate` remove, `/payments` add substitute + two D3 fixes); several test files; 0 migrations,
0 schema changes.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Test-First (NON-NEGOTIABLE)** — PASS. RED-first: integration proving the FS (settlement permission) and the
  Booker (booking permission) can each substitute while a volunteer holding neither is refused, plus a check-
  number-only PATCH leaving a multi-line allocation intact; component tests proving `/payments` gains the
  substitute control + the checkless guard on the multi popup + the multi-line check-number edit, and `/gate` drops
  substitution.
- **II. Simplicity / YAGNI** — PASS. No schema/Zod change — D3's correction rides the existing PATCH contract. The
  "either capability" is realized by gating the route at `base` and asserting **both** capabilities in the service
  (layer 2, where scoped checks already live), rather than widening `withAuth`/the route-inventory regex to parse
  an any-of array — the smaller, self-contained change. One small reusable helper (`assertEventScopeAny`).
- **III. Type Safety** — PASS. No new boundary schema; the helper and edits are typed; `tsc` covers the page-local
  types.
- **IV. Observability** — PASS. Authz refusals are still audited at the single `withAuth` catch point (the service
  assertion throws `UNAUTHORIZED`, which is recorded); the substitution audit is unchanged.

**Result**: All gates pass. Complexity Tracking empty.

## Project Structure

### Documentation (this feature)

```text
specs/043-payments-substitute-checkfix/
├── plan.md · research.md · data-model.md · quickstart.md
├── contracts/substitute-and-payment-patch.md
├── checklists/requirements.md
└── tasks.md            # /speckit-tasks (NOT created here)
```

### Source Code (repository root)

```text
EDIT (backend — R12 re-gate):
  src/app/api/bookings/[id]/substitute/route.ts   # requires: "booking.write" → "base" (layer-1); the REAL gate
                                                  #   moves to the service (either capability, in event scope)
  src/server/auth/can.ts                          # add assertEventScopeAny(actor, capabilities[], event) — passes
                                                  #   if the actor holds ANY of the capabilities in that scope
  src/server/domain/bookings/bookingService.ts    # substitutePerformer: replace the hard-coded
                                                  #   assertBookingScope (booking.write) with assertEventScopeAny
                                                  #   over ["booking.write","performer_payment.write"] for the
                                                  #   booking's event; undefined actor still bypasses (internal)

EDIT (client — R12 surface move):
  src/app/(door)/gate/page.tsx                     # remove the "Substitute a performer" section + its state,
                                                  #   loader, and handler (subBookings/subBookingId/substitute…)
  src/app/(admin)/payments/page.tsx                # add a substitute control (pick a booking on the event + find
                                                  #   a substitute performer → POST /api/bookings/[id]/substitute)

EDIT (client — D3 on /payments):
  src/app/(admin)/payments/page.tsx                # (a) recordMulti: when the multi total > 0 and there is no
                                                  #   check number, REQUIRE a comment (multiNote) before saving —
                                                  #   mirror commitRow's FR-014 checkless guard; never force a
                                                  #   check number. (b) allow a check-number-only Edit on a
                                                  #   MULTI-line payment (PATCH { checkNumber } with NO lines, so
                                                  #   the allocation is preserved) — lift the lines.length===1 gate

TESTS:
  tests/integration/booking.substituteAuthz.test.ts (NEW)  # FS (performer_payment.write) OK; Booker
                                                           #   (booking.write) OK; neither → refused; semantics
                                                           #   unchanged (unpaid re-point / live-paid no-show+fresh)
  tests/integration/payments.multiCheckEdit.test.ts (NEW)  # a check-number-only PATCH on a multi-line payment sets
                                                           #   the number and leaves each line's amount unchanged
  tests/component/payments.substitute.test.tsx (NEW)       # /payments substitute control posts to the route
  tests/component/payments.multiCheckGuard.test.tsx (NEW)  # recordMulti blocks a positive checkless save w/o a
                                                           #   comment; a comment (or a check#) lets it save; a
                                                           #   multi-line payment shows a check-number edit
  tests/component/gate.noSubstitute.test.tsx (NEW) or extend gate.reload.test.tsx  # /gate has no substitute control

NO migration · NO schema/Zod change · route-inventory test needs no change (`base` is an accepted declaration).
```

**Structure Decision**: Single Next.js + Postgres project. **R12** is a surface move (gate → payments) plus an
authorization change realized in **two layers**: the route drops to `requires: "base"` (layer 1) and
`substitutePerformer` asserts **either** `booking.write` **or** `performer_payment.write` in the booking's event
scope (layer 2) via a new `assertEventScopeAny` — the minimal way to accept either capability without widening
`withAuth`/the route-inventory single-string regex, and consistent with 016's "the scoped check lives in the
service." The security outcome is identical to a capability-gated route: only holders of one of those two
capabilities (in scope) can substitute; anyone else is refused and audited. **D3** is client-only on `/payments`
— a save-time guard on the multi popup and a check-number-only edit for multi-line payments — both riding the
existing PATCH contract (the service already leaves `lines` untouched when they're absent), so **no schema or Zod
change**. 024 substitution semantics and all payment amounts/allocations are unchanged.

## Complexity Tracking

> No Constitution Check violations — table intentionally empty.
