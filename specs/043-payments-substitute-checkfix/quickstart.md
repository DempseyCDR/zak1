# Quickstart / Validation: Substitution Move + Multi-Booking Check Fix

Prove both fixes end to end. No migration — `pnpm run db:migrate` is a no-op for this feature.

## Prerequisites

- Local Postgres up; `zak1_test` auto-migrated (integration) and `zak1_dev` for the manual check.

## Automated validation (primary proof — test-first)

```bash
# RED first, then GREEN:
pnpm exec vitest run tests/integration/booking.substituteAuthz.test.ts \
                     tests/integration/payments.multiCheckEdit.test.ts \
                     tests/component/payments.substitute.test.tsx \
                     tests/component/payments.multiCheckGuard.test.tsx \
                     tests/component/gate.noSubstitute.test.tsx
# Full gate before commit:
pnpm exec tsc --noEmit && pnpm run lint && pnpm exec vitest run
```

**Integration — substitute authz (`booking.substituteAuthz.test.ts`)** — seed an event with a booking; act as (1)
an FS with `performer_payment.write` → substitute succeeds (201, no 403); (2) a Booker with `booking.write` in the
series → succeeds; (3) a volunteer with neither → refused (`UNAUTHORIZED`). Assert the unpaid re-point and the
live-paid (no-show + fresh booking) outcomes match today. (Use `makeActor` with the relevant grants + `jsonReqAs`.)

**Integration — multi-line check edit (`payments.multiCheckEdit.test.ts`)** — create a multi-line payment (one
check, two bookings) via the create route; PATCH `{ checkNumber: "1792" }` (no `lines`); assert `check_number` is
set and each `payment_bookings.amount_cents` is unchanged.

**Component — `/payments` (`payments.substitute.test.tsx`, `payments.multiCheckGuard.test.tsx`)** — stub fetch,
capture POST bodies; assert: a substitute control POSTs to `/api/bookings/:id/substitute`; `recordMulti` blocks a
positive checkless save until a comment is entered, then posts `overrideReason`; a multi-line payment shows a
check-number edit that PATCHes `{ checkNumber }` with no `lines`.

**Component — `/gate` (`gate.noSubstitute.test.tsx` or extend `gate.reload.test.tsx`)** — render the gate page;
assert there is no "Substitute a performer" control.

## Manual smoke (secondary; staff-only pages)

1. `pnpm dev`, sign in as the Financial Secretary.
2. `/gate` → confirm the substitute section is gone.
3. `/payments` for an event → substitute a performer (no 403); confirm the unpaid/paid outcomes.
4. Record a one-check-many-performers payment with no check number → you must add a comment (or a number) to save.
5. On an existing multi-booking payment, add/correct the check number in place; open the treasurer report → it
   shows the number, and the per-line split is unchanged.
6. As the Booker, substitute from the bookings-report modal → still works.

## Success = all of

- All new tests green; `tsc` + lint + full suite green.
- FS substitutes from `/payments` (no 403); Booker keeps modal substitute; gate has none.
- No positive multi-booking check saves without a number or comment; missing numbers are correctable in place.
- No payment amount/allocation or substitution outcome changed.
