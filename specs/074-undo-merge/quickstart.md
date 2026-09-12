# Quickstart: Undo merge

How to prove this feature works, end to end. Automated first, then the manual pass for the parts a test
cannot judge.

## Prerequisites

- Local PostgreSQL 16 running, with the dev database migrated to **0047**.
- A dev server started through the Browser pane, not `pnpm dev` in a terminal — a long-running `next dev`
  accumulates idle connections and will lock out both `psql` and the test suite.
- Sign-in as a holder of `dedup.write` (the mailing-list manager) for most scenarios, and as a holder of
  `role.assign` for §4.

## Automated gates

```bash
pnpm db:migrate && pnpm vitest run && pnpm tsc --noEmit
```

```bash
pnpm eslint src/server/domain/dedup src/app/api/dedup && pnpm lint:md
```

The three new integration suites carry the load:

| Suite | Proves |
|---|---|
| `tests/integration/dedup.mergeManifest.test.ts` | The merge records every move, create, destroy and overwrite it performs — including the household rows lost to the account cascade, which no statement in the merge names. |
| `tests/integration/dedup.unmerge.test.ts` | The reversal restores each of them, and each skip path (`gone`, `occupied`, `not_authorized`) is reached and reported. |
| `tests/integration/dedup.mergeHistory.test.ts` | Every reversibility verdict is produced by the condition that should produce it. |

The existing `dedup.contactReferences.test.ts` parity guard is extended: a `move` reference that does not
declare its primary key now fails the build.

## Manual validation

### 1. The round trip (User Story 1)

Merge a pair with something in every category — both records holding emails, one holding a membership,
both attending a common event, one linked to a performer. Confirm the merge completes, then open the
surviving contact and undo it.

Expect: the retired contact live again; its emails, membership, attendance, performer link and roles back
on it; the duplicate attendance row that was dropped on collision present again on the restored contact;
the surviving contact holding only what it held before.

Verify from the database as well as the UI, since the point of the feature is what happened to rows. Edit
the two names and paste — no psql variables, because `:name` placeholders are substituted by psql and
error out when unset:

```sql
SELECT c.display_name,
       c.merged_into_id IS NULL AS live,
       (SELECT count(*) FROM contact_emails    e WHERE e.contact_id = c.id) AS emails,
       (SELECT count(*) FROM attendance        a WHERE a.contact_id = c.id) AS attendance,
       (SELECT count(*) FROM performers        p WHERE p.contact_id = c.id) AS performers,
       (SELECT count(*) FROM membership_members m WHERE m.contact_id = c.id) AS households,
       (SELECT count(*) FROM role_grants       g WHERE g.contact_id = c.id) AS grants
  FROM contacts c
 WHERE c.display_name IN ('Zeke Smukler', 'David Smukler')
 ORDER BY c.display_name;
```

Then check what the undo actually recorded, which the UI cannot show. `skipped` should be `[]` on a clean
round trip, and `restored_counts` should name every table that came back:

```sql
SELECT jsonb_array_length(ma.reversal_manifest -> 'entries') AS manifest_entries,
       mr.actor, mr.restored_counts, mr.skipped, mr.created_at
  FROM merge_audit ma
  LEFT JOIN merge_reversals mr ON mr.merge_audit_id = ma.id
 WHERE ma.merged_id = (SELECT id FROM contacts WHERE display_name = 'Zeke Smukler');
```

### 2. The account fold (User Story 1, the destructive case) — BLOCKED, not walkable

**Cannot be walked through the UI, for two independent reasons**, both pre-existing gaps rather than
anything this feature introduced:

1. **There is no UI that creates a membership account.** `POST /api/contacts/[id]/membership/payment`
   and `POST /api/memberships` both exist, but nothing outside `src/app/api/` calls either.
   `MembershipAccount.tsx` renders only for a contact that already HAS an account, and offers level
   change and add/remove member — never creation. So the two-payer state cannot be constructed.
