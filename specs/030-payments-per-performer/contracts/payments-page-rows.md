# Contract: Payments page per-performer rows over the reused payment endpoints

The redesign maps UI gestures onto **existing** endpoints (no new payment API). Consumed endpoints:

- `GET /api/events/[id]/bookings` (`getBookingsForEvent`, `base`) — already returns each booking's
  `pay_cents`, `is_donated`, `requires_check`, `performer_type`, `performerName`. The page **consumes** these
  (FR-012) to build rows; **free** = `requires_check === false`.
- `GET /api/events/[id]/performer-payments` (`listPerformerPayments`) — the event's payments + the
  expected/actual/delta reconciliation, **plus `settledByBooking`** (a `booking id → live settled cents` map,
  **cross-event aware**, serialized from the already-computed `settledCentsByBookingForEvent`; reconciliation
  math unchanged). Used to classify a row as paid even when the settling check was recorded at another event
  (FR-016).
- `POST /api/performer-payments` (`createPerformerPayment`, `performer_payment.write`) — records a check.
- `PATCH /api/performer-payments/[id]` (`patchPerformerPayment`, `performer_payment.write`) — inline edit.
- `POST /api/performer-payments/[id]/void` (`voidPerformerPayment`) — unchanged.

## Per-row entry → `createPerformerPayment` mapping

For a payable row (`requires_check === true`) whose performer is `P` and booking is `B` with booked
`pay_cents`:

| Row entry | Records |
|-----------|---------|
| check# + **blank** amount (FR-002) | `{ eventId, payeePerformerId: P, lines: [{ bookingId: B, amount: pay_cents }], checkNumber: entered }` — blank resolves to booked **client-side** |
| check# + **explicit** amount (FR-003) | same, `amount = entered` |
| **positive amount, no check#** (FR-014) | confirm dialog **with comment box** → `{ …, lines:[{ B, amount }], checkNumber: null, overrideReason: comment }` |
| **untouched** (FR-004) | nothing recorded → the row stays **outstanding** |
| **`0`, no check#** (FR-007) | NOT a payment → calls `POST /api/bookings/[id]/donate` (see [settlement-donate.md](settlement-donate.md)); confirm first |

- **Payee is always the row's performer** (FR-005) — no per-row payee override.
- **Per-row independent commit** (FR-015) — each row records on its own entry/confirm; no batch "save all";
  one row's confirmation/failure does not block others.

## Free rows (FR-006)

`requires_check === false` (donated / instructor / `$0`): render **no check field**, labelled free (donated
vs. free-by-rule from `is_donated`), and **excluded** from payments due and the outstanding gap. (Open-band
musicians are comped attendees, not bookings — they are not rows here; only the open band's paid lead
musicians appear.)

## Multi-apply popup (FR-009)

A control opens the current payee-dropdown + booking-checkbox UI in a modal: choose **one payee** + multiple
bookings with amounts → one `createPerformerPayment` with several lines. This is the only place a payee ≠ the
settled performers is chosen (e.g. band lead).

## Inline edit (FR-010)

Clicking a **paid-here** row edits amount + check number via `PATCH /api/performer-payments/[id]`; **void**
remains the existing separate action. A **settled-elsewhere** row (paid by a cross-event check, FR-016) shows
as paid but is **not** inline-editable here — the check is edited where it was recorded.

## Add-performer (FR-011)

Calls [settlement-add-performer.md](settlement-add-performer.md) to create the booking, then the new row
records its check via the per-row mapping above.
