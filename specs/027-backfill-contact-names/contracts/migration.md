# Contract: migration 0028 — backfill mis-split contact names

No external interface (API/CLI) is added — this is an internal one-time data migration. Its "contract" is the
transform it guarantees over the `contacts` table.

## Migration `0028_backfill_contact_names.sql`

**Applies**: once per database, via `pnpm run db:migrate` (the runner tracks applied files in `_migrations` and
skips ones already run).

**Target set**: contacts where `last_name IS NULL` **and** the trimmed `first_name` contains a space (the
mis-split signature the pre-026 single-name capture produced).

**Transform** (per target row, computed from the original trimmed `first_name`, in one `UPDATE`):

- `first_name` ← the words **before the last space**
- `last_name` ← the **final word**
- `display_name`, `name_normalized`, `dedup_normalized` ← **unchanged** (already derived from the full name)
- every other column, and every non-target row ← **unchanged**

**Guarantees**:

- **Idempotent**: re-running affects zero rows (a corrected row now has a `last_name`).
- **Data-preserving**: contact count unchanged; display/search/dedup keys identical before/after; no
  delete/merge; no other field touched.
- **Best-effort split**: last-space only; a compound surname ("Van Buren") splits imperfectly (accepted,
  Q11) — hand-correctable afterward.

## Verification interface (test)

The integration test executes this exact SQL file against seeded rows (rather than a duplicated statement), so
the tested behavior and the shipped migration are one artifact.

## Unchanged

- No endpoint, no service, no schema; feature 026 (capture), phones (R5-R6), and dedup display (R5-R7) are
  separate.
