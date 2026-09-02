# Quickstart: Contact Record Editor — Scalar Fields

Validate the feature end-to-end. See [contracts/record-editor.md](./contracts/record-editor.md) for the
contract checks (C1–C11) and [data-model.md](./data-model.md) for field rules.

## Prerequisites

- Node 24 + pnpm; local Postgres for integration tests (`tests/integration/helpers/db.ts`).
- Feature branch `063-contact-record-editor`.

## Automated checks

Run the targeted suites (test-first: they should fail before implementation, pass after):

```bash
pnpm vitest run tests/integration/contacts.volunteer.test.ts tests/component/contacts.page.test.tsx
pnpm tsc --noEmit
```

Regression (endpoint + PII gating unchanged):

```bash
pnpm vitest run tests/integration/contacts.volunteer.test.ts tests/integration/authz.pii.test.ts \
  tests/integration/contactNames.test.ts tests/integration/contact.phoneNormalize.test.ts tests/component
```

Expected:

- **C1**: a `mailing_list_manager` (no `role.assign`) PATCHing `{ lastName, isVolunteer: true }` on a
  non-volunteer → 200; last name saved; `is_volunteer` still false.
- **C2**: a `role.assign` actor who also holds `contact.write` (VP-also-MLM) changing `isVolunteer` at
  the endpoint → persists.
- **C4–C18**: the record opens as a **modal dialog** over the lists (Escape / Cancel / Save close it,
  focus moves in on open); pre-filled; every field shows a **visible label**; the **phone reads
  `585-555-1234`** (formatted); Save issues one PATCH; Automatic/Custom transitions behave;
  `is_volunteer` shows read-only (no toggle) and is never sent on Save; the context block shows standing
  and never `source`; Cancel discards.

## Manual (auth-gated) walkthrough

`/contacts` is `requireStaff`-gated (no dev bypass), so the live pass runs signed in:

1. Search a contact and open it → a **modal** opens over the lists with the edit form pre-filled and
   focus in the first field; Escape or Cancel closes it and returns focus to search.
2. Correct the last name and phone → **Save** → the row reflects the change and the contact is still
   found by its new name.
3. **Set custom name**, pin "DJ", Save; edit the first name → the pinned name does not move. **Reset to
   automatic** (or clear + Save) → the name resumes "first last".
4. Confirm `is_volunteer` shows read-only in the standing block for every viewer (no control); volunteer
   designate/clear is done on the access screen, not here.
5. Confirm membership status / needs-review / volunteer-approval show read-only, and `source` is absent.
