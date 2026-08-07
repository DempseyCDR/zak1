# Phase 0 Research: Substitution Move + Multi-Booking Check Fix

No NEEDS CLARIFICATION remained after the 2026-08-06 clarify (the Booker retains substitution). This records the
design decisions and the code they are grounded in.

## Decision 1: Accept "either capability" via `base` route + a dual assertion in the service

- **Decision**: Change `POST /api/bookings/[id]/substitute` from `requires: "booking.write"` to
  `requires: "base"`, and move the real authorization into `substitutePerformer`: assert the actor holds
  **`booking.write` OR `performer_payment.write`** in the booking's event scope (a new `assertEventScopeAny`
  helper). Undefined actor (internal/test calls) still bypasses, as `assertBookingScope` did.
- **Rationale**: `withAuth`'s `requires` is a single `Requirement`, and `routeInventory.ts` parses it with a regex
  that only matches one double-quoted string (`requires:\s*"([^"]+)"`), so expressing an any-of at the route would
  touch the auth core **and** the route-inventory guard/test. Feature 016 explicitly places the scoped check in
  **layer 2** (the domain service, "where the target is known"); `base` at layer 1 + a dual scoped assertion at
  layer 2 yields the **same** security outcome (only holders of one of the two capabilities, in scope, may
  substitute; everyone else is refused and audited at the `withAuth` catch) with the smallest blast radius.
- **Alternatives considered**: Widen `withAuth` to `requires: Requirement | Requirement[]` + update the
  route-inventory regex/test — more surface, and speculative (only one route needs any-of today; YAGNI). Re-gate
  to `performer_payment.write` only — rejected by the clarification (would 403 the Booker's modal).

## Decision 2: `assertEventScopeAny(actor, capabilities[], event)` helper

- **Decision**: Add a small helper to `can.ts`: if `actor` is undefined → return; if the actor holds **any**
  capability in the list for the event's `{seriesId, groupId}` (via the existing `actorCan`), return; else throw
  `errors.unauthorized(...)`.
- **Rationale**: One named, testable helper beats inlining an OR of `actorCan` calls, and it can be unit-tested in
  `authz.can.test.ts`. Reuses the existing `actorCan` + `assertScope` machinery; adds no new concept.

## Decision 3: 024 substitution semantics are untouched

- **Decision**: Only the route gate + the scope assertion change. `substitutePerformer`'s body — unpaid → clean
  re-point; live-paid → keep the original as a `declined` no-show + a fresh booking for the substitute — is
  unchanged.
- **Rationale**: FR-004/SC-005 — the move must not alter outcomes. The existing 024 integration tests
  (`booking.substituteDiscriminator`, `booking.playedGetsBooking`) stay green; a new authz test covers the gating.

## Decision 4: D3 capture — the multi popup requires a check number OR a comment (no forced check#)

- **Decision**: In `recordMulti` (`payments/page.tsx`), when the computed multi total is **positive** and there is
  **no** check number, require a **comment** (the popup's existing `multiNote`, persisted as `overrideReason`)
  before saving — mirroring `commitRow`'s FR-014 checkless guard. If neither a check number nor a comment is
  present, block the save and prompt for the comment. A check number is **never forced** (FR-007).
- **Rationale**: The defect is that `recordMulti` sends `checkNumber` only if present and skips the guard the
  per-row path enforces at line 191 — silently persisting a positive multi-booking payment with a null check
  number. The create service + Zod are fine (checkNumber persists when sent); the fix is the popup's save guard.
- **Alternatives considered**: Force a check number on multi checks — rejected (user-confirmed the checkless-
  comment option stays). Reuse the single-row `checkless` confirm modal — optional; the popup already has a
  comment field, so an inline "comment required" guard is simplest.

## Decision 5: D3 correction — a check-number-only edit for multi-line payments (no allocation change)

- **Decision**: Lift the `lines.length === 1` gate that hides Edit on multi-line payments; for a **multi-line**
  payment, offer a **check-number-only** edit that PATCHes `{ checkNumber: value || null }` **without** `lines`.
  The single-line Edit (amount + check#) is unchanged.
- **Rationale**: `performerPaymentPatchSchema` already has `checkNumber` (nullable-optional) and `lines`
  (optional), and `patchPerformerPayment` only replaces the allocation **when `input.lines` is present** (it sets
  `checkNumber` from input else keeps current). So `{ checkNumber }` with no lines updates just the number and
  leaves each booking's amount intact (FR-008/FR-009) — **no schema or service change**. The current `saveEdit`
  sends a single `lines: [...]`, which is why it was gated to single-line; the multi-line edit must omit `lines`.
- **Alternatives considered**: Void-and-recreate — the current painful workaround, explicitly what D3 removes.
  Re-sending all lines unchanged plus the new check# — works but is needless (omitting `lines` is simpler and
  can't drift from the stored allocation).

## Out of scope (recorded)

- Changing substitution rules; single-performer capture/edit (already correct); the treasurer-report shape (040);
  any migration.
