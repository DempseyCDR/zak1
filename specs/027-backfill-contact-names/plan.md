# Implementation Plan: Backfill existing mis-split contact names (R5-P2)

**Branch**: `027-backfill-contact-names` (solo-maintainer mode, constitution v1.3.0 — one atomic commit to
`main`) | **Date**: 2026-07-31 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/027-backfill-contact-names/spec.md`

## Summary

A one-time **data repair**: re-split every contact whose full name was stored in `first_name` with an empty
`last_name` (the pre-026 single-name capture) into a proper first + last, splitting at the **last** space. It
touches **only** `first_name`/`last_name` — `display_name`, `name_normalized`, and `dedup_normalized` already
derive from the full name, so they stay identical (no display/search/dedup drift). It follows the repo's
established pattern (0027 did its backfill inline in the migration): a single idempotent `UPDATE` in a new SQL
migration **`0028_backfill_contact_names.sql`**, guarded by `last_name IS NULL AND <first_name has a space>` so
a corrected row is never re-split and a re-run changes nothing. Applies to **all** mis-split contacts (not only
performer-sourced). Depends on 026 (capture already fixed), so no new mis-split rows appear after this.

## Technical Context

**Language/Version**: TypeScript 5.7 (strictest) · Node 24 · pnpm · PostgreSQL 16

**Primary Dependencies**: Drizzle (raw `sql` for the test to execute the migration) · the hand-authored SQL
migration runner (`src/server/db/migrate.ts`, applies `*.sql` in lexical order, tracked in `_migrations`).
**No new runtime dependency.**

**Storage**: PostgreSQL 16. **One migration** — `0028_backfill_contact_names.sql` (data-only `UPDATE`; **no
schema change**, no new column). Uses existing `contacts` (`first_name`, `last_name`, `display_name`,
`name_normalized`, `dedup_normalized`).

**Testing**: Integration (node, real Postgres). Because a migration runs at schema-setup (before test data
exists), the test **reads the `0028` SQL file and executes it** against contacts it seeds — testing the real
artifact, single source of truth, safe to re-exec (idempotent). Asserts: mis-split → split first/last with an
**unchanged** display name; three-word → split at the last space; already-structured and mononym contacts
untouched; contact count unchanged; a second run changes zero rows.

**Target Platform**: Web, single tenant. This is a maintenance/data feature — no UI, no endpoint.

**Project Type**: Next.js App Router monolith; the change is a DB migration + a test.

**Performance Goals**: One `UPDATE` over ~1.3k rows touching ~40. Trivial.

**Constraints**: Data-preserving — only first/last move; display/search/dedup keys unchanged (they derive from
the full name); no delete/merge; idempotent by the `last_name IS NULL` guard. Best-effort last-space split
(accepted lossy for compound surnames, Q11). A pre-migration snapshot is taken before applying to `zak1_dev`
(project practice). Existing suite stays green.

**Scale/Scope**: 1 SQL migration + 1 integration test. No code paths change; no schema change.

## Constitution Check

*GATE: Must pass before Phase 0. Re-check after Phase 1.* Constitution v1.3.0 (principles I–IV).

| Principle | Verdict |
|---|---|
| **I. Test-First** | **PASS** — the integration test (seed mis-split / structured / mononym / three-word → execute the `0028` SQL → assert split, unchanged display, untouched correct rows, stable count, idempotency) is written before the migration and runs against real Postgres. Testing a one-time migration by executing its own SQL keeps a single source of truth. |
| **II. YAGNI** | **PASS** — one guarded `UPDATE`, matching the 0027 inline-backfill precedent; no new column, no service, no smarter name parsing (particles explicitly out of scope). |
| **III. Type Safety** | **PASS (n/a-heavy)** — no new typed boundary; the migration is SQL and the test uses typed Drizzle inserts + a raw execute of the migration file. |
| **IV. Observability** | **PASS** — the migration runner logs applied files; the `UPDATE`'s effect (rows corrected) is verifiable and covered by the test. No new logging surface. |

**Development Workflow**: solo-maintainer mode — one atomic commit to `main`, full local gate as the reviewer.
**Operational**: take a `pg_dump` snapshot before `pnpm run db:migrate` applies `0028` to `zak1_dev` (the
established pre-migration practice), giving a rollback path for the heuristic split.

### Post-Design Re-Check

Re-evaluated after Phase 1: **still PASS.** A data-only migration mirroring 0027; the split is verified on the
real data shape; keys are unchanged by construction; the test exercises the actual SQL artifact.

## Project Structure

### Documentation (this feature)

```text
specs/027-backfill-contact-names/
├── plan.md              # This file
├── research.md          # R1..R5 (decisions)
├── data-model.md        # the contacts UPDATE transform + invariants (no schema change)
├── quickstart.md        # validation + operational apply (snapshot → migrate)
├── contracts/
│   └── migration.md      # the 0028 transform "contract" (target set, split rule, unchanged keys)
├── checklists/requirements.md  # complete (from /speckit-specify)
└── tasks.md             # /speckit-tasks (NOT created here)
```

### Source Code (repository root)

```text
src/server/db/migrations/0028_backfill_contact_names.sql   (new) idempotent UPDATE: split last space; guard
                                                            last_name IS NULL AND first_name has a space
tests/integration/contactNameBackfill.test.ts              (new) seed → execute the 0028 SQL → assert
```

**Structure Decision**: No structural change and no application code change — a single data migration plus its
integration test. The repair lives in SQL (the repo's migration medium and its backfill precedent), and the
test executes that same SQL so there is one source of truth.

## Complexity Tracking

> No constitution deviation, no schema change. The only subtlety is testing a one-time migration: resolved by
> having the test execute the migration's own SQL against seeded rows (idempotent, so re-execution is safe),
> rather than duplicating the split logic in TypeScript.
