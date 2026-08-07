# Contract: Substitute Re-Gate + Multi-Booking Check Correction

Two existing HTTP surfaces; one changes its **authorization**, the other is **reused unchanged**. No request/
response schema changes.

## `POST /api/bookings/[id]/substitute` — authorization changes

- **Before**: `withAuth({ requires: "booking.write" })` → the FS (no `booking.write`) got **403**.
- **After**: `withAuth({ requires: "base" })`; `substitutePerformer` asserts the actor holds **`booking.write` OR
  `performer_payment.write`** in the booking's event scope.
- Request/response body and the substitution outcome are **unchanged** (024).

**Guarantees (test contract):**

- The **FS** (holds `performer_payment.write`) can substitute → 201 (no 403).
- The **Booker** (holds `booking.write` in the series scope) can substitute → 201 (retained).
- A volunteer with **neither** capability → **refused** (`UNAUTHORIZED`, audited).
- Semantics unchanged: unpaid → clean re-point; live-paid → original kept as a `declined` no-show + a fresh booking
  for the substitute.

## `PATCH /api/performer-payments/[id]` — reused unchanged for the multi-line check fix

- Existing schema already accepts `{ checkNumber?: string | null, lines?: [...], overrideReason?: string }`, and
  the service replaces the allocation **only when `lines` is present**.
- D3's correction sends **`{ checkNumber: value | null }` with NO `lines`** → updates only the check number; every
  booking's line amount is unchanged.

**Guarantees (test contract):**

- A check-number-only PATCH on a **multi-line** payment sets `check_number` and leaves each
  `payment_bookings.amount_cents` unchanged.
- A voided payment stays non-patchable (unchanged).

## Client (UI) contract — proven by component tests

- **`/gate`**: **no** "substitute a performer" control.
- **`/payments`**: a substitute control (pick a booking on the event + find a substitute performer) that POSTs to
  the substitute route.
- **`/payments` multi popup (`recordMulti`)**: a positive total with no check number **requires a comment**
  before saving; a comment (or a check number) allows the save; a check number is never forced.
- **`/payments` multi-line payment**: shows a **check-number edit** (not just Void); saving it PATCHes
  `{ checkNumber }` only.

## Out of scope (contract does NOT change)

- Substitution rules; single-performer capture/edit; the treasurer-report shape; any migration or Zod schema.
