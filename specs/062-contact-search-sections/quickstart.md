# Quickstart / Validation: Contact Search — Two Sections + Focus (062)

Proves M-R3 + M-R4: the query filter on the dedup engine, the two-section contacts surface, and
focus-to-search.

## Prerequisites

- Test DB reachable; schema current. A staff session for the manual UI pass (`(admin)` is `requireStaff`).

## Automated (source of truth)

Duplicates engine query filter (real Postgres):

```bash
pnpm vitest run tests/integration/dedup.suggestions.test.ts
```

Expected (per `contracts/search-sections.md`):

- **C1** with `q`, only pairs where a member matches `q` are returned.
- **C2** with empty `q`, the global set is returned.
- **C3** a duplicate hidden by a display-name override is still paired (detected on the structured key).

Contacts surface (jsdom component) + typecheck:

```bash
pnpm vitest run tests/component/contacts.page.test.tsx && pnpm tsc --noEmit
```

- **C5** both sections render (single contacts + potential duplicates).
- **C7** no-duplicate query → the duplicates section is absent / empty.
- **C9** the search field is auto-focused on mount.
- **C6** selecting a pair issues `POST /api/dedup/merge` (mocked) with the chosen `{ canonicalId, mergedId }`.

Then the full component + integration guard:

```bash
pnpm vitest run tests/component && pnpm vitest run tests/integration/authz.pii.test.ts
```

## Browser (manual, auth-gated)

Signed in at `/contacts`: type a name → single matches in one section, likely-duplicate pairs in another;
selecting a pair opens the merge; clearing the box shows the global dedup queue; the field is focused on
load. `/contacts` is `requireStaff`-gated (no dev bypass) → manual pass with a session.

## Success = spec Success Criteria

- SC-001 ↔ C5 · SC-002 ↔ C6 · SC-003 ↔ C3 · SC-004 ↔ C9 · SC-005 ↔ C7.
