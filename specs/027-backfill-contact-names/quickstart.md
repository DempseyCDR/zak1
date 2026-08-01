# Quickstart: Backfill existing mis-split contact names

Validation (test) and the operational apply. This feature adds **one migration** and **one test**.

## Prerequisites

- Feature 026 (structured capture) is shipped — no new mis-split contacts are being created.
- Run the test with `pnpm exec vitest run tests/integration/contactNameBackfill.test.ts`; the whole suite with
  `pnpm test`.

## Validate (test)

`tests/integration/contactNameBackfill.test.ts` (integration, real Postgres):

1. Seed: a mis-split contact (`contactRow("Chuck Abell")` → full name in first-name, empty last), a three-word
   mis-split (`contactRow("David Van Buren")`), an already-structured contact (explicit first + last), and a
   mononym (`contactRow("Madonna")`).
2. Read `src/server/db/migrations/0028_backfill_contact_names.sql` and execute it.
3. Assert:
   - "Chuck Abell" → `first_name = "Chuck"`, `last_name = "Abell"`, `display_name` **unchanged** = "Chuck
     Abell".
   - "David Van Buren" → `first_name = "David Van"`, `last_name = "Buren"` (last-space split).
   - the structured contact and the mononym are **unchanged**.
   - the total contact count is unchanged.
4. Execute the SQL a **second** time → assert zero further change (idempotency).

**Expected**: mis-split rows are split; display/search/dedup keys are identical; correct rows untouched; count
stable; re-run is a no-op.

## Apply (operational — one-time, on `zak1_dev`)

1. **Snapshot first** (project practice for data changes):

   ```bash
   set -a; . ./.env; set +a
   pg_dump -Fc "$DATABASE_URL" -f ~/zak1_pre_0028.dump
   ```

2. Apply: `pnpm run db:migrate` (runs `0028` once; already-applied migrations are skipped).
3. Confirm zero mis-split remain (SC-001):

   ```bash
   psql "$DATABASE_URL" -c "select count(*) from contacts where last_name is null and btrim(first_name) like '% %';"
   ```

   Expect `0`. Spot-check a couple of compound surnames and hand-correct if a split reads oddly.

## Full gate (solo-maintainer mode)

`pnpm exec tsc --noEmit` · `pnpm exec eslint <changed>` · `pnpm exec prettier --check <changed>` · `pnpm test`
· `pnpm build` — all green before the single atomic commit.
