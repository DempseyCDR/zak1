# Quickstart: Validating Triage Mode

Shapes and rules live in [data-model.md](./data-model.md) and [contracts/triage.md](./contracts/triage.md);
this is the run guide.

## Prerequisites

- Local Postgres with `zak1_dev` and `zak1_test`; Node 24 + pnpm.
- This feature adds **migration 0044** (two additive tables — nothing altered or dropped). The test suite
  migrates `zak1_test` via `ensureSchema`; the dev database does not migrate itself:

```bash
pnpm db:migrate
```

Additive only, so no backup is required — unlike 068. Reverting the code leaves two unread tables.

## Automated validation

```bash
pnpm vitest run tests/integration/dedup.rejections.test.ts tests/integration/dedup.mergeAccounts.test.ts tests/integration/dedup.heldMerge.test.ts tests/integration/dedup.suggestions.test.ts tests/component/contacts.duplicatePair.test.tsx
```

Then the full suite — this feature changes the merge, which several existing suites depend on:

```bash
pnpm vitest run
```

Gates before commit:

```bash
pnpm tsc --noEmit && pnpm exec eslint src tests
```

## What the suites must demonstrate

| Scenario | Expected outcome | Requirement |
|---|---|---|
| Reject a pair | Absent from the queue on reload | FR-002 |
| Change a **first or last name** on either side | Pair offered again, with no write to the rejection | FR-003, FR-003a |
| Change only a **display-name override** | Pair stays suppressed | FR-003 |
| Rename back to the judged name | Suppression applies again | Edge case |
| List with `includeRejected` | Rejected pairs shown with who and when; un-reject restores | FR-004, FR-004a |
| Row content | Carries record age, membership standing, and shared-household facts | FR-001 |
| `safeToReject` | True exactly when the row shows everything the decision needs | FR-005, FR-006 |
| Merge an account owner | The **account and its attachments move to the survivor** | R2 (068 defect) |
| Merge — legacy tables | `memberships` / `payers` are **not** touched | R2 |
| Merge two contacts who both sign in | `held`, **nothing changed**, `two_logins` raised | FR-011, FR-013 |
| Same, as a `role.assign` holder choosing a sign-in | Completes; the chosen login survives | FR-012 |
| Merge two contacts who both own an account | `held`, nothing changed, `two_accounts` raised | R3 |
| Held merge in the needs-review queue | Present, naming both contacts and the reason, distinct from a flagged contact | FR-014 |
| Clear a contact's review flag | The held merge is **unaffected**, and vice versa | FR-014a |
| Either contact merged away or archived | The hold closes without merging | Edge case |
| Link as shared, from the pair | Records the household; names the adopted address; confirms before retiring an owned one | FR-015a, FR-015b |
| Pair already linked as a household | Never proposed (067), rejection not needed | Edge case |

## Manual pass (auth-gated)

1. `pnpm dev`, sign in as someone holding `dedup.write` (Mel — `mailing_list_manager` — qualifies).
2. Open **Contacts → Review duplicates**. Confirm each row shows enough to judge without opening anything,
   and that a row where the decision needs more offers **open to resolve** instead of a one-click action.
3. Reject a pair; reload; confirm it is gone. Reveal rejected pairs from the queue, confirm it is listed
   with who and when, and un-reject it.
4. Edit one contact's **last name**; confirm the pair returns. Edit only the **display-name override** on
   another rejected pair; confirm that one stays gone.
5. Open a pair. Confirm the comparison shows **every** email on both sides, whatever its status, and says
   the survivor inherits them all. Confirm all three resolutions are offered, with merge visibly the
   destructive one.
6. Merge two contacts where one owns a membership account; confirm the account and its members are on the
   survivor afterwards.
7. Sign in as someone **without** `role.assign` and attempt to merge two volunteers who both sign in.
   Confirm nothing changes, the reason is explained as a staff-identity decision, and a task appears in the
   review queue. Then sign in as a VP/President and resolve it.
8. Confirm `/dedup` no longer exists and nothing it offered has been lost.

## Rollback

Additive: two unread tables and a deleted page. Reverting the code restores `/dedup`; the merge reverts to
its previous behaviour — including, note, the two defects this feature fixes.
