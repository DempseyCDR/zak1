# Contract: Performer Payments (US2)

**Capability**: `performer_payment.write` — already in the catalog (`auth/capabilities.ts`), held by FS
(scoped) and Treasurer (global). **No new capability is introduced by this feature.**

Two authorization layers per feature 016: the route declares `withAuth({ requires })`; the service calls
`assertEventScope(actor, 'performer_payment.write', { seriesId, groupId })` resolved from the payment's
event, exactly as `assertGateScope` does today.

---

## `POST /api/performer-payments`

Record an actual disbursement. `requires: 'performer_payment.write'`

**Request:**

```jsonc
{
  "eventId": "uuid",
  "payeePerformerId": "uuid",     // MAY differ from any booked performer (FR-005). Must already exist:
                                   // an unknown substitute is created first (with its contact) via the
                                   // existing performers surface, which the FS now reaches directly
                                   // (holds performer.write, FR-009a) — Clarifications 2026-07-23
  "amount": 240.00,                // dollars in, integer cents stored
  "checkNumber": "1043",           // optional
  "overrideReason": "substitute — Kaufman snowed in",  // optional
  "bookingIds": ["uuid", "uuid"]   // ≥1; the bookings this payment settles (FR-006)
}
```

**Responses:**

| Status | Body | When |
|---|---|---|
| `201` | payment view incl. `id`, linked `bookingIds` | Created |
| `400` | `VALIDATION_ERROR` | Zod failure; `amount` negative; empty `bookingIds` |
| `403` | `UNAUTHORIZED` | Layer 1 (no capability) or layer 2 (wrong series) |
| `404` | `EVENT_NOT_FOUND` / `BOOKING_NOT_FOUND` / `PERFORMER_NOT_FOUND` | |
| `422` | `BOOKING_EVENT_MISMATCH` | A listed booking belongs to a different event — settlement is per event (spec Assumptions); cross-event aggregation stays an open edge case and is refused rather than silently allowed |

**Invariant asserted by test**: the referenced bookings' `pay_cents` are byte-identical before and after
(FR-007 / SC-003).

## `PATCH /api/performer-payments/[id]`

Correct a recorded payment. `requires: 'performer_payment.write'`. Accepts any subset of `amount`,
`checkNumber`, `overrideReason`, `bookingIds` (replaces the link set). Same error surface as POST.

## `DELETE /api/performer-payments/[id]`

Remove a mis-entered payment. `requires: 'performer_payment.write'`. Cascades the join rows only.

> **Interaction with US4**: a recorded payment makes its event undeletable (FR-019). Deleting the payment
> restores deletability — correct, since the financial history is genuinely gone.

## `GET /api/events/[id]/performer-payments`

`requires: 'base'` — money is open to all volunteers per feature 016; only PII is gated. Returns actual
payments plus the reconciliation delta:

```jsonc
{
  "payments": [ { "id": "…", "payee": "…", "amount": 240.0, "checkNumber": "1043", "bookingIds": ["…"] } ],
  "reconciliation": { "expected": 480.0, "actual": 460.0, "delta": -20.0 }
}
```

`delta` is **informational, never an error** (FR-008 says "surfacing any gap").

---

## Treasurer report change

`reportService.ts` currently builds `performerPayments` from `bookings` (payee via
`performers.displayName`, `payCents`, `checkNumber`). It switches to `performer_payments` joined to
`performers` for the payee name, and gains the reconciliation block.

**Output-shape compatibility**: the existing `performerPayments` line shape — `{ payee, amount, account,
class, checkNumber }` — is **unchanged**, so downstream QBO-facing consumers see no difference. `account`
still derives from performer type; because a payment has a payee rather than a booked type, the type is taken
from the settled booking(s), falling back to the payee's own most common type when a payment aggregates
mixed types. Post-backfill (R7), historical events produce identical output to today — an explicit
regression test.
