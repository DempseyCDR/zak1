# Contract: payment write (create / void / reissue / patch)

Extends the feature-019 performer-payment API. Money is dollars in, integer cents stored.

## Create — record a check with per-line allocation

Input (was `bookingIds: uuid[]`) becomes **allocation lines**:

```text
{
  eventId: uuid,                 // recorded-at = check-written date
  payeePerformerId: uuid,        // the check recipient (may differ from settled performers)
  checkNumber?: string,
  overrideReason?: string,       // discrepancy note
  lines: [ { bookingId: uuid, amount: number } , ... ]   // ≥1; each line's applied amount
}
```

- `performer_payments.amount_cents` = **Σ line amounts** (the check total) — the client need not send a
  separate total; it is derived and stored.
- Bookings must **exist** but MAY belong to any event (cross-event allowed — R2). At least one line.
- Every line settles a real booking (no booking-less lines — B42 out of scope).

## Void

```text
POST void { paymentId: uuid, reason: string }   // sets voided_at + void_reason; row persists
```

- A voided payment no longer contributes to any booking's settled amount (FR-005/FR-010).

## Reissue

A normal **create** that also carries `replacesPaymentId: uuid` → links the new live check to the voided one
(FR-006). The voided one is not modified beyond being voided.

## Patch

Amount/checkNumber/overrideReason and the **line set** (replaces lines, each with its amount) — as today, plus
per-line amounts. Patching a **voided** payment is refused (void is terminal; correct via a reissue).

## Validation rules

- `lines` non-empty; each `amount ≥ 0`; bookings exist.
- Void `reason` required and non-empty.
- Server-side scope: `performer_payment.write` on the payment's event (unchanged).
