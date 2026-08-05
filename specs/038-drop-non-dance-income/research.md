# Phase 0 Research: Remove the Non-Dance Income Capability

The spec is unambiguous (removal; account-mapping catalog retained). No `NEEDS CLARIFICATION`. The remaining
decisions are mechanical (how to drop safely, how to test a removal); resolved below.

## R1 — Dropping the table (destructive, idempotent, snapshot-first)

- **Decision**: New migration `src/server/db/migrations/0031_drop_non_dance_income.sql`:
  `DROP TABLE IF EXISTS non_dance_income;` (drops the `non_dance_income_event` index with the table). Take
  `~/zak1_pre_0031.dump` before applying to `zak1_dev`; `zak1_test` is auto-migrated.
- **Rationale**: The project uses additive, hand-authored SQL migrations and never edits old ones (`0006` created
  the table). `IF EXISTS` makes it idempotent (FR-006). A `pg_dump` snapshot matches the data-migration safety
  convention used for `0028`/`0030`. Money-in-cents is unaffected (the table is discarded whole).
- **Alternatives considered**: editing `0006` to not create the table (forbidden — never rewrite history);
  keeping the table but hiding the UI (leaves dead schema — not a real removal).

## R2 — Order of removal (type-driven)

- **Decision**: Remove the schema export, the Zod schema/type, the service, the route, and the reader/page usage;
  drop the `nonDanceIncome` field from `TreasurerReport`. Let `tsc --noEmit` enumerate every dangling reference.
- **Rationale**: Constitution III — the compiler is the safety net for a clean removal. Removing the type field
  first makes every remaining reader a compile error, so nothing is missed.
- **Alternatives considered**: grep-only removal (misses transitive references that the type checker catches).

## R3 — Testing a removal (test-first)

- **Decision**: Three test moves —
  1. **Migration guard** (`tests/integration/migration.dropNonDanceIncome.test.ts`): read + execute the `0031`
     SQL against a migrated DB; assert `non_dance_income` no longer exists (via `information_schema.tables`); run
     it a second time to prove idempotency. Written first (RED — file missing).
  2. **Report** (extend `treasurer.report.test.ts`): assert the returned report has **no** `nonDanceIncome`
     property (runtime `not.toHaveProperty`, type-independent). RED against current code → GREEN after removal.
  3. **Page** (`treasurer.page.test.tsx`): remove the `nonDanceIncome` mock-report field and assert the
     "Non-Dance Income" section/form is **not** rendered. RED now → GREEN after removal.
  Delete the obsolete `treasurer.non-dance-income.test.ts`.
- **Rationale**: The migration is a genuine TDD cycle; the report/page removals are codified by "absent"
  assertions (the honest test-first posture for a deletion — the new state is *absence*, and it is asserted). The
  `002…` other treasurer tests already don't reference NDI (only the deleted file did), so nothing else breaks.
- **Alternatives considered**: no tests, "just delete and run the suite" (fails Constitution I — the removal's
  intent wouldn't be codified; a future re-add wouldn't be caught).

## R4 — The `account_mapping` row (retain catalog, drop the row)

- **Decision**: Remove the seeded `('non_dance_income','4910',…)` row from `seed.ts` and the test helper
  (`db.ts`), and the `account("non_dance_income")` lookup in the report. Keep the `account_mapping` **table** and
  every other line item. Do **not** write a data migration to delete an existing `non_dance_income` mapping row
  from `zak1_dev`/prod — a leftover row is harmless (nothing reads it once the report section is gone).
- **Rationale**: FR-007 — the catalog is shared; only this line item is unused. Avoiding an extra data migration
  keeps the change minimal (YAGNI).
- **Alternatives considered**: a migration to delete the mapping row (needless — orphan is inert); dropping the
  whole `account_mapping` table (that is P6-R7, a separate feature — out of scope).

## R5 — `resetDb` truncate list

- **Decision**: Remove `non_dance_income` from the `resetDb` `TRUNCATE …` list in `tests/integration/helpers/db.ts`.
- **Rationale**: After `0031` drops the table, `TRUNCATE non_dance_income` would error every test run. The Drizzle
  schema no longer defines it either.
- **Alternatives considered**: none — required for the suite to run.
