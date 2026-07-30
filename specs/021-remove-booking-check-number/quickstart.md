# Quickstart / Validation: Remove `bookings.check_number`

Prerequisites: local Postgres running; `zak1_test` reachable; Node 24 via nvm. Run from repo root.

```bash
pnpm run db:migrate      # applies 0026 (reconcile → drop) to zak1_dev
pnpm test                # full Vitest suite against real Postgres
pnpm exec tsc --noEmit   # types: no stale checkNumber references remain
```

## Story validation

### US1 — One home for a check number (P1)

- **Schema**: `bookings` has no `check_number` column after `0026`:

  ```sql
  SELECT count(*) FROM information_schema.columns
  WHERE table_name='bookings' AND column_name='check_number';   -- expect 0
  ```

- **Types**: `pnpm exec tsc --noEmit` is clean — `BookingRow` no longer exposes `checkNumber`; no caller
  references it.
- **API**: `GET /api/bookings/[id]/check` / `PATCH …/check` no longer exists (404 / absent from the generated
  route inventory).

### US2 — Delete guardrail still protects paid events (P1)

- Integration (`event.delete.test.ts`): an event with a recorded `performer_payments` row is refused deletion
  with reason **"a recorded performer payment"**; an event with none is not blocked by this guard.

### US3 — No check-number history lost (P1)

- Migration/preservation test: seed a booking with a check number **not** mirrored to `performer_payments`
  (the post-0024 gate case), run the reconciliation, then confirm the number is retrievable via
  `performer_payments`.
- **Treasurer parity**: the treasurer report shows the same check numbers before and after (it reads
  `performer_payments`); `treasurer.*` tests stay green.

## Full gate (the reviewer, solo-maintainer mode)

```bash
pnpm exec tsc --noEmit
pnpm exec eslint <changed files>
pnpm exec prettier --check <changed files>
pnpm test
pnpm build
```

Expected: all green; suite count unchanged except the retired check-number assertions and the added
preservation test. The treasurer report and public/confirmed views are byte-for-byte unaffected.

See [data-model.md](data-model.md) for the migration shape and [contracts/removed-check-endpoint.md](contracts/removed-check-endpoint.md)
for the interface deltas.
