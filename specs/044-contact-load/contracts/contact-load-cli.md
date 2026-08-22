# Contract: Contact Load CLI

The only interface this feature exposes. No HTTP route (FR-017). Invoked in the operator-tooling family
alongside `db:migrate` / `auth:bootstrap`.

## Invocation

```bash
pnpm contacts:load \
  --icontact <path/to/icontact.csv> \
  --members  <path/to/member-sheet.csv> \
  --payers   <path/to/payer-sheet.csv> \
  [--commit]        # default OFF = dry-run (preview only, no writes, no backup)
  [--backup-dir <dir>]   # default: tmp/  (git-ignored)
```

- Runs against the database in the environment's connection string (same as `db:migrate`), loaded via
  `loadEnv`.
- **Dry-run is the default.** Writes and the `pg_dump` backup happen **only** with `--commit`.

## Preconditions

- All three CSV files exist and are readable; each parses with the expected header (R2).
- Migration `0033` has been applied (`memberships.level` exists).
- Operator has DB write access and `pg_dump` on PATH (checked before the transaction on `--commit`).

## Behavior

| Mode | Backup | Writes | Output |
|------|--------|--------|--------|
| dry-run (default) | none | none | validation results + `LoadCounts` it *would* apply |
| `--commit` | `pg_dump` custom-format to `--backup-dir` first; abort on failure | single transaction; all-or-nothing | backup path + applied `LoadCounts` + performer-link lists |

Validation errors (bad header, unknown `Level`, invalid email, unparseable required field) are reported
and **stop** the run before any write, in both modes.

## Audit summary (stdout + `audit` row on `--commit`)

```text
Contact Load — <timestamp>  [DRY RUN | COMMITTED]
  backup:              tmp/contact-load-<ts>.dump         (commit only)
  contacts retained:   <n>   (role-grant holders)
  contacts removed:    <n>
  contacts created:    <n>   (of which needs_review: <n>)
  emails created:      <n>
  memberships created: <n>   (levels: individual <n>, family <n>, supporter <n>, student <n>)
  volunteers set:      <n>
  performer links:     auto <n>, ambiguous <n>, unmatched <n>
  ambiguous performers: [name → candidate contacts…]
  unmatched performers: [name…]
```

On `--commit`, one `audit` row is written (actor = operator, action = `contact_load`, payload =
`LoadCounts`) via `writeAudit`, consistent with `bootstrapOfficer`.

## Exit codes

| Code | Meaning |
|------|---------|
| 0 | Success (dry-run completed, or commit applied & transaction committed) |
| 1 | Validation failure (no writes) |
| 2 | Backup failure on `--commit` (no writes) |
| 3 | Transaction failed and rolled back (DB unchanged) |

## Postconditions (`--commit`)

- Every pre-run role-grant holder still exists with grants intact (SC-001).
- Every person in the union of the three files exists as exactly one contact (SC-002).
- Loaded emails carry consent = list flags + `contact_tracing` (SC-003).
- Members with a payer have a membership with matching expiry + level; statuses recomputed (SC-004).
- A recoverable backup exists (SC-006); a failed run leaves the DB identical to pre-run (SC-006).
- Performer auto-links are exact-only; ambiguous/unmatched reported, not applied (SC-007).
