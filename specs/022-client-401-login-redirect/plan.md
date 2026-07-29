# Implementation Plan: Client 401 → sign-in redirect (B41)

**Branch**: `022-client-401-login-redirect` (solo-maintainer mode, constitution v1.3.0 — one atomic commit to
`main`) | **Date**: 2026-07-28 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/022-client-401-login-redirect/spec.md`

## Summary

Route every **staff** client `/api/*` call through one shared wrapper (`apiFetch`) that, on a **401
`UNAUTHENTICATED`** response, navigates to `/login?next=<current in-app path>` — turning a silently-swallowed
expired session into a visible sign-in + return. A **403** (forbidden, authenticated-but-not-permitted) is
**not** redirected — the wrapper passes it back so the caller shows its inline message, exactly as today. The
load-bearing reuse: the safe return-path already exists (feature 015 — `/login` reads `?next` and validates it
with `safeNextPath`), so the client only supplies the current path and validation stays server-side (FR-007).
The bulk of the work is a **mechanical migration** of ~96 `fetch(/api…)` call sites across ~24 staff client
files to `apiFetch`; the **public** `join` page is excluded (out of scope). No server change, no data change.

## Technical Context

**Language/Version**: TypeScript 5.7 (strictest) · Node 24 · pnpm

**Primary Dependencies**: Next.js 16.2.10 (App Router, client components) · React 19.2. **No new runtime
dependency.**

**Storage**: **None** — no schema, migration, or persisted data. Purely a client-behavior change.

**Testing**: Component/unit tests on the **020 jsdom harness** (RTL + stubbed `fetch`). `apiFetch` gets a
focused test (401 → `window.location` becomes `/login?next=…`; 403/200 → passed through, no navigation;
concurrent 401s → one navigation; already on `/login` → no navigation). One representative surface (door
check-in search) gets a component test proving a stubbed 401 **redirects** rather than rendering "no match".
No integration/DB test — the server is untouched.

**Target Platform**: Web, staff admin + door client surfaces.

**Project Type**: Next.js App Router monolith; client components under `src/app/`.

**Performance Goals**: N/A — one branch in a fetch wrapper; negligible.

**Constraints**: **Public pages excluded** (the `join` page keeps raw `fetch`). **Server-side authorization
unchanged** — this only changes how the client reacts. **No redirect loops** (concurrent 401s, or a 401 while
on `/login`). The return-path must stay same-site (validated on `/login`).

**Scale/Scope**: ~24 staff client files; ~96 `fetch(/api…)` call sites migrated to `apiFetch`; 1 new small
client helper; ~2 test files.

## Constitution Check

*GATE: Must pass before Phase 0. Re-check after Phase 1.* Constitution v1.3.0 (principles I–IV).

| Principle | Verdict |
|---|---|
| **I. Test-First** | **PASS** — `apiFetch`'s behavior (401 → navigate to `/login?next`; 403/2xx pass-through; single redirect under concurrency; no loop on `/login`) is specified as tests first on the jsdom harness, plus a representative-surface test that a stubbed 401 redirects instead of showing empty results (the reproduced defect, SC-004). |
| **II. YAGNI** | **PASS** — one wrapper with the fetch signature; reuses the existing `/login?next` + `safeNextPath` flow (no new auth, no new return-path validation). The migration is mechanical, not a new abstraction. No global fetch monkey-patch. |
| **III. Type Safety** | **PASS** — `apiFetch(input, init?): Promise<Response>` mirrors `fetch`, so call sites are drop-in and stay typed; no `any`. |
| **IV. Observability** | **PASS** — no server mutation, no new audit surface. The client behavior is user-visible (a navigation), not silent. |

**Development Workflow**: solo-maintainer mode — one atomic commit to `main`, full local gate suite as the
reviewer. Complies.

### Post-Design Re-Check

Re-evaluated after Phase 1: **still PASS.** No new dependency, no server/data change, no new abstraction beyond
the single client helper. The one risk (a call site missed by the migration) is closed by a grep guard in the
gate (research R6).

## Project Structure

### Documentation (this feature)

```text
specs/022-client-401-login-redirect/
├── plan.md              # This file
├── research.md          # R1..R6 (decisions)
├── data-model.md        # (no persistent entities — behavioral feature)
├── quickstart.md        # per-story validation
├── contracts/
│   └── apifetch-behavior.md   # the client wrapper's behavior contract (no server API change)
├── checklists/requirements.md # complete (from /speckit-specify)
└── tasks.md             # /speckit-tasks (NOT created here)
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── apiFetch.ts                 NEW — the shared client wrapper (401 → /login?next; else pass-through)
│   ├── (admin)/**/page.tsx         migrate fetch(/api…) → apiFetch (all staff admin surfaces + _modals)
│   ├── (admin)/_modals/*.tsx       BookingModal, EventModal
│   ├── (door)/checkin/page.tsx     migrate; representative surface for the redirect test
│   ├── (door)/gate/page.tsx        migrate (keeps its 403 inline-message handling)
│   ├── ContactPicker.tsx           migrate
│   └── (public)/join/page.tsx      EXCLUDED — public page, keeps raw fetch (out of scope)
└── tests/
    ├── component/apiFetch.test.tsx        NEW — wrapper behavior (401/403/2xx, concurrency, loop guard)
    └── component/checkin.authRedirect.test.tsx  NEW — a stubbed 401 on search redirects, not "no match"
```

**Structure Decision**: No structural change — the established App Router monolith. One new client util
(`src/app/apiFetch.ts`), a mechanical call-site migration across the staff client surfaces, and two component
tests on the existing jsdom harness. The `/login?next` return-path and its `safeNextPath` validation
(`src/server/auth/redirect.ts`, feature 015) are reused unchanged.

## Complexity Tracking

> No entries. No constitution deviation, no new pattern. The one "new" thing is a thin fetch wrapper built to a
> concrete need; breadth (many call sites) is mechanical, not complex.
