# Quickstart / Validation: Treasurer Report QBO Restructure (+ counts)

Prove the reshaped report end to end. No migration — `pnpm run db:migrate` is a no-op for this feature.

## Prerequisites

- Local Postgres up; `zak1_test` auto-migrated (integration) and `zak1_dev` for the manual check.
- Features 038 + 039 already shipped (non-dance income and the GL account annotation are gone).

## Automated validation (primary proof — test-first)

```bash
# RED first, then GREEN:
pnpm exec vitest run tests/integration/treasurer.report.test.ts \
                     tests/component/treasurer.page.test.tsx
# Full gate before commit:
pnpm exec tsc --noEmit && pnpm run lint && pnpm exec vitest run
```

**Integration (`treasurer.report.test.ts`)** — seed one event whose venue has a landlord contact and a resolvable
rent (via the extended `makeEvent({ venueId, rentCents })` or a seeded `venue_rents` row), plus gate sales, named
receipts, and a performer check. Assert:

- `body.bills` has the rent bill: `amount === resolveEventRentCents` (dollars), `vendor ===` the landlord's
  display name, `class ===` the series class, and **no** check/payment field.
- A **no-landlord** event → `bills[0].vendor === "(no landlord set)"`.
- `body.compCount === door.comp_count` and `body.giftCardRedemptionCount === door.gift_card_redemption_count`
  (including a 0/0 event).
- **Figure parity**: gate line totals, `namedCustomerReceipts` amounts, `performerPayments` amounts,
  `performerReconciliation`, `deposit.amount`, and `fees.total` are exactly as before (the additive fields
  changed nothing).

**Component (`treasurer.page.test.tsx`)** — extend the mock-report fixture with `bills`, `compCount`,
`giftCardRedemptionCount`; assert the page renders sections in order **Sales Receipts → Bills → Performer
Payments → Deposit → Fees**, the gate receipt appears before the named receipts, the rent bill shows vendor +
amount with no check control, and both counts are visible (0 shown).

## Manual smoke (secondary; staff-only page)

1. `pnpm dev`, sign in as Treasurer (or Super-user), open `/treasurer`.
2. Pick an event with a venue that has a landlord and a rent.
3. Confirm: the page reads Sales Receipts (gate first, then named) → Bills (rent → landlord, no check line) →
   Performer Payments → Deposit → Fees; the comp and gift-card-redemption counts show; **Print** still works.
4. Cross-check the rent amount against the same event's **organizer** report — they must match (SC-004).

## Success = all of

- Integration + component tests green; `tsc` + lint + full suite green.
- Rent bill amount matches the organizer report; vendor is the landlord (or the "(no landlord set)" placeholder).
- Comp + gift-card-redemption counts visible for every event, including zeros.
- No pre-existing money figure changed (parity assertion passes).
