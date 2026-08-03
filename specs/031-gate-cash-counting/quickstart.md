# Quickstart / Validation: Gate cash counting (P5-R4)

Bash runs Node 24 (no prefix). Prereqs: `pnpm install`; local Postgres up (`zak1_dev`/`zak1_test`).

## Apply the migration

```bash
pnpm run db:migrate    # applies 0029_gate_sales_note.sql (additive: gate_sales.note nullable text)
```

## Automated validation (the gate)

```bash
pnpm exec vitest run tests/integration/gate.note.test.ts tests/component/gate.cashCounting.test.tsx
pnpm exec tsc --noEmit
pnpm exec eslint <changed files>
pnpm exec prettier --check <changed files>
pnpm test          # full suite green (resetDb applies the new column)
pnpm build         # production build clean
```

### Expected assertions (mapped to stories)

- **US1 / FR-001, 003 (component)**: entering bill counts + a coins amount + a checks amount shows a grand
  cash total = `Σ(count × face) + coins + checks`, and that total fills the gross-cash field used for the
  deposit.
- **US2 / FR-002 (component)**: typing the gross-cash total directly, without touching the helper, records
  that total; the deposit is computed from it exactly as before.
- **US3 / FR-005, 006 (integration + component)**: an anonymous-sales comment is sent as `note` on the anon
  line and, on reopen, reloads verbatim. Integration: `putGateSales` writes `note`; `getDoorRecord` returns
  it.
- **FR-007 (full suite)**: deposit math, card totals, seed float, comp/gift counts, and the FS-only write
  boundary are unchanged — the existing gate/door tests stay green.

## Manual smoke (optional)

1. `pnpm dev`, sign in as an FS, open `/gate`, select an event.
2. Expand the denomination helper: enter 3×$20, 5×$10, a coins amount, a checks amount → the grand cash total
   updates and fills gross cash.
3. Alternatively, ignore the helper and type gross cash directly → deposit computes the same way.
4. Under anonymous sales, type a comment ("3 CDs, 2 shirts"), Save, reopen the door record → the comment (and
   the anon amounts) reappear.
