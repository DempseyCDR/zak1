# Quickstart: Contacts Page Launcher (M-R4 alteration)

Validate end-to-end. See [contracts/launcher.md](./contracts/launcher.md) for checks (C1–C15) and
[data-model.md](./data-model.md) for the needs-review lifecycle.

## Prerequisites

- Node 24 + pnpm; local Postgres for integration tests.
- Feature branch `064-contacts-launcher`.

## Automated checks

Test-first — these should fail before implementation, pass after:

```bash
pnpm vitest run tests/integration/contacts.needsReview.test.ts \
  tests/integration/contacts.launcherCounts.test.ts tests/component/contacts.page.test.tsx
pnpm tsc --noEmit
```

Regression (search, dedup, merge, PII, 063 editor unchanged):

```bash
pnpm vitest run tests/component tests/integration/contacts.search.test.ts \
  tests/integration/dedup.suggestions.test.ts tests/integration/dedup.merge.test.ts \
  tests/integration/contacts.volunteer.test.ts tests/integration/authz.pii.test.ts
```

Expected:

- **C1–C4**: `?needsReview=1` lists only flagged contacts; `launcher-counts` returns correct
  `{ needsReview, duplicates }`.
- **C5–C7**: saving a flagged contact with a phone/email now present clears the flag; without it, stays
  flagged; `POST …/reviewed` clears it regardless.
- **C8–C15**: the page loads as a bare launcher (no lists, counts on buttons); task buttons open their
  views; typing shows results + query-scoped pairs; Add contact is a modal; counts refresh after
  create/merge/mark-reviewed.

## Manual (auth-gated) walkthrough

`/contacts` is `requireStaff`-gated (no dev bypass), so the live pass runs signed in:

1. Open `/contacts` → only header, search box, and the three task buttons with counts; no lists.
2. Tap **Review queue (n)** → the needs-review contacts; open one, add a phone, Save → it leaves the
   queue and the count drops.
3. Open another needs-review contact with no data to add → **Mark reviewed** → it leaves the queue.
4. Tap **Review duplicates (n)** → global pairs; merge one → it leaves the list and the count drops.
5. Type a name → single results appear with any query-scoped "≈" pair alongside; tap to open; clear the
   box → back to the bare launcher.
6. Tap **Add contact** → create form in a modal; submit → modal closes, launcher returns, new contact
   findable; Cancel/Escape → no create.
