# Quickstart / Validation: FS payments substrate

Prerequisites: local Postgres; `zak1_test` reachable; Node 24 via nvm. Run from repo root.

```bash
pnpm run db:migrate     # applies 0027 (add cols + backfill amount_cents) to zak1_dev
pnpm test               # full suite (real Postgres) + component tests
pnpm exec tsc --noEmit
```

## Story validation

### US1 — record a check + per-line allocation + note (P1)

- Integration: create a payment with `lines: [{ bookingId, amount }]` and an `overrideReason`; assert the
  payment stores number/amount/note/event and the line stores its `amount_cents`; assert `amount_cents` = Σ
  lines (SC-002).

### US2 — one check, many bills, cross-event (P1)

- Integration: one check to a band lead with lines settling 2+ members' bookings — payee = lead, per-line
  amounts sum to the total.
- Integration (**cross-event**): a check at event B with a line settling a booking from event A succeeds (the
  relaxed constraint, R2); the payment's event is B, the line's booking event is A.

### US3 — void + reissue (P1)

- Integration: create → void (reason) → the payment persists as voided and settles nothing (settled amount of
  its booking becomes 0); create a reissue with `replacesPaymentId` → linked; patching a voided payment is
  refused.

### US4 — treasurer per-event QBO view (P1)

- Integration: at an event with a normal check, a cross-event check, and a voided check, the per-event
  treasurer report lists each live check with its **per-line** breakdown (incl. the cross-event line) and the
  voided check in a distinct section (SC-004).

### US5 — organizer cost by incurred date (P2)

- Integration: a delayed check (written at B) settling event A's booking → event A's organizer performer cost
  includes that amount, event B's does not (SC-005). An unpaid booking contributes its **expected** pay to the
  same **combined** organizer figure (not $0), and the organizer view shows **no** paid/outstanding split (R5).

## Migration safety (like 021)

- On `zak1_dev`, capture `Σ performer_payments.amount_cents` and per-payment link counts BEFORE; run
  `db:migrate`; assert every `payment_bookings.amount_cents` is set and each payment's lines sum to its total.
  Snapshot `~/zak1_pre_0027.dump` first.

## Full gate (solo-maintainer mode)

```bash
pnpm exec tsc --noEmit
pnpm exec eslint <changed files>
pnpm exec prettier --check <changed files>
pnpm test
pnpm build
```

See [data-model.md](data-model.md) and [contracts/](contracts/) for the shapes.
