# Quickstart & Validation: Remove the Non-Dance Income Capability

Proof the capability is gone and nothing else changed. See [contracts/removed-surface.md](contracts/removed-surface.md)
and [data-model.md](data-model.md).

## Prerequisites

- Node 24 + pnpm; local Postgres. **Snapshot first**: `pg_dump -Fc "$DATABASE_URL" -f ~/zak1_pre_0031.dump`
  (source env: `set -a; . ./.env; set +a`).

## Migration

```bash
pnpm run db:migrate   # applies 0031_drop_non_dance_income.sql to zak1_dev (test DB auto-migrates)
```

## Automated validation (primary)

Written first, per Constitution I:

```bash
# Migration guard — table gone + idempotent:
pnpm exec vitest run tests/integration/migration.dropNonDanceIncome.test.ts
# Report has no nonDanceIncome; treasurer page has no NDI section/form:
pnpm exec vitest run tests/integration/treasurer.report.test.ts tests/component/treasurer.page.test.tsx
```

Expected:

- **Migration** — after running `0031`, `non_dance_income` is absent from `information_schema.tables`; a second
  run does not error.
- **Report** — the assembled `TreasurerReport` has **no** `nonDanceIncome` property; all other sections present.
- **Page** — no "Non-Dance Income" heading/form is rendered.

Full gate before commit (proves no dangling references remain — SC-005):

```bash
pnpm exec tsc --noEmit && pnpm run lint && pnpm exec vitest run
```

## Manual validation (visual)

```bash
pnpm dev   # sign in as Treasurer, open /treasurer for an event
```

- The report shows gate sales, named receipts, performer payments, deposit, fees — and **no** "Non-Dance Income"
  section or add form. Every other figure matches what it showed before.

## Success-criteria mapping

| Criterion | How validated |
|-----------|---------------|
| SC-001 (no entry control) | Page test + manual |
| SC-002 (no section; other figures identical) | Report test + manual |
| SC-003 (no accept-path) | Route deleted; `tsc`/suite green (no caller) |
| SC-004 (no other financial record changed) | Existing treasurer report tests stay green |
| SC-005 (suite green, no dangling refs) | Full `tsc` + `lint` + `vitest` |
