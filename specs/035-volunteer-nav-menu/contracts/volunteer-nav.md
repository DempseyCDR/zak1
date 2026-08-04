# UI + Guard Contract: Volunteer Navigation Menu

No new HTTP API. The contract is the component surface plus the completeness guard.

## Server component: `Nav`

- **File**: `src/app/Nav.tsx` (async server component)
- **Rendered by**: the root layout (`src/app/layout.tsx`), after `<PublicNav/>` and before `{children}` — so it
  is the **second** bar on every page.
- **Behavior**:
  - Loads the actor via the nullable loader (`getActor()`), returns `null` when no volunteer is signed in
    (FR-005 — nothing renders for anonymous visitors).
  - When signed in, computes `items = navItemsFor(actor)` (role-filtered, FR-003) and renders
    `<VolunteerNav items={items} />`.
- **Contract**: performs **no** authorization decision that affects access (FR-004) — it only chooses what to
  offer; every destination stays guarded by its own route/page.

## Client component: `VolunteerNav`

- **File**: `src/app/VolunteerNav.tsx` (`"use client"`)
- **Props**: `{ items: { href: string; label: string }[] }` — already resolved and role-filtered by `Nav`.
- **Rendered structure**:
  - `<nav aria-label="Main">` — landmark distinct from the public menu's `aria-label="Site"` (FR-009).
  - One `next/link` per item, in order, `href`/`label`.
  - The link matching the current section carries `aria-current="page"` + active style, using
    `pathname === href || pathname.startsWith(href + "/")` (FR-008).
- **Contract**: pure presentation of the given `items`; no fetching, no auth. Renders nothing meaningful when
  `items` is empty (a signed-in volunteer always has ≥ the base entries, so this is the degenerate case only).

## Behavioral contract (by state)

| State | Public menu (034) | Volunteer menu (this feature) |
|-------|-------------------|-------------------------------|
| Anonymous visitor, any page | present | **absent** |
| Signed-in volunteer, any page (public or staff) | present (top) | present (second bar), role-filtered |
| Signed-in, on a page they operate | — | that entry is `aria-current="page"` |

## Guard contract: nav completeness (the D1-class fix)

- **Walker**: `src/server/lib/routeInventory.ts` gains a staff-page-route enumerator (reuse `findFiles` over
  `src/app/(admin)` and `src/app/(door)`; strip route-group `(…)` folders; keep `[param]`).
- **Test**: `tests/integration/auth.navCompleteness.test.ts` asserts:
  1. every **static** staff page route under `(admin)`/`(door)` is an `NAV` href (no orphaned page —
     FR-002/FR-006);
  2. every `NAV` href resolves to a real staff page (no dead entry);
  3. **dynamic** `[param]` routes are excluded via a documented allowlist (`/organizer/[seriesKey]` →
     represented by `/organizer/tnc`);
  4. an **href allowlist** covers entries whose page is outside the two walked groups — currently `/dev/routes`
     (`src/app/dev/routes/page.tsx`); allowlisted hrefs satisfy check 2 and are not required by check 1.
- **Contract**: adding a new static staff page with no `NAV` entry **fails this test** (SC-003) — the page cannot
  be silently orphaned.

## Non-contract (out of scope)

- No generation of the menu from the tree (clarify rejected B).
- No per-page capability/label metadata convention.
- No change to route-level authorization (`withAuth`/`requireStaff`).
- No new endpoint, table, or migration.
