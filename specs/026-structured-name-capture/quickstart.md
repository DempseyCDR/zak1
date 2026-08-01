# Quickstart: Structured name capture when creating a performer

Validation scenarios per user story. Integration tests run against **real Postgres** (node env); component
tests use the jsdom harness (feature 020). **No migration** to run.

## Prerequisites

- `pnpm run db:migrate` already current (this feature adds **no** migration).
- Run a file with `pnpm exec vitest run tests/<path>`; the whole suite with `pnpm test`.

## US1 — Add a performer with a proper first/last name

**Integration** (`tests/integration/performer.nameCapture.test.ts`):

1. `createPerformer` with `{ firstName: "Chuck", lastName: "Abell" }` → the created contact has
   `first_name = "Chuck"`, `last_name = "Abell"`, `display_name = "Chuck Abell"`; the performer's
   `display_name = "Chuck Abell"`.
2. **Mononym**: `{ firstName: "Fiddlehead" }` (no last) → contact `first_name = "Fiddlehead"`,
   `last_name = null`, sensible `display_name`; creation not blocked.
3. **Display override**: `{ firstName: "Charles", lastName: "Abell", displayNameOverride: "Chuck Abell" }` →
   `display_name = "Chuck Abell"` **and** the dedup key derives from "Charles Abell" (override does not mask a
   duplicate).
4. **Validation**: neither `contactId` nor `firstName` → rejected.

## US2 — Consistent capture across create surfaces + the link path

**Integration** (same file): `createPerformer` with `{ contactId }` for an existing contact → **no** new
contact is created and the performer's `display_name` equals that contact's `display_name`.

**Component** (jsdom):

- `tests/component/performersPage.nameCapture.test.tsx` — the performers-page create form shows first / last /
  display fields and POSTs `{ firstName, lastName, … }` (no single `displayName`).
- `tests/component/bookingModal.addPerformer.test.tsx` (extend the 020 modal test) — the add-performer
  "create brand-new" step captures first/last and POSTs structured input; the **link existing contact** action
  POSTs just `{ contactId }`.

## Full gate (solo-maintainer mode)

`pnpm exec tsc --noEmit` · `pnpm exec eslint <changed>` · `pnpm exec prettier --check <changed>` · `pnpm test`
(the `makePerformer` factory now feeds structured names, so the whole suite exercises the corrected path) ·
`pnpm build` — all green before the single atomic commit.