2. **A `two_accounts` hold cannot be resolved in the UI.** The needs-review queue's **Resolve** button
   calls `openRecord()` — it opens the contact record. The held-merge resolution chooser is unbuilt for
   all three reasons, and is tracked in
   `specs/phase-8-requirements/mel-maintenance-remaining.md`.

**What covers it instead**: `dedup.unmerge.test.ts` — "restores the discarded account, its household,
and the cascade-lost rows" — builds exactly this scenario against real Postgres, including the member on
BOTH accounts whose row is cascade-deleted rather than copied. It calls `mergeContacts(…,
{ survivingAccountId })`, which is precisely what `resolveHeldMerge` calls for a `two_accounts` hold, so
the manual walk would add only the HTTP layer. Re-walk this section when the resolution chooser ships.

### 2b. The account fold (original text, for when the chooser exists)

Merge two contacts that **each** pay for a household, resolving the resulting `two_accounts` hold. Note
the discarded account's level and expiry before you resolve it. Undo.

Expect: the discarded account back, with the same level, expiry and last-payment date; the two households
separated again; every member that was on the discarded account attached to it once more — including any
member who was already on the surviving account, because those rows were cascade-deleted rather than
copied. This is the case that has no statement in the merge and is the most likely to be got wrong.

### 3. Age and honesty (User Story 2)

Open a contact produced by one of the **36 pre-existing merges** in the dev database.

Expect: the merge listed in the history, marked not reversible, stating that it was recorded before undo
existed — and **no undo control at all**. An action that would fail must not be offered.

Then open a contact from a merge made today and confirm it shows as reversible with its age and an
activity count.

### 4. The sign-in gate (User Story 3)

**Walk the substitute below, not the original.** The original needs a `two_logins` hold resolved, and
that chooser does not exist — see §2. The substitute exercises the same gate (FR-024/FR-025) with no hold
at all, because where only one side can sign in the binding simply MOVES.

**Substitute:** merge a contact that has signed in (so it has a sign-in binding) into one that has not.
No hold is raised. Then undo **as Mel** — `dedup.write`, without `role.assign`.

Expect: the undo completes; everything except the sign-in is restored; the result names the sign-in as
skipped, saying a Vice-President, President or Super-user can complete it. Then repeat as a `role.assign`
holder and confirm the binding returns to the restored contact.

This matters because moving a binding BACK changes who can sign in just as much as recreating a deleted
one — the gate is deliberately wider than "re-creation only", and nothing else in this manual pass
touches it.

### 4b. The sign-in gate, original (for when the chooser exists)

Merge two contacts that can **both** sign in, resolving the `two_logins` hold so one binding is deleted.
Undo as a holder of `dedup.write` **without** `role.assign`.

Expect: the undo completes; everything non-sign-in is restored; the report names the sign-in entries as
skipped for want of authority. Then repeat as a holder of `role.assign` and confirm the binding returns to
the restored contact and its address is marked as a sign-in address again.

Worth confirming directly, since it is the reason skipping is acceptable: a person whose binding was
skipped can still sign in, because enrolment is automatic and the login address went back with the undo.

### 5. Chains (Edge case, FR-008)

Merge A into B, then B into C. Open C and try to undo the inner merge.

Expect: the A→B merge shown as not currently reversible, explaining that the later merge must be undone
first. Undo B→C, then confirm A→B becomes reversible.

### 6. Activity after the merge is never touched (SC-005)

Merge a pair, then add an email and an attendance record to the **surviving** contact. Undo.

Expect: both additions still on the survivor, untouched. An undo returns what the merge moved and nothing
else.

## Known limitation to confirm, not fix

If the surviving record was edited by hand to absorb the merged one's details — a phone number retyped,
say — the undo cannot know and will not remove it. Confirm the behaviour matches the spec's Edge Cases
rather than treating it as a defect.
