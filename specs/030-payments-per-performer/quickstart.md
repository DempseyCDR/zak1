# Quickstart / Validation: Payments page per-performer workflow (P5-R3)

Bash runs Node 24 (no prefix). Prereqs: `pnpm install`; local Postgres up (`zak1_dev` / `zak1_test`).

## Automated validation (the gate)

```bash
# new domain ops (real Postgres) + page redesign (jsdom)
pnpm exec vitest run tests/integration/payments.settlementDonate.test.ts \
  tests/integration/payments.addSettlementPerformer.test.ts \
  tests/component/payments.perPerformer.test.tsx \
  tests/component/payments.allocation.test.tsx
pnpm exec tsc --noEmit
pnpm exec eslint <changed files>
pnpm exec prettier --check <changed files>
pnpm test          # full suite green (incl. auth.routeInventory picks up the two new routes)
pnpm build         # production build clean
```

### Expected assertions (mapped to stories)

- **US1 / FR-001–005, 015**: an event's payable performers render one row each (role + booked amount); a
  check# with blank amount records a payment to that performer for the booked amount; a typed amount records
  that amount; each row is its own payment to its own performer; an untouched row stays outstanding; rows
  commit independently (no batch save).
- **US2 / FR-006, 013**: donated / instructor / `$0` bookings render as **free** (no check field) and never
  appear in payments due or the outstanding gap; reconciliation reflects only check-requiring bookings.
  Open-band musicians (comped attendees) are not rendered as rows.
- **US3 / FR-007, 008**: `0` + no check# on a paid-booked row, after confirm, calls the donate endpoint →
  the booking becomes donated (expected drops, appearance kept, no gap); succeeds with `performer_payment.write`
  and **without** `booking.write`; integration test asserts the flag flip, series scope, and the live-paid /
  already-donated guards.
- **US4 / FR-009**: the multi-apply popup records one check to a single payee across multiple bookings; those
  bookings clear.
- **US5 / FR-010**: clicking a paid row edits amount + check number in place (`PATCH`); void remains available.
- **US6 / FR-011**: add-performer creates a booking for an unbooked performer (dedupe if already booked) under
  payment-write, then the new row records a check.
- **FR-014**: a positive amount with no check number prompts a confirmation **with a comment box**; on confirm
  a check-less payment records with the comment as the note.

## Manual smoke (optional)

1. `pnpm dev`, sign in as an FS, open `/payments` — the recent event is pre-selected; payable performers show
   as rows, free performers show as free.
2. Enter a check number on a row (blank amount) → a payment for the booked amount is recorded.
3. Enter `0` + no check on a paid row → confirm → the row becomes free, expected drops.
4. Open the multi-apply popup → one check to a band lead across two bookings.
5. Click a paid row → change the amount → it updates.
6. Add-performer for a walk-in → a row appears → record their check.
