# Research: Client 401 → sign-in redirect (B41)

Decisions resolving the plan's technical unknowns. No open `NEEDS CLARIFICATION`.

## R1 — A shared `apiFetch` wrapper, migrate call sites (not a global patch)

**Decision**: Add one client helper `apiFetch(input, init?): Promise<Response>` with the same signature as
`fetch`, and migrate every staff client `fetch(/api…)` call site to it.

**Rationale**: Explicit, typed, and testable — a drop-in signature means call sites change by name only. It
also scopes the behavior to exactly the staff surfaces we choose (excluding the public `join` page), which a
global `fetch` monkey-patch could not do cleanly. Aligns with YAGNI (a thin function) and Type Safety.

**Alternatives considered**: (a) Monkey-patch `window.fetch` — rejected: fragile, global, can't exclude public
pages, hard to test in isolation. (b) A `useApi()` hook/context — rejected: same migration surface plus React
plumbing, for no gain over a plain function.

## R2 — 401 only; reuse the existing `/login?next` return-path

**Decision**: On `res.status === 401`, `apiFetch` sets `window.location.href` to
`/login?next=<encodeURIComponent(window.location.pathname + window.location.search)>`. For any other status
(including **403**), it returns the `Response` unchanged for the caller to handle.

**Rationale**: `errors.unauthenticated()` is the uniform **401 `UNAUTHENTICATED`**; `403` forbidden is a
distinct, capability-naming response the caller already handles inline (e.g. the gate page's 403 message).
Keying only on 401 is exactly the spec's distinction (FR-001/FR-003). The current path is same-origin by
construction, and **`/login` already re-validates `next` with `safeNextPath`** (feature 015), so no
client-side path validation is needed — FR-007 is satisfied by the existing server-side guard. This is the
whole reason the feature is small.

**Alternatives considered**: Redirect on 401 **and** 403 — rejected: traps a signed-in user in a pointless
re-auth that can never grant a permission, and hides the real reason (FR-003).

## R3 — Navigate + never-resolve on 401 (no stale/empty render, no unhandled rejection)

**Decision**: On a 401, `apiFetch` initiates the navigation and returns a **promise that never settles**
(`return new Promise<Response>(() => {})`) — it does **not** throw and does **not** hand back the 401
`Response`.

**Rationale**: The silent-failure bug is callers doing `const data = await res.json(); setX(data.items ?? [])`
on a 401 body → an empty render. A pending-forever promise guarantees no caller ever reads the body, in
**both** call shapes the codebase uses: `await apiFetch(...)` simply suspends (the page is unloading), and the
dominant fire-and-forget `useEffect(() => { void apiFetch(...).then(setX) }, [])` never runs its `.then` — with
**no unhandled promise rejection**, which a `throw` would produce at every one of those page-load call sites
(analyze finding M1). The navigation is triggered synchronously before the pending promise is returned, so a
test asserts the `window.location` change **without awaiting** the `apiFetch` promise (which never settles).

## R4 — Loop and concurrency guards

**Decision**: A module-level `redirecting` flag: the first 401 sets it and navigates; subsequent 401s
(concurrent failing calls) see it set and **skip** navigating (and likewise return the never-settling
promise). `apiFetch` also **does not navigate when already on `/login`** (still returns the never-settling
promise, so no caller renders an empty result there either).

**Rationale**: FR-006 (concurrent 401s → one navigation) and FR-008 (no loop on the sign-in page). Simple
state, no timers.

## R5 — Public pages excluded

**Decision**: The public `join` page (and any public/unauthenticated surface) keeps raw `fetch`; it is **not**
migrated to `apiFetch`.

**Rationale**: A public visitor has no staff session to expire; redirecting them to staff sign-in would be
wrong (spec scope / Assumptions). The migration is limited to the staff `(admin)` and `(door)` client
surfaces plus shared staff client components (`ContactPicker`, the `_modals`).

## R6 — Migration mechanics + a guard against a missed site

**Decision**: Mechanically replace `fetch(` → `apiFetch(` for `/api` calls and add the import in each staff
client file. Add a **gate check** (grep) that no staff client file (excluding `join`) still calls raw
`fetch("/api`/`` fetch(`/api ``); if the project later wants it enforced, a lint rule is a follow-up (YAGNI now).

**Rationale**: ~96 call sites across ~24 files — the risk is *missing* one, which would silently reintroduce
the swallow. A grep in the final gate makes completeness verifiable (SC-001, FR-005) without hand-auditing.
Non-`/api` fetches (e.g. to Google) are left alone.
