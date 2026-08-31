# Quickstart / Validation: Mailing-List Manager Authority (059)

Proves M-R1 + M-R2: a `mailing_list_manager` can maintain contact records and mailing permissions
club-wide, and still cannot cross the governance boundary.

## Prerequisites

- Local dev DB reachable (`DATABASE_URL`), schema current (`pnpm db:migrate` if needed).
- The change applied to `src/server/auth/capabilities.ts` (see [plan.md](./plan.md)).

## Automated validation (primary)

Run the authorization suites — these are the source of truth (Test-First):

```bash
pnpm vitest run tests/unit/authz.can.test.ts tests/integration/authz.boundaries.test.ts tests/integration/authz.scope.test.ts
```

Expected: the new/extended assertions pass —

- **C1**: `can(mlm, "contact.write")` is `true`, including for a series-scoped MLM grant.
- **C2**: `can(mlm, "contact.mailing.write", anyTarget)` is `true` regardless of series.
- **C3**: `can(mlm, "role.assign")`, `can(mlm, "membership.write")`, and any unlisted capability are
  `false`.
- **C4**: no other role's outcomes change; full authz suite stays green:

```bash
pnpm vitest run tests/integration/authz.*.test.ts tests/unit/authz.can.test.ts
```

## Manual smoke (optional)

Signed in as a contact whose **only** role grant is `mailing_list_manager`:

1. Create a contact (name/pronouns/phone) → **permitted** (`POST /api/contacts` → 2xx).
2. Edit an existing contact's name → **permitted** (`PATCH /api/contacts/[id]` → 2xx).
3. Edit any contact's email purposes/consent/status (a contact unrelated to any series) → **permitted**.
4. Attempt to mark a contact a volunteer / assign a role / edit membership → **refused** (403, and an
   `authz.refused` audit row is written).

## Success = spec Success Criteria

- SC-001 ↔ steps 1–2 · SC-002 ↔ step 3 · SC-003 ↔ step 4 · SC-004 ↔ the full-suite run stays green.
