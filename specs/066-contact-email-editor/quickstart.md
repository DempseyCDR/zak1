# Quickstart: Contact Email Editor

Validate end-to-end. See [contracts/email-editor.md](./contracts/email-editor.md) for checks (C1–C15)
and [data-model.md](./data-model.md) for the email row rules.

## Prerequisites

- Node 24 + pnpm; local Postgres for integration tests.
- Feature branch `066-contact-email-editor`. No migration (all email fields already exist).

## Automated checks

Test-first — fail before implementation, pass after:

```bash
pnpm vitest run tests/integration/contacts.emails.test.ts tests/integration/contacts.emailDelete.test.ts \
  tests/component/contacts.emailEditor.test.tsx
pnpm tsc --noEmit
```

Regression (existing email rules, dedup/merge, PII, 063/064/065 unchanged):

```bash
pnpm vitest run tests/component tests/integration/contacts.emails.test.ts \
  tests/integration/contacts.consent.test.ts tests/integration/contacts.login.test.ts \
  tests/integration/dedup.merge.test.ts tests/integration/authz.pii.test.ts
```

Expected:

- **C1–C7**: PATCH sets an address; a colliding address raises `EMAIL_ACTIVE_ELSEWHERE` naming the other
  contact (nothing changed); DNC collapses on patch; a login email is refused on a non-volunteer; a
  super-user hard-delete erases the row and audits; a non-super-user delete is refused; capabilities
  report `contactMailingWrite`.
- **C8–C15**: the editor lists emails as rows; DNC is exclusive and zero purposes/topics is prevented;
  the status toggle behaves and transition is read-only; add + soft-remove work; hard-delete shows only
  for a super-user; a collision offers "review as duplicate" that merges the pair; the login email is
  marked and its change is confirmed; telemetry is a read-only hint.

## Manual (auth-gated) walkthrough

`/contacts` is `requireStaff`-gated (no dev bypass), so the live pass runs signed in:

1. Open a contact with emails → each email is a row (address / purposes / topics / status / telemetry).
2. Select **do not contact** on a row → the other topics clear/grey; try to remove the last purpose →
   prevented.
3. Toggle an email Active↔Inactive; add a new email; confirm a transition-state email is read-only.
4. Change an address to one active on another contact → "already active on [name] — review as duplicate"
   → merge the pair.
5. On a volunteer's login email, change the address → a "staff sign-in email — proceed?" confirmation.
6. As a super-user, hard-delete an email row; as the mailing-list manager, confirm there is no
   hard-delete affordance.
