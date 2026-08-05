# Quickstart & Validation: Remove the GL-Account-Per-Line Mapping

Proof the GL-account annotation is gone and class/customer + series editor stay. See
[contracts/removed-surface.md](contracts/removed-surface.md) and [data-model.md](data-model.md).

## Prerequisites

- Node 24 + pnpm; local Postgres. **Snapshot first**: `set -a; . ./.env; set +a` then
  `pg_dump -Fc "$DATABASE_URL" -f ~/zak1_pre_0032.dump`.

## Migration

```bash
pnpm run db:migrate   # applies 0032_drop_account_mapping.sql (test DB auto-migrates)
```

## Automated validation (primary)

Written first, per Constitution I:

```bash
# Migration guard — table gone + idempotent:
pnpm exec vitest run tests/integration/migration.dropAccountMapping.test.ts
# Report: no account on any line, class/customer kept; mapping config = series only:
pnpm exec vitest run tests/integration/treasurer.report.test.ts tests/integration/treasurer.mapping-audit.test.ts
# Page: no GL-account column:
pnpm exec vitest run tests/component/treasurer.page.test.tsx
```

Expected:

- **Migration** — after `0032`, `account_mapping` is absent; a second run does not error.
- **Report** — no report line has an `account` property; each still has `class` (and gate lines `customer`);
  every other figure unchanged.
- **Mapping** — `GET /api/qbo-mapping` returns `{ series }` (no accounts); a series/customer/class edit still
  saves and audits.
- **Page** — no GL-account cells render.

Full gate before commit (proves no dangling references — SC-005):

```bash
pnpm exec tsc --noEmit && pnpm run lint && pnpm exec vitest run
```

## Manual validation (visual)

```bash
pnpm dev   # sign in as Treasurer
```

- `/treasurer` (an event): each line shows class (+ gate customer) and amounts, **no GL account code**; every
  other figure matches before.
- `/qbo-mapping`: **no "Accounts" editor**; the **"Series → gate customer / class"** editor is present and saves.

## Success-criteria mapping

| Criterion | How validated |
|-----------|---------------|
| SC-001 (no GL codes; class/customer kept) | Report test + manual |
| SC-002 (other figures unchanged) | Report test + full suite |
| SC-003 (no Accounts editor; Series still saves) | Mapping test + manual |
| SC-004 (no accept-path for account edits) | Route deleted; `tsc`/suite green |
| SC-005 (suite green, no dangling refs) | Full `tsc` + `lint` + `vitest` |
