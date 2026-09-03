# Quickstart: Validating Shared / Family Emails

How to prove this feature works end to end. Details of shapes and rules live in
[data-model.md](./data-model.md) and [contracts/shared-emails.md](./contracts/shared-emails.md); this file
is the run guide.

## Prerequisites

- Local Postgres running, with `zak1_dev` and `zak1_test` present (`.env` supplies `DATABASE_URL` and
  `TEST_DATABASE_URL`).
- Node 24 + pnpm, dependencies installed.

This feature adds **migration 0042**. The integration suite migrates `zak1_test` automatically via
`ensureSchema`, but the dev database does not migrate itself:

```bash
pnpm db:migrate
```

If a contacts screen starts 500-ing with `column contacts.message_recipient_email_id does not exist`, that
migration has not been applied to the dev database — this is the same trap feature 065 hit with
`archived_at`.

## Automated validation

Run the feature's own suites first:

```bash
pnpm vitest run tests/integration/contacts.sharedEmail.test.ts tests/integration/contacts.sharedLifecycle.test.ts tests/integration/exports.sharedRecipients.test.ts tests/component/contacts.messageRecipient.test.tsx
```

Then the full regression — the point of this feature is that a lot of existing behavior must **not** move
(sign-in, uniqueness, existing export output):

```bash
pnpm vitest run
```

Pay particular attention to the pre-existing `auth`/sign-in and export suites: FR-006–FR-008 are guarantees
that those keep passing unchanged.

Gates before commit:

```bash
pnpm tsc --noEmit && pnpm exec eslint src tests && pnpm exec prettier --check $(git diff --name-only --diff-filter=ACM | grep -E '\.(ts|tsx|css|md)$' | tr '\n' ' ')
```

## What the automated suites must demonstrate

| Scenario | Expected outcome | Requirement |
|---|---|---|
| Link Bridget to David's active address | Both contacts persist; David keeps the owned row; Bridget has the pointer and no email row; **no uniqueness error** | FR-001–FR-003, SC-001 |
| Link to an address Bridget herself owns | Refused `REFERENCE_SELF` | FR-003 |
| Link to an inactive address | Refused `REFERENCE_TARGET_NOT_ACTIVE` | FR-014 |
| Sign in with the shared address | Resolves to **David** only; Bridget is never a match; no `ambiguous_match` | FR-007, FR-008 |
| Member export, Bridget a member and David not | `shared@jones.com` appears **once**, under **David's** name, using the existing columns | FR-010, FR-010a |
| Both David and Bridget qualify | Address still appears exactly **once** | FR-010, SC-002 |
| Owner's email carries `do_not_contact` | Address appears on **no** list, whatever Bridget qualifies for | FR-010b |
| Topic list (e.g. contra) | Output unchanged — a referrer holds no consent topics and cannot pull an address in | FR-010a |
| Contact-tracing export for an event Bridget attended | Household reached once, under David's name, subject to David's `contact_tracing` consent | FR-010 |
| Bridget gains her own address | Her pointer is cleared automatically | FR-011 |
| David's shared email deactivated, then hard-deleted | Bridget's pointer cleared **and** `needs_review = true` in both cases | FR-012 |
| David merged into a survivor | Bridget's reference still resolves; she is not orphaned | FR-013 |

## Manual pass (auth-gated, so not automatable end to end)

1. `pnpm dev`, sign in as a user holding `contact.mailing.write` (e.g. the mailing-list manager or a
   super-user).
2. Open **Contacts**, find a contact that owns an email, and note the address.
3. Open a second contact with no email. Confirm the record shows no shared-address block yet.
4. Edit the second contact's email to the **first contact's address**. The feature-066 collision block
   appears — confirm it now offers **three** choices: keep this, keep the other, and *different people —
   link as shared*.
5. Choose **link as shared**. Confirm the record now shows, read-only, "reached via *&lt;owner&gt;*" naming
   the owner, with no editable email row and no consent controls (FR-009).
6. Open the **owner's** record. Confirm it lists the referring contact under its address (FR-010c) — this
   is now the only place the household roster is visible, since the export file does not carry it.
7. Download the **member** export while only the referring contact is a member. Confirm the address appears
   once, under the owner's name, and that the column headers are identical to before this feature.
8. Deactivate the owner's email. Confirm the referring contact loses the shared address and is flagged for
   review.

## Rollback note

The feature is one additive nullable column. Reverting the code leaves `message_recipient_email_id`
populated but unread; no existing query joins it, so an un-deployed rollback is safe without a down
migration.
