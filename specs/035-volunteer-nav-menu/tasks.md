---

description: "Task list for feature 035 — Volunteer Navigation Menu"
---

# Tasks: Volunteer Navigation Menu

**Input**: Design documents from `specs/035-volunteer-nav-menu/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/volunteer-nav.md, quickstart.md

**Tests**: INCLUDED — the constitution (I. Test-First) is non-negotiable. The completeness guard is written
first and goes RED against today's five orphans; the client presenter gets jsdom tests written first.

**Organization**: Tasks are grouped by user story (US1 P1 → US2 P2 → US3 P3) for independent implementation and
testing. Placement B (render on every page when signed in) is delivered in US2; US1 delivers the *complete* menu
on the pages the volunteer nav already renders.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1 / US2 / US3 — maps to the spec's user stories
- Every task names an exact file path

## Path Conventions

Single Next.js App Router project — `src/app/**`, `src/server/**`, `tests/**` at repo root (per plan.md).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the tooling this feature needs already exists — no install.

- [ ] T001 Confirm the two test harnesses are available: the jsdom component harness (`tests/setup.dom.ts`,
  `// @vitest-environment jsdom`, RTL) for the presenter test, and the plain **node** test env for the
  completeness walker test (see `tests/integration/auth.routeInventory.test.ts`, which reuses
  `src/server/lib/routeInventory.ts`'s `findFiles`). No dependency install required.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The nullable actor loader the root-layout nav needs (US2), also usable by US1's rendering.

**⚠️ CRITICAL**: `Nav` must not throw for anonymous visitors once it moves to the root layout — it needs a
non-throwing actor load.

- [ ] T002 Add a nullable actor loader to `src/server/auth/currentStaff.ts` — e.g.
  `export async function getActor(): Promise<Actor | null>` (returns the capability-bearing `Actor` when signed
  in, else `null`). Leave the throwing/redirecting `requireActor()` untouched for page guards.

**Checkpoint**: `getActor()` exists — rendering and completeness work can proceed.

---

## Phase 3: User Story 1 - A volunteer reaches all their working pages from a complete menu (Priority: P1) 🎯 MVP

**Goal**: The volunteer menu is **complete** — every static staff page has an entry for the volunteers whose job
it is — closing D1: the Financial Secretary/Treasurer can reach `/payments`.

**Independent Test**: Sign in as an FS/Treasurer; confirm `/payments` (and the other formerly-orphaned pages)
appear in the volunteer menu and navigate; run the completeness guard and see it green.

### Tests for User Story 1 (write FIRST — must FAIL before T004/T005)

- [ ] T003 [US1] Create the completeness guard `tests/integration/auth.navCompleteness.test.ts` (node env) that:
  (1) enumerates the **static** staff page routes via a new walker (below) and asserts each is an `NAV` href;
  (2) asserts every `NAV` href resolves to a real staff page — allowing a concrete href to satisfy a **dynamic**
  route (e.g. `/organizer/tnc` is served by `/organizer/[seriesKey]`); (3) treats dynamic `[param]` routes as a
  documented excluded set (`/organizer/[seriesKey]` → `/organizer/tnc`); and (4) keeps a documented **href
  allowlist** for `NAV` entries whose page is outside `(admin)`/`(door)` — currently `/dev/routes`
  (`src/app/dev/routes/page.tsx`) — so it is not flagged as a dead entry. Confirm it FAILS (walker missing and/or
  five orphans).

### Implementation for User Story 1

- [ ] T004 [US1] Add a staff-page-route walker to `src/server/lib/routeInventory.ts`: reuse `findFiles` over
  `src/app/(admin)` and `src/app/(door)` to list `page.tsx` files, compute each URL path (strip route-group
  `(…)` folders, keep `[param]` segments), and flag `dynamic`. Export it for the T003 test (mirrors the existing
  API walker's shape).
- [ ] T005 [US1] Add the missing entries to `NAV` in `src/server/auth/nav.ts` — `/payments`
  (`performer_payment.write`, label "Payments"), `/bookings-report`, `/door-parameters`, `/venue-rents` — with
  each gating capability **confirmed from that page's primary-purpose authz** (best estimates: `booking.write`,
  `parameter.write`, `venue.write`; read each page/its API to confirm). Keep `/organizer/tnc` as the
  representative entry for the dynamic `/organizer/[seriesKey]` route. Makes T003 green.

**Checkpoint**: The menu is complete, the guard is green, and `/payments` is reachable (D1 closed) — MVP.

---

## Phase 4: User Story 2 - The menu shows only the volunteer's pages, on every page when signed in, hidden when anonymous (Priority: P2)

**Goal**: The complete menu renders on **every** page (public + staff) as the second bar beneath the public menu
whenever a volunteer is signed in, marks the current section active, shows only the role's pages, and is absent
for anonymous visitors.

**Independent Test**: Signed out, no "Main" bar on any page; signed in, the "Main" bar appears beneath the public
bar on a public page and a staff page, marks the current page active, and shows only the role's entries.

### Tests for User Story 2 (write FIRST — must FAIL before T008/T009)

- [ ] T006 [US2] Create `tests/component/volunteerNav.test.tsx` (jsdom) for the client presenter: given `items`,
  renders one `next/link` per item in order under a `nav aria-label="Main"`; marks the item matching a mocked
  `usePathname` with `aria-current="page"` (`pathname === href || startsWith(href + "/")`); renders nothing
  meaningful for empty `items`. Confirm it FAILS.
- [ ] T007 [US2] Add a test that `Nav` renders **null** when `getActor()` returns null (anonymous) and renders
  the presenter with role-filtered items when signed in (mock `getActor`/`navItemsFor`). Confirm it FAILS.

### Implementation for User Story 2

- [ ] T008 [US2] Create `src/app/VolunteerNav.tsx` (`"use client"`): props `{ items: { href: string; label:
  string }[] }`; render `<nav aria-label="Main">` with one `next/link` per item and active-state via
  `usePathname` (rule as T006). Makes T006 pass.
- [ ] T009 [US2] Refactor `src/app/Nav.tsx` into a server loader: `const actor = await getActor()`; if `!actor`
  return `null`; else `items = navItemsFor(actor)` and render `<VolunteerNav items={items} />`. Makes T007 pass.
- [ ] T010 [US2] Render `<Nav />` in the root layout `src/app/layout.tsx` immediately after `<PublicNav />` and
  before `{children}` (the second bar; self-guards to null when anonymous). Root layout becomes async.
- [ ] T011 [US2] Remove `<Nav />` from `src/app/(admin)/layout.tsx` and `src/app/(door)/layout.tsx` (keep their
  `requireStaff()` guard) — the nav now comes from the root layout, so no double render.
- [ ] T012 [US2] Remove `{staff && <Nav />}` from `src/app/page.tsx` (superseded by the root-layout nav — retires
  the 025 home-page-nav special case) and update/retire `tests/component/home.staffNav.test.tsx` accordingly
  (its behavior is now covered by T007's Nav-null / signed-in cases).

**Checkpoint**: The complete menu renders on every page when signed in, hidden when anonymous, with active-state
and role filtering; US1 still passes.

---

## Phase 5: User Story 3 - A newly added volunteer page cannot be orphaned (Priority: P3)

**Goal**: The completeness guard (US1) prevents a future orphan — a new staff page with no `NAV` entry fails CI.

**Independent Test**: Add a bare staff page with no `NAV` entry; the guard test fails; remove it and it passes.

### Verification for User Story 3 (the guard already exists from US1)

- [ ] T013 [US3] Demonstrate the future-orphan guarantee: temporarily add a throwaway `src/app/(admin)/_probe/
  page.tsx`, run `tests/integration/auth.navCompleteness.test.ts`, confirm it **fails** naming the probe route,
  then remove the probe. (No shipped code; proves SC-003. Optionally capture the expectation as a comment in the
  test.)

**Checkpoint**: Existing orphans fixed (US1) and future ones caught (US3); all stories pass independently.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T014 [P] Update `docs/zak1_Help_Glossary.md`: note the volunteer nav now renders from the **root layout**
  on every page when signed in (second bar, `aria-label="Main"`), is a **courtesy not a control**, and is kept
  complete by the `auth.navCompleteness` guard (mirrors the `routeInventory` note). Adjust the existing nav
  mention if present.
- [ ] T015 Run the full local gate: `pnpm exec tsc --noEmit && pnpm run lint && pnpm exec vitest run` — all
  green (scope prettier/lint to changed files if run separately).
- [ ] T016 Run the manual quickstart validation (`specs/035-volunteer-nav-menu/quickstart.md`) via the dev
  server / browser preview: anonymous (no "Main" bar), signed-in on `/whats-on` (Main bar appears beneath the
  public bar), `/payments` present + active, home page shows no double nav; screenshot the signed-in result.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies.
- **Foundational (Phase 2)**: after Setup — `getActor()` is used by US2's `Nav` refactor.
- **US1 (Phase 3)**: after Setup. Delivers the complete menu + guard using the *existing* Nav rendering — does
  **not** depend on US2. MVP.
- **US2 (Phase 4)**: after Foundational (`getActor`). Independent of US1's entry additions, but naturally done
  after so the every-page menu is already complete. Touches the auth seam / layouts / home page.
- **US3 (Phase 5)**: after US1 (the guard it demonstrates).
- **Polish (Phase 6)**: after the desired stories.

### Within Each User Story

- Test tasks (T003, T006, T007) are written and made to FAIL before their implementation.
- T002 (`getActor`) before T009 (`Nav` uses it).
- T004 (walker) before/with T003 being runnable; T005 (entries) makes T003 green.
- T008 (presenter) before T009 (`Nav` renders it); T009 before T010 (root-layout wire); T010 before T011/T012
  (remove the now-duplicate renders).

### Parallel Opportunities

- Limited — most tasks touch shared files (`nav.ts`, `Nav.tsx`, the layouts, `page.tsx`). The two test files
  (`auth.navCompleteness.test.ts` and `volunteerNav.test.tsx`) are different files and could be drafted in
  parallel, but belong to different stories. **[P]** applies to T014 (glossary, independent file).

---

## Parallel Example

```bash
# Minimal parallelism. The one independent-file task:
Task: "T014 Update docs/zak1_Help_Glossary.md with the volunteer-nav + completeness-guard note"
# Everything else touches nav.ts, Nav.tsx, layout.tsx, the group layouts, page.tsx, or a shared test file.
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 Setup (T001) → Phase 2 Foundational (T002).
2. Phase 3 US1 (T003 guard test → T004 walker → T005 entries).
3. **STOP and VALIDATE**: the menu is complete and `/payments` is reachable (D1 closed) via the existing nav.
   Demoable MVP.

### Incremental Delivery

1. Setup + Foundational → `getActor` ready.
2. US1 → complete menu + guard (MVP, D1 closed).
3. US2 → render on every page when signed in, active-state, hidden anonymous (placement B restructure).
4. US3 → prove future orphans are caught.
5. Polish → glossary, gates, browser validation.

---

## Notes

- Test-first everywhere except US3's T013 (a demonstration of the existing US1 guard).
- **No** database, migration, API route, or authorization-model change — presentation only (FR-004). The route
  inventory of `/api` is unaffected; this adds a **page** walker beside it.
- ⚠️ Placement B widens the blast radius vs. 034: this feature edits the `(admin)`/`(door)` layouts, the root
  layout, and the home page, and retires the 025 home-page-nav special case. Verify existing tests stay green
  (the `checkin`/`gate` component tests render page components directly, not the layouts, so they are unaffected;
  `home.staffNav.test.tsx` is intentionally updated in T012).
- Whole feature ships as one atomic commit per repo convention (solo-maintainer mode).
