# Phase 0 Research: Volunteer Navigation Menu

The two load-bearing decisions were resolved in `/speckit-clarify` (sourcing = hand-maintained + completeness
test; placement = every page when signed in). Remaining decisions are technical, resolved below. No open
`NEEDS CLARIFICATION`.

## R1 — Rendering the menu on every page when signed in (placement B)

- **Decision**: Render `<Nav/>` from the **root layout** (`src/app/layout.tsx`), immediately after
  `<PublicNav/>` and before `{children}`. `Nav` is an async **server** component that loads the actor-or-null
  and returns `null` when nobody is signed in.
- **Rationale**: The root layout wraps every route group, so this is the single place that satisfies "every page
  when signed in" (option B) with the volunteer bar beneath the public bar. Returning `null` when anonymous
  keeps the layout unconditional and the menu absent for visitors (FR-005). Removing `<Nav/>` from the
  `(admin)`/`(door)` layouts avoids double-rendering.
- **Alternatives considered**: keep `<Nav/>` in the group layouts (rejected — that is placement A, which the
  clarify chose against); a client-only nav that fetches items (rejected — the actor + capabilities are
  server-side; a fetch would add an endpoint and a loading state for no benefit).

## R2 — Nullable actor load in the root layout

- **Decision**: Add a nullable actor loader to `src/server/auth/currentStaff.ts` (e.g. `getActor(): Promise<
  Actor | null>`) and have `Nav` use it. `requireActor()` (which throws/redirects) stays for pages.
- **Rationale**: The root layout renders for anonymous visitors too, so `Nav` must not throw. `getCurrentStaff()`
  is already nullable but carries identity only (no capabilities); `navItemsFor` needs the `Actor`. A nullable
  actor loader is the smallest addition that keeps the throwing `requireActor` for real page guards.
- **Cost**: one session/actor load per request in the root layout. On **staff** pages this is already paid by
  `requireStaff` in the group layout, so no new cost there. On **anonymous** public requests there is no session
  cookie, so it is a cheap no-op. Acceptable; noted for Observability (no new logging needed).
- **Alternatives considered**: reuse `getCurrentStaff` then a separate capability load (two round-trips —
  rejected); pass the actor down from group layouts (doesn't cover public pages — rejected).

## R3 — Active-state on a server-authorized menu (server loader + client presenter)

- **Decision**: Split `Nav` into a **server** loader (`Nav.tsx`: resolves actor → `navItemsFor(actor)` → items)
  and a **client** presenter (`VolunteerNav.tsx`, `"use client"`: takes `items`, renders links, marks the
  current one active via `usePathname`). Landmark stays `aria-label="Main"` (distinct from PublicNav's `"Site"`).
- **Rationale**: Authorization/capabilities are server-side; active-state (FR-008) needs the client `usePathname`
  hook. Passing already-resolved items to a small client island keeps the auth on the server and the path on the
  client — the same split feature 034 used for PublicNav. Active-match rule reuses 034's: `pathname === href ||
  pathname.startsWith(href + "/")`.
- **Alternatives considered**: make the whole nav a client component and expose capabilities to the client
  (leaks authorization detail, needs an endpoint — rejected); no active-state (fails FR-008).

## R4 — Completeness guard (sourcing A)

- **Decision**: Add a staff-page-route walker to `src/server/lib/routeInventory.ts` (reuse `findFiles` over
  `src/app/(admin)` and `src/app/(door)`, compute each `page.tsx`'s URL path — strip route-group `(…)` folders,
  keep `[param]` segments). A node test `tests/integration/auth.navCompleteness.test.ts` asserts **every** static
  staff page route is an `NAV` href, and every `NAV` href resolves to a real page. **Dynamic `[param]` routes are
  excluded** (documented) because they cannot map to one static href — `/organizer/[seriesKey]` is represented by
  the `/organizer/tnc` entry. **A documented href allowlist** covers `NAV` entries whose page lives **outside**
  the two walked groups: currently `/dev/routes` (`src/app/dev/routes/page.tsx` — the super-user dev route index,
  not under `(admin)`/`(door)`). The reverse "no dead entry" check treats an allowlisted href as valid; the
  forward "no orphaned page" check only walks `(admin)`/`(door)`, so `/dev/routes` is not required to be found
  there.
- **Rationale**: This mirrors the retired-array lesson: the `/dev/routes` index and `auth.routeInventory.test.ts`
  were made to share one source-tree walker so a route can never be forgotten. The same walker style, applied to
  pages + the `NAV` list, makes an orphaned volunteer page fail CI (FR-006/SC-003) — without inventing per-page
  capability metadata (clarify A).
- **Alternatives considered**: generate the menu from the tree (clarify B, rejected — needs per-page label +
  capability convention UI pages lack); a hand-kept "known pages" list to diff against (rejected — that is just
  a second hand list that can drift).

## R5 — The five orphans and the D1 fix

- **Decision**: Add `NAV` entries for `/payments` (`performer_payment.write`), `/bookings-report`, `/door-
  parameters`, `/venue-rents`; the exact gating capability of the latter three is the page's **primary-purpose**
  capability, read from each page during implementation (best estimates: `booking.write`, `parameter.write`,
  `venue.write`). `/organizer/[seriesKey]` stays represented by the existing `/organizer/tnc` entry and is
  excluded from the walker as a dynamic route.
- **Rationale**: FR-002 requires completeness; the audit (plan) enumerated the gaps. `/payments` closes D1
  (FR-007). Each capability follows the existing nav rule — the capability the page is **for**, not mere read
  access.
- **Alternatives considered**: only fixing `/payments` (rejected — leaves the class open; the whole point is the
  completeness guard, which would immediately fail on the other four).

## R6 — Superseding feature 025's home-page staff nav

- **Decision**: Remove `{staff && <Nav/>}` from `src/app/page.tsx`; the root-layout nav now covers the home page.
  Retire/replace `tests/component/home.staffNav.test.tsx` (its behavior — nav shown when signed in, hidden when
  anonymous — moves to the root layout / `Nav`-returns-null path, covered by the new tests).
- **Rationale**: Option B makes the home page's bespoke staff-nav rendering (025 US4/FR-017) redundant and
  double-rendered. Removing it keeps one source of the volunteer bar.
- **Alternatives considered**: leave the home page's `<Nav/>` (rejected — double nav on `/`).
