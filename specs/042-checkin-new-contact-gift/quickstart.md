# Quickstart / Validation: Gift-Card Option on Named-Person Check-In

Prove the gift-card option on both named check-in paths. No migration — `pnpm run db:migrate` is a no-op here.

## Prerequisites

- Local Postgres up; `zak1_test` auto-migrated (integration) and `zak1_dev` for the manual check.

## Automated validation (primary proof — test-first)

```bash
# RED first, then GREEN:
pnpm exec vitest run tests/component/checkin.giftCard.test.tsx \
                     tests/integration/door.attendance-new.test.ts \
                     tests/integration/door.attendance-match.test.ts
# Full gate before commit:
pnpm exec tsc --noEmit && pnpm run lint && pnpm exec vitest run
```

**Component (`checkin.giftCard.test.tsx`, new)** — render the check-in page with a stubbed fetch that captures the
POST body; for the **new-contact** section and a **matched** candidate row, assert a "Gift card" checkbox is
present, tick it, confirm the check-in, and assert the captured attendance POST body contains
`redeemedGiftCard: true`. Add a comp+gift case asserting the body has both `isComp: true` and
`redeemedGiftCard: true`.

**Integration (`door.attendance-new.ts` / `door.attendance-match.ts`)** — POST an attendance body via the route:

- `{ newContact: {…}, redeemedGiftCard: true }` ⇒ the event's door record `giftCardRedemptionCount === 1`.
- `{ contactId, redeemedGiftCard: true }` ⇒ `giftCardRedemptionCount === 1`.
- `{ contactId, isComp: true, redeemedGiftCard: true }` ⇒ `compCount === 1` **and**
  `giftCardRedemptionCount === 1`.

## Manual smoke (secondary; staff-only page)

1. `pnpm dev`, sign in as a Door Attendant (or Super-user), open `/checkin`, pick an event.
2. Search for a returning person → their row shows **Comp** and **Gift card** checkboxes; tick Gift card, check
   them in.
3. Add a new contact → the new-contact section shows **Comp** and **Gift card**; tick Gift card, check them in.
4. Open the treasurer report (or gate) for the event → the gift-card-redemption count reflects both.

## Success = all of

- Component + integration tests green; `tsc` + lint + full suite green.
- Both named paths render a Gift-card checkbox and send `redeemedGiftCard: true` when ticked.
- The event's gift-card-redemption count increments once per named check-in marked gift card; comp+gift bumps both.
- The anonymous path and all other behavior are unchanged.
