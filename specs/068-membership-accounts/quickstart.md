# Quickstart: Validating Membership Accounts

How to prove the feature works. Shapes and rules live in [data-model.md](./data-model.md) and
[contracts/membership-accounts.md](./contracts/membership-accounts.md); this is the run guide.

## Prerequisites

- Local Postgres with `zak1_dev` and `zak1_test`; Node 24 + pnpm.
- **Migration 0043 moves data and drops two tables.** The test suite migrates `zak1_test` automatically
  via `ensureSchema`, but the dev database does not migrate itself:

```bash
pnpm db:migrate
```

**Back up the dev database first.** This feature moves 154 rows onto a new model. It does **not** drop the
legacy tables — that is deferred to a follow-up (research R9), so the original rows remain as the rollback
position. Take the dump anyway; the data move is the riskiest step in the feature:

```bash
pg_dump zak1_dev > ~/zak1_dev_pre_0043.sql
```

## Record the "before" picture

The migration's correctness is judged against these numbers, so capture them first:

```bash
psql zak1_dev -c "SELECT count(*) AS memberships, count(DISTINCT contact_id) AS members, count(DISTINCT payer_id) AS payer_groups FROM memberships;"
```

```bash
psql zak1_dev -c "SELECT level, count(*) FROM memberships GROUP BY level ORDER BY 1;"
```

Expected at time of writing: **154** memberships, **152** distinct member contacts, **115** payer groups;
individual 58 / family 51 / supporter 38 / student 7.

## Automated validation

```bash
pnpm vitest run tests/integration/membership.accounts.test.ts tests/integration/membership.capacity.test.ts tests/integration/membership.derivedStatus.test.ts tests/integration/membership.migration.test.ts tests/integration/exports.memberList.test.ts tests/component/contacts.membershipAccount.test.tsx
```

Then the full suite — this feature re-points read paths in ten files, so the regression run *is* the
evidence:

```bash
pnpm vitest run
```

Gates before commit:

```bash
pnpm tsc --noEmit && pnpm exec eslint src tests
```

Note the pre-existing, unrelated failure in `tests/integration/gate.membership.test.ts` — it asserts a
fresh membership reads `current` and broke at the 1 September rollover. **This feature should fix it**: it
is exactly the stale-status class FR-015 removes. If it still fails afterwards, that is a finding.

## What the suites must demonstrate

| Scenario | Expected outcome | Requirement |
|---|---|---|
| Record dues for a contact with no account | Account opened at the chosen level, expiry derived from the payment date, payer attached | FR-001, FR-002, FR-007 |
| Record dues again for the same payer | Same account, expiry moved forward, members untouched | FR-004 |
| Renew at a different level | Level changes on the same account | FR-024 |
| Attach a second member to a `family` account | Covered; appears on the member list | FR-008, FR-011 |
| Attach to an `individual` or `student` account | Refused | FR-003a |
| Lower a `family` account covering 3 to `individual` | Refused, **naming who would be displaced** | FR-003a, FR-023 |
| Detach the payer | Refused | FR-007, FR-009 |
| Delete a payer's contact | Refused, naming "a membership account" in human wording | FR-009, FR-009a |
| Member of a lapsed account | Still on the member list, marked lapsed | FR-012 |
| Contact on no account | Absent from the member list regardless of history | FR-011 |
| Export a household sharing one address | One row (feature 067 dedupe still applies), carrying the payer's level | FR-013 |
| **Download** the member CSV | The file itself carries `membership_level` — the column list lives in the route, so a service-level check is not enough | FR-013 |
| Contact **search** after the boundary passes | Rows show the derived status, not the stored column | FR-015 |
| A contact who pays for nothing | Blank level, real status | FR-013 |
| Status after the year boundary passes | Reads `lapsed` with **no** write, refresh, or job | FR-015, SC-005 |
| Stale `contacts.membership_status` | Ignored by every read path — the derivation wins | FR-015 |
| Migration | 115 accounts, 152 members covered, levels and expiries preserved | FR-016, SC-004 |
| Contact-less payer | Matched by name, else contact created and flagged `needs_review` | FR-021, SC-007 |

## Manual pass (auth-gated)

1. `pnpm dev`, sign in as an FS/Treasurer/Super-user.
2. Open a **payer's** record — Cindy Culbert is a good case (supporter, 4 members). Confirm the account
   block lists the other members, and that it is **visually distinct** from the 067 shared-email block
   (FR-020). Those two households overlap here but are different facts.
3. Open a **member's** record (Abigail). Confirm it names Cindy as payer and shows no level of its own.
4. Record a dues payment on the payer's record; confirm the expiry moves and members are untouched.
5. Try to lower the level to `individual`; confirm the refusal names the displaced members.
6. Sign in as the **mailing-list manager**. Confirm the account block is **visible but not editable** —
   FR-017 keeps membership writes with the FS/Treasurer.
7. Download the **member** export; confirm the level column, that lapsed members are present, and that a
   shared-address household still produces one row.

## Rollback

Safer than it looks: the legacy `memberships` and `payers` tables are **retained**, so the original data is
still there. Reverting the code leaves the new tables populated but unread, and the old model intact.
Restore from the dump only if the data move itself went wrong.
