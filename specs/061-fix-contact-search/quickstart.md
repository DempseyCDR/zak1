# Quickstart / Validation: Fix Contact Search (061)

Proves X-R3: predictable substring search, name ∪ dedup ∪ email matching, thin-results fuzzy fallback,
honest truncation, and no perf/permission regression.

## Prerequisites

- Test DB reachable (`TEST_DATABASE_URL`), schema current.

## Automated (source of truth)

Run the search integration suites:

```bash
pnpm vitest run tests/integration/contacts.search.test.ts tests/integration/door.checkin-search.test.ts
```

Expected (per `contracts/search-behavior.md`):

- **C1** "cat" returns "Catherine …" (fails on the old trigram matcher).
- **C2** `cath` → `cathe` → `cather` results are each a **subset** of the previous (monotonic primary).
- **C3/C4** a display-overridden contact is found by real first/last, and any contact by an email prefix.
- **C5** with sparse exact matches, a close spelling variant appears **last**.
- **C6** merged contacts never appear.
- **C7** `truncated` is `true` when more than `limit` contacts match.
- **C10** the 300ms-p95-@-1,300-contacts perf test still passes.

Then the guard + typecheck:

```bash
pnpm vitest run tests/integration/authz.pii.test.ts && pnpm tsc --noEmit
```

- Door PII gating and `recordPiiDisclosure` behavior unchanged (C9).

## Browser (truncation indicator) — auth-gated, manual

Signed in as staff, at `/checkin` and `/contacts`: a query matching more than the cap shows a
"more matches — refine" indicator (not a silently cut list). `/contacts` is `requireStaff`-gated (no dev
bypass), so this is a manual pass with a session.

## Success = spec Success Criteria

- SC-001 ↔ C1 · SC-002 ↔ C2 · SC-003 ↔ C3/C4 · SC-004 ↔ C7 + the UI indicator · SC-005 ↔ C9.
