---
description: "Task list for feature 022 — client 401 → /login redirect (B41)"
---

# Tasks: Client 401 → sign-in redirect (B41)

**Input**: Design documents from `specs/022-client-401-login-redirect/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/
**Tests**: INCLUDED — the constitution (v1.3.0, Principle I) mandates test-first.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1 / US2 / US3 (from spec.md)
- Exact file paths included.

## Notes

Ships as one atomic commit (solo-maintainer mode). No server/DB change — client behavior only. The
`/login?next` return-path and `safeNextPath` validation (feature 015) are reused unchanged.

---

## Phase 1: Setup

- [ ] T001 No new infra — jsdom component-test harness (feature 020) and the `/login?next` + `safeNextPath` flow (feature 015) already exist. Confirm `tests/setup.dom.ts` is in place before writing component tests.

---

## Phase 2: Foundational (blocking prerequisite for all stories)

- [ ] T002 Create the client wrapper skeleton `src/app/apiFetch.ts`: export `async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>` (mirrors `fetch`, skeleton body `return fetch(input, init)`), plus a module-level `let redirecting = false` guard. `"use client"`-safe (uses `window`).

**Checkpoint**: the shared wrapper exists; stories build its behavior test-first.

---

## Phase 3: User Story 1 — Expired session → sign in → returned (P1)

**Goal**: A 401 navigates the user to `/login?next=<current path>` and never lets the caller render the 401 body.

**Independent Test**: A stubbed 401 makes `apiFetch` set `window.location` to `/login?next=<encoded path>` and return a never-settling promise (asserted without awaiting it); concurrent 401s → one navigation; a 401 while on `/login` → no navigation.

- [ ] T003 [US1] Write `tests/component/apiFetch.test.tsx` (jsdom): stub `fetch` → **401**; call `apiFetch("/api/x")` **without awaiting it** and assert `window.location` becomes `/login?next=<encodeURIComponent(location.pathname+location.search)>` and the returned promise **never settles** (e.g. it loses a race against a short timeout); assert two concurrent 401s produce a **single** location assignment; assert a 401 with `location.pathname === "/login"` does **not** navigate; assert **no unhandled promise rejection** is emitted.
- [ ] T004 [US1] Implement the 401 branch in `src/app/apiFetch.ts`: on `res.status === 401`, if `!redirecting` and `window.location.pathname !== "/login"`, set `redirecting = true` and `window.location.href = ` + `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`; then `return new Promise<Response>(() => {})` (a promise that never settles). When already redirecting or on `/login`, return the same never-settling promise **without** navigating again — never throw, never hand back the 401 response.

**Checkpoint**: T003 green — the redirect + return-path + guards work.

---

## Phase 4: User Story 2 — A permission denial stays inline (P1)

**Goal**: A 403 (and any non-401) is passed back unchanged — no navigation — so the caller shows its inline message.

**Independent Test**: A stubbed 403 returns the `Response` with no navigation; a 2xx passes through.

- [ ] T005 [US2] Extend `tests/component/apiFetch.test.tsx`: stub `fetch` → **403** and assert `apiFetch` **returns** the response unchanged with **no** `window.location` change; stub → **200** and assert pass-through.
- [ ] T006 [US2] Confirm `src/app/apiFetch.ts` returns the response unchanged (promise resolves normally) for every non-401 status (403/2xx) — no navigation, no never-settle; caller handles inline (as the gate page's existing 403 branch does).

**Checkpoint**: 403/2xx pass-through proven; signed-in-but-denied users are not bounced to sign-in.

---

## Phase 5: User Story 3 — Uniform across staff surfaces, no silent failures (P2)

**Goal**: Every staff client `/api` call routes through `apiFetch`; the public `join` page is excluded.

**Independent Test**: The door check-in search with a stubbed 401 redirects to `/login?next=/checkin` and renders no "No match"; a coverage grep finds no raw staff `/api` fetch.

- [ ] T007 [US3] Write `tests/component/checkin.authRedirect.test.tsx` (jsdom): render the check-in search, stub the search `fetch` → **401**, type a query; assert `window.location` becomes `/login?next=/checkin` and **no** "No match"/empty candidate list is rendered (the reproduced defect, SC-004).
- [ ] T008 [P] [US3] Migrate the door surfaces to `apiFetch` (import from `@/app/apiFetch`): `src/app/(door)/checkin/page.tsx`, `src/app/(door)/gate/page.tsx` — replace each `fetch(/api…)` with `apiFetch(...)`.
- [ ] T009 [P] [US3] Migrate the `(admin)` staff pages' `fetch(/api…)` → `apiFetch`: `bookings-report`, `bookings`, `events`, `venues`, `venue-rents`, `performers`, `bands`, `contacts`, `dedup`, `access`, `exports`, `organizer/[seriesKey]`, `payments`, `treasurer/[eventId]`, `qbo-mapping`, `rate-parameters`, `expense-parameters`, `door-parameters` (all under `src/app/(admin)/`).
- [ ] T010 [P] [US3] Migrate shared staff client components: `src/app/(admin)/_modals/BookingModal.tsx`, `src/app/(admin)/_modals/EventModal.tsx`, `src/app/ContactPicker.tsx`.
- [ ] T011 [US3] Leave the **public** page `src/app/(public)/join/page.tsx` on raw `fetch` — do **not** migrate (out of scope; no staff session to expire).

**Checkpoint**: all staff surfaces redirect on 401; the public page untouched.

---

## Phase 6: Polish & Cross-Cutting

- [ ] T012 Coverage guard (research R6): run `grep -rnE 'fetch\(\s*[\`"]/api|fetch\(\s*\`\$\{' src/app` and confirm no **staff** client file still calls raw `/api` fetch (only the excluded `join` page may). Fix any missed site.
- [ ] T013 Full gate (solo-maintainer mode): `pnpm exec tsc --noEmit`; `pnpm exec eslint <changed files>`; `pnpm exec prettier --check <changed files>`; `pnpm test` (both new component tests present, suite green); `pnpm build`.
- [ ] T014 [P] Update `zak1_Phase4_Requirements_v1.md` §7 to mark **B41 (#2) SHIPPED as 022**, and the door-attendant notes' B41 item (#8) as shipped.

---

## Dependencies & execution order

- **T001–T002** (setup + wrapper skeleton) → everything.
- **US1 (T003 → T004)** and **US2 (T005 → T006)** build the wrapper's behavior test-first; both operate on `src/app/apiFetch.ts` so they are **sequential** with each other (same file), US1 before US2.
- **US3 migration (T008/T009/T010)** depends on the wrapper being behavior-complete (after US1+US2); the three migration tasks are **[P]** (disjoint files).
- **T007** (surface test) is written before/red and passes once **T008** migrates check-in.
- **T011** (exclude `join`) is a no-op verification, any time.
- **Polish (T012–T014)** last.

### Parallelizable

- Migration: **T008, T009, T010** [P] (disjoint file sets).
- **T014** [P] (docs).

## Implementation strategy

Ship as **one atomic commit** once T013 is green. Build order: wrapper skeleton → 401 behavior (US1) → 403
pass-through (US2) → migrate all staff call sites (US3) → coverage guard + gate. The wrapper is tiny; the
breadth is the mechanical migration. MVP is the whole feature (US3's uniformity is required for the guarantee
to hold — a single un-migrated surface reintroduces the silent-swallow).

## Summary

- **Total tasks**: 14 (Setup 1 · Foundational 1 · US1 2 · US2 2 · US3 5 · Polish 3)
- **Test tasks**: T003, T005, T007
- **Parallel opportunities**: T008/T009/T010; T014
- **MVP scope**: the whole feature (atomic; uniformity is a correctness property, not an increment).
