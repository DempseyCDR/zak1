# Quickstart: Contact Archive & Delete

Validate end-to-end. See [contracts/archive-delete.md](./contracts/archive-delete.md) for checks
(C1–C14) and [data-model.md](./data-model.md) for the archived marker + delete guard.

## Prerequisites

- Node 24 + pnpm; local Postgres. **Run the new migration** (0041) before the integration tests:
  `pnpm db:migrate` (or the project's migrate step).
- Feature branch `065-contacts-delete-archive`.

## Automated checks

Test-first — fail before implementation, pass after:

```bash
pnpm vitest run tests/integration/contacts.archive.test.ts tests/integration/contacts.delete.test.ts \
  tests/component/contacts.page.test.tsx
pnpm tsc --noEmit
```

Regression (search, dedup, exports, launcher counts, 063/064 unchanged):

```bash
pnpm vitest run tests/component tests/integration/contacts.search.test.ts \
  tests/integration/contacts.needsReview.test.ts tests/integration/contacts.launcherCounts.test.ts \
  tests/integration/dedup.suggestions.test.ts tests/integration/exports.contactTracing.test.ts \
  tests/integration/authz.pii.test.ts
```

Expected:

- **C1–C3**: archiving hides a contact from search/counts/dedup/exports; restore brings it back; the
  `+ archived` search includes it, marked.
- **C4–C8**: a bare contact deletes; a referenced contact refuses (per category) and stays; `?force=1`
  (super-user) deletes it; missing capability refuses; a delete writes an audit event.
- **C9–C14**: capabilities flags drive the buttons; the editor shows Archive/Restore and a gated,
  confirmed Delete that surfaces a refusal reason; counts refresh after each action.

## Manual (auth-gated) walkthrough

`/contacts` is `requireStaff`-gated (no dev bypass), so the live pass runs signed in:

1. Open a contact → **Archive** → it disappears from search and the counts; turn on **"+ archived"** and
   search → it appears marked archived → open it → **Restore** → it's back.
2. Open a bare test contact → **Delete** → confirm → it's gone.
3. Open a contact with membership/attendance → **Delete** → refused with the reason (merge or archive
   instead). As the super-user, the unrestricted delete removes it.
