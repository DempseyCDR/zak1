# Quickstart: verifying merge relinking

## Prerequisites

```bash
pnpm install
pnpm db:migrate          # applies 0046 — the role_conflict enum value, the only migration
```

The historical repair (FR-015) is **not** a migration. It is a tested routine run once, deliberately, so
that its chain resolution and collision handling are covered by tests:

```bash
pnpm db:repair-merges
```

The integration suite runs against a real Postgres and migrates `zak1_test` automatically. If the whole
suite fails at once with `sorry, too many clients already`, a long-running `next dev` has exhausted the
connection pool — restart it before debugging anything.

## Automated verification

```bash
pnpm vitest run && pnpm tsc --noEmit
pnpm eslint src/server/domain/dedup src/server/auth/signIn.ts src/server/domain/contactLoad
pnpm exec markdownlint-cli2 --fix specs/072-merge-relinking/*.md && pnpm lint:md
```

The suites that carry this feature:

| Suite | Proves |
|---|---|
| `dedup.contactReferences.test.ts` | FR-002a — every FK into `contacts` is classified; a new one fails the build |
| `dedup.mergeRelink.test.ts` | FR-001/FR-003 — each `move` reference moves; each `leave` reference does not |
| `dedup.heldMerge.test.ts` | FR-006/FR-007/FR-012 — both `role_conflict` triggers, the corrected sign-in hold, auto-close |
| `auth.protection.test.ts` | FR-013 — both sign-in routes refuse a retired contact |
| `contactLoad.performers.test.ts` | FR-014 — a retired contact is neither offered nor allowed to make a name ambiguous |
| `dedup.repairStranded.test.ts` | FR-015 — chain resolution, collision tolerance, idempotence |

## Manual verification

### 1. The historical repair (FR-015, SC-001 to SC-003)

Before migrating, record the damage; after, confirm it is gone.

```sql
-- SC-001: live records pointing at a contact that was merged away. Expect 9 before, 0 after.
SELECT 'performers' AS t, count(*) FROM performers x JOIN contacts c ON c.id=x.contact_id
  WHERE c.merged_into_id IS NOT NULL
UNION ALL SELECT 'attendance', count(*) FROM attendance x JOIN contacts c ON c.id=x.contact_id
  WHERE c.merged_into_id IS NOT NULL
UNION ALL SELECT 'membership_members', count(*) FROM membership_members x JOIN contacts c ON c.id=x.contact_id
  WHERE c.merged_into_id IS NOT NULL;
```

Confirm the chain was followed rather than one hop — no repaired record may point at a contact that is
itself merged:

```sql
SELECT count(*) AS still_pointing_at_a_retired_contact
  FROM performers p JOIN contacts c ON c.id = p.contact_id
 WHERE c.merged_into_id IS NOT NULL OR c.archived_at IS NOT NULL;
```

Expect **1** — the performer on an *archived* contact, deliberately excluded (there is no survivor).

### 2. The Booker can reach the repaired performers (SC-002)

Sign in as a Booker, open a booking for **Zak Spath** or **Rich Dempsey**, and confirm the *Email
performer* link is present. It is absent today because the merge left the performer on a shell whose
addresses moved to the survivor.

### 3. The performer mailing list is complete (SC-003)

Export the performer list and confirm the repaired performers appear. They are silently missing today,
because the export resolves through a recipient view that correctly excludes retired contacts.

### 4. A role conflict is held, and recoverable without a resolution screen

This is the loop clarification Q1 accepted, so walk it end to end:

1. As Mel (`mailing_list_manager`, holds `dedup.write` but **not** `role.assign`), merge a contact that
   holds Vice-President into one that does not.
2. Confirm the merge does **not** complete, nothing has changed, and a held item appears in the
   needs-review queue naming both contacts and the reason.
3. As a Vice-President or President, open the access screen and remove the Vice-President grant from the
   record being merged.
4. Re-run the merge as Mel. It now completes, and the earlier hold has closed itself (FR-010a).

Then the exclusivity trigger, which must fire from the **survivor's** side:

1. Give the survivor President and the record being merged Treasurer.
2. Attempt the merge and confirm it is held — even though the merged record carries no role-assigning
   authority.

### 5. Two-role sign-in check (FR-012, FR-012a)

With and without `role.assign`:

- Without it, confirm a `two_logins` hold cannot be resolved.
- With it, confirm resolution requires **both** the surviving identity and the surviving address, and that
  supplying the address alone is refused. This is the corrected contract: feature 069 accepted the address
  alone, which changed a label and not who could sign in.

### 6. A retired contact cannot sign in (FR-013)

- Merge a volunteer who signs in, then sign in with their Google account. Expect a refusal **at sign-in**,
  not a successful sign-in followed by every page failing.
- Archive a volunteer who has never signed in, then attempt a first sign-in. Expect the same refusal.

## What this feature does not do

The screen on which a hold is **resolved** is not built — for any of the three reasons. Section 4 above is
the supported route, and the feature is complete without it. Undo remains impossible; that is feature 073.
