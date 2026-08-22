# Quickstart: Contact Load

Validation/run guide. Implementation lives in `tasks.md` + code; this proves the feature end-to-end.

## Prerequisites

- Local Postgres running and reachable via the app's connection string (same as `pnpm db:migrate`).
- `pg_dump` on PATH.
- Dependencies installed (`pnpm install`) — includes the new `csv-parse`.
- Migration applied: `pnpm db:migrate` (adds `memberships.level`).

## Prepare the three input files (git-ignored `tmp/`)

1. **iContact** — already a CSV export; place at `tmp/icontact.csv`.
2. **Membership workbook** — open `CDR Member DB v1.ods`, export **two** sheets to CSV:
   - `Member` sheet → `tmp/members.csv`
   - `Payer` sheet → `tmp/payers.csv`
   (The `Button Report` and `iContact Report` sheets are not used.)

`tmp/` is git-ignored — the real PII never enters version control.

## 1. Preview (dry-run — writes nothing)

```bash
pnpm contacts:load --icontact tmp/icontact.csv --members tmp/members.csv --payers tmp/payers.csv
```

**Expected**: a `LoadCounts` summary (retained / removed / created / emails / memberships by level /
volunteers / performer link buckets) and **no** change to the database. Any validation error (bad
header, unknown membership level, invalid email) is reported here and stops the run.

## 2. Commit (backup + single transaction)

```bash
pnpm contacts:load --icontact tmp/icontact.csv --members tmp/members.csv --payers tmp/payers.csv --commit
```

**Expected**: a `pg_dump` at `tmp/contact-load-<ts>.dump` is written first, then the load applies in one
transaction and prints the committed summary + an `audit` row. On any failure the DB is unchanged
(rolled back) and a non-zero exit code is returned (see the CLI contract).

## 3. Spot-check the outcome (maps to Success Criteria)

- **SC-001 retention**: a contact that held a role before the run still has its `role_grants`.
- **SC-002 union**: a person present only in iContact, only in Member, and in both each exist once.
- **SC-003 consent**: an email flagged `contra=1, english=blank` carries `contra` + `contact_tracing`
  and **not** `english`; an `english=-1` row is treated the same as blank.
- **SC-004 membership**: a family payer's members each have a membership with the shared expiry + level;
  `membership_status` matches expiry.
- **SC-005 dry-run**: step 1 changed nothing.
- **SC-006 safety**: the `.dump` exists; a forced mid-run failure leaves the DB identical.
- **SC-007 performers**: exact single matches auto-linked; ambiguous/unmatched listed, not applied.

## Automated validation

```bash
pnpm test:integration -- contactLoad   # real-Postgres: retention, roster, consent, membership, dry-run, rollback, performers
pnpm test:unit -- contactLoad          # pure: parsers, date formats, comma-year, consent mapping, name derivation
pnpm typecheck && pnpm lint
```

Per the constitution (Test-First), these tests are written **before** the implementation and must be
green before the feature is committed.
