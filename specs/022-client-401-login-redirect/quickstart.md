# Quickstart / Validation: Client 401 → sign-in redirect (B41)

Prerequisites: Node 24 via nvm; run from repo root. This feature has **no DB change** — validation is
component tests (jsdom) plus a manual browser check.

```bash
pnpm exec vitest run tests/component/apiFetch.test.tsx tests/component/checkin.authRedirect.test.tsx
pnpm exec tsc --noEmit
pnpm test        # full suite stays green
```

## Story validation

### US1 — expired session → sign in → returned (P1)
- Component (`apiFetch.test.tsx`): stub `fetch` → 401; call `apiFetch("/api/x")` (do **not** await it); assert
  `window.location` becomes `/login?next=<encoded current path>` and the returned promise never settles.
- Manual: sign in, open a staff page, invalidate the session (delete the session cookie / revoke), take an
  action → land on `/login`; sign in → return to the same page.

### US2 — a 403 stays inline (P1)
- Component: stub `fetch` → 403; assert `apiFetch` **returns** the response (no navigation) and the caller's
  inline message path runs. (Mirrors the gate page's existing 403 handling.)

### US3 — uniform, no silent failures (P2)
- Component (`checkin.authRedirect.test.tsx`): render the door check-in search, stub the search fetch → 401,
  type a query; assert the page **redirects** (location → `/login?next=/checkin`) and does **not** render a
  "No match" / empty list.
- Coverage guard (research R6): `grep -rnE 'fetch\(\s*[\`"]/api' src/app` returns **no** staff client file
  (only the excluded public `join` page, if any) — every staff `/api` call goes through `apiFetch`.

### Edge cases
- Concurrent 401s → assert a single `window.location` assignment (the `redirecting` guard).
- Already on `/login` with a 401 → assert **no** navigation.

## Full gate (solo-maintainer mode)

```bash
pnpm exec tsc --noEmit
pnpm exec eslint <changed files>
pnpm exec prettier --check <changed files>
pnpm test
pnpm build
```

Expected: all green; the two new component tests added; no raw staff `/api` fetch remains (R6 guard). See
[contracts/apifetch-behavior.md](contracts/apifetch-behavior.md) for the wrapper's behavior contract.
