# Quickstart / Validation: Booker amendments

Prerequisites: local Postgres; `zak1_test` reachable; Node 24 (Bash default). Run from repo root. **No
migration** — this feature adds no schema.

```bash
pnpm test               # full suite (real Postgres) + component tests
pnpm exec tsc --noEmit
```

## Story validation

### US1 — lead status cascade (P1)
- Integration: book a band (lead + members), advance the **lead** requested→confirmed; assert lockstep members
  → confirmed; a member set to `declined` beforehand stays `declined`; changing a **non-lead** member changes
  no one (SC-001).

### US2 — band re-point (P1)
- Integration: book band A on an event, `repointBand(evt, A, B)`; assert the event now carries band B's roster
  as fresh `proposed` bookings and A's unpaid bookings are gone (SC-002). With one A member settled by a live
  check → that member is kept as `declined` (SC-003 interaction).

### US3 — written-check discriminator (P1)
- Integration: re-pointing / clearing a booking with **no** live payment succeeds; a booking settled by a
  **live** check is **refused** re-point and clear (SC-003); a booking whose only check is **voided** re-points
  cleanly (SC-004). `substitutePerformer`: unpaid → slot re-pointed; paid → original `declined` + a new booking
  for the sub.

### US4 — everyone who plays gets a booking (P2)
- Integration: after a paid substitution and a guest sit-in, assert both the substitute and the guest have
  their **own** booking (and appear in `getPerformer` appearance history) (SC-005).

## Full gate (solo-maintainer mode)

```bash
pnpm exec tsc --noEmit
pnpm exec eslint <changed files>
pnpm exec prettier --check <changed files>
pnpm test
pnpm build
```

See [contracts/booking-operations.md](contracts/booking-operations.md) and [data-model.md](data-model.md) for
the operation shapes and the discriminator table.
