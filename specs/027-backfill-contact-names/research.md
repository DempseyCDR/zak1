# Research: Backfill existing mis-split contact names

Decisions resolving the plan's unknowns. No open `NEEDS CLARIFICATION` — the requirement and its Phase 5
resolution (P5-R5 / Q11) are settled, and the mechanics are confirmed against the real data and the repo's
migration pattern.

## R1 — Ship the repair as an inline SQL migration (0028), matching the 0027 precedent

**Decision**: The backfill is a single new migration file `src/server/db/migrations/0028_backfill_contact_names.sql`
containing one guarded `UPDATE`. The migration runner (`migrate.ts`) applies `*.sql` in lexical order, tracks
them in `_migrations`, and skips already-applied files — so this runs once per database on `pnpm run db:migrate`.

**Rationale**: FR-001/FR-004. The repo already does data backfills **inline in the migration** (0027 backfilled
`payment_bookings.amount_cents` with UPDATEs). Following that keeps one medium for data changes and the runner's
once-only tracking. No script, no new column.

**Alternatives**: A `tsx` data-fix script (like `auth:bootstrap`) — rejected (backfills live in migrations here;
a script wouldn't be tracked by `_migrations` and could be re-run by accident). A TS domain function mirrored by
SQL — rejected (two sources of truth, drift risk).

## R2 — Split at the last space via a regex substring; both fields from the original `first_name`

**Decision**: The `UPDATE` computes, from the **btrim'd** original `first_name`:

- `first_name` = everything before the last space — `substring(btrim(first_name) from '^(.*) [^ ]+$')`
- `last_name` = the final word — `substring(btrim(first_name) from ' ([^ ]+)$')`

both wrapped in `btrim`, guarded by `WHERE last_name IS NULL AND btrim(first_name) LIKE '% %'`. In one `UPDATE`
both SET expressions read the **pre-update** `first_name`, so there is no ordering hazard.

**Rationale**: FR-001 + the three-word edge case. Verified on the live data: "David Smukler"→(David, Smukler),
"Chuck Abell"→(Chuck, Abell), "David Van Buren"→(David Van, Buren). `btrim` handles leading/trailing/doubled
spaces so the split is clean.

**Alternatives**: Split on the FIRST space — rejected (mangles ordinary two-word names less predictably and
puts compound given names in last-name). Particle-aware parsing ("van", "de", "Mc") — rejected (out of scope,
YAGNI; a rare bad split is hand-correctable).

## R3 — Touch only first/last; display, search, and dedup keys are unchanged by construction

**Decision**: The migration sets **only** `first_name` and `last_name`. It does **not** write `display_name`,
`name_normalized`, or `dedup_normalized`.

**Rationale**: FR-002. Those keys already derive from the full name: for a mis-split row `display_name` =
the full first-name value, `dedup_normalized` = normalize(full name). After the split, the structured
"first last" reproduces the same full name, so all three keys remain correct and identical — no recompute, no
drift. (Confirmed: the mis-split rows have `display_name` equal to the full `first_name`.)

**Alternatives**: Recompute all name keys in the migration — rejected (unnecessary writes; risks changing a key
that is already correct, e.g. a display override, and widens the blast radius).

## R4 — Test the one-time migration by executing its own SQL against seeded rows

**Decision**: The integration test `tests/integration/contactNameBackfill.test.ts` seeds contacts (a mis-split
one via `contactRow("Chuck Abell")`, a three-word mis-split, an already-structured one, a mononym), **reads the
`0028` SQL file from disk and executes it** (raw), then asserts the outcomes; it executes a second time to prove
idempotency (zero further change).

**Rationale**: Constitution Principle I. A migration runs at schema-setup before any test data exists, so it
can't be observed on seeded data the usual way. Executing the **actual migration file** against seeded rows
tests the real artifact with a single source of truth, and the `last_name IS NULL` guard makes re-execution
safe (so running it again in-test is legitimate and also proves idempotency).

**Alternatives**: Duplicate the split SQL/logic in the test — rejected (drift). Assert only post-`db:migrate`
state — rejected (nothing to fix at test time; `resetDb` truncates).

## R5 — Scope: all mis-split contacts; snapshot before applying

**Decision**: The target set is **every** contact with `last_name IS NULL AND btrim(first_name) LIKE '% %'`,
regardless of `source` (performer or otherwise) — FR-005. Operationally, take a `pg_dump` snapshot before
`pnpm run db:migrate` applies `0028` to `zak1_dev` (the repo's pre-migration practice), so the heuristic split
is reversible.

**Rationale**: FR-005/FR-006. "Mis-split" is defined by the data signature, not the source; the ~40 affected
rows include performer-created and a few other-source records, all of which want the same fix. The snapshot
covers the small residual risk of a bad compound-surname split.

**Alternatives**: Limit to `source = 'performer'` — rejected (leaves other mis-split rows broken; the spec asks
for all). Add a review/approval step — rejected (over-engineered for ~40 rows with a snapshot safety net).
