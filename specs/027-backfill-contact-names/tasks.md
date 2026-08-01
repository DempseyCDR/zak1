---
description: "Task list for feature 027 — backfill mis-split contact names (R5-P2)"
---

# Tasks: Backfill existing mis-split contact names (R5-P2)

**Input**: Design documents from `specs/027-backfill-contact-names/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/
**Tests**: INCLUDED — the constitution (v1.3.0, Principle I) mandates test-first.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: parallelizable (different files, no dependency on an incomplete task)
- **[Story]**: US1..US2 (from spec.md)
- Exact file paths included.

## Notes

A one-time **data repair**: split the full name stored in `first_name` (empty `last_name`) into first + last at
the **last** space, via one idempotent `UPDATE` in a new SQL migration — matching the repo's inline-backfill
precedent (0027). Touches **only** first/last; `display_name`/`name_normalized`/`dedup_normalized` already derive
from the full name, so they're unchanged. Idempotent by the `last_name IS NULL` guard. Applies to **all**
mis-split contacts. Depends on 026 (capture fixed). ⚠️ Testing a one-time migration: the test **reads and
executes the 0028 SQL file** against seeded rows (single source of truth; re-exec is safe). Ships as one atomic
commit; the operational apply to `zak1_dev` (snapshot → `db:migrate`) is a manual post-commit step.

---

## Phase 1: Setup

- [ ] T001 No new infra — confirm **no schema change** (data-only `UPDATE`), that the next migration number is **0028**, and that the test helper re-exports the raw `sql` client (`tests/integration/helpers/db.ts` → `sql` from `@/server/db/client`) for executing the migration file.

---

## Phase 2: User Story 1 — Existing mis-split contacts get a proper first and last name (P1) 🥇 MVP

**Goal**: A contact with the full name in `first_name` and an empty `last_name` is re-split into first + last
(last-space), with the display name unchanged.

**Independent Test**: Seed a mis-split contact, run the repair, and confirm first/last are split correctly and
the display name is unchanged.

- [ ] T002 [P] [US1] Write `tests/integration/contactNameBackfill.test.ts` (US1 cases): seed via `contactRow(...)` a mis-split contact (`"Chuck Abell"` → `first_name` holds the full name, `last_name` null) and a three-word mis-split (`"David Van Buren"`); read `src/server/db/migrations/0028_backfill_contact_names.sql` from disk and execute it (`sql.unsafe(text)`); assert `"Chuck Abell"` → `first_name="Chuck"`, `last_name="Abell"`, `display_name` **unchanged** = "Chuck Abell" (and `dedup_normalized` unchanged); `"David Van Buren"` → `first_name="David Van"`, `last_name="Buren"`.
- [ ] T003 [US1] Create `src/server/db/migrations/0028_backfill_contact_names.sql`: one `UPDATE contacts SET first_name = btrim(substring(btrim(first_name) from '^(.*) [^ ]+$')), last_name = btrim(substring(btrim(first_name) from ' ([^ ]+)$')) WHERE last_name IS NULL AND btrim(first_name) LIKE '% %';` — both fields computed from the original `first_name` in one statement; do **not** write `display_name`/`name_normalized`/`dedup_normalized`. Header comment explains the R5-P2 repair + idempotency guard.

**Checkpoint**: mis-split contacts are correctly split; display/search/dedup keys unchanged.

---

## Phase 3: User Story 2 — The repair is safe: skips correct contacts and is re-runnable (P1)

**Goal**: Already-structured and mononym contacts are untouched; the total count is unchanged; a second run
changes nothing.

**Independent Test**: Run the repair on a directory of already-structured + mononym contacts; none change; run
again → zero further change.

- [ ] T004 [US2] Extend `tests/integration/contactNameBackfill.test.ts` with US2 cases: also seed an already-structured contact (explicit `first_name`/`last_name`) and a mononym (`contactRow("Madonna")` → no space); after executing 0028, assert both are **unchanged** and the **total contact count is unchanged** (no delete/merge); then execute the 0028 SQL a **second** time and assert **zero** further change (idempotency — corrected rows now have a `last_name` and no longer match).

**Checkpoint**: correct data is never corrupted; the repair is safe to re-run.

---

## Phase 4: Polish + cross-cutting

- [ ] T005 Full gate (solo-maintainer mode): `pnpm exec tsc --noEmit`; `pnpm exec eslint <changed>`; `pnpm exec prettier --check <changed>`; `pnpm test`; `pnpm build`. All green. (The 0028 migration is applied to `zak1_test` at `ensureSchema` on empty data — a no-op there; the test exercises it against seeded rows.)
- [ ] T006 [P] Update `zak1_Phase5_Requirements.md`: mark **R5-P2 SHIPPED as feature 027** (backfill migration `0028`); the R5 cluster's remaining piece done. Note latest migration is now `0028`.
- [ ] T007 **Operational (manual, post-commit — not part of the gate):** apply to `zak1_dev` — `pg_dump -Fc "$DATABASE_URL" -f ~/zak1_pre_0028.dump` (snapshot), then `pnpm run db:migrate`, then verify `select count(*) from contacts where last_name is null and btrim(first_name) like '% %';` returns `0` (SC-001); spot-check compound surnames and hand-correct any odd split.

---

## Dependencies & execution order

- **T002 (test)** authored first (TDD); it reads the 0028 file, so it stays red (file missing) until **T003**.
- **T003 (migration)** makes T002 pass.
- **T004 (US2 assertions)** after T002 + T003 (same test file; the migration must exist to re-execute).
- **Polish (T005/T006)** after the test + migration are green. **T007** is a manual operational step after the
  commit is merged (it mutates dev data; take the snapshot first).
- US1 (split + migration) is the MVP; US2 (safety/idempotency) is assertions over the same artifact.

### Parallelizable

- **T002** [P] (its own file, before the migration exists). **T006** [P] (docs). T003/T004 touch the single
  migration file / single test file respectively (sequential with their story peers).

## Implementation strategy

Ship the **migration + test** as one atomic commit once T005 is green. Then run the **operational apply**
(T007) on `zak1_dev` behind a snapshot. No schema change; the load-bearing property is that the split is
data-preserving for the derived keys (verified) and idempotent by guard — both covered by the test.

## Summary

- **Total tasks**: 7 (Setup 1 · US1 2 · US2 1 · Polish 3, incl. 1 manual operational)
- **Test tasks**: T002 (US1), T004 (US2) — one file, both stories
- **Parallel opportunities**: T002; T006
- **MVP scope**: **US1** (the split migration + its test); US2 adds the safety/idempotency assertions.
