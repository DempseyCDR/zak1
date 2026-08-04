# Phase 1 Data Model: Volunteer Navigation Menu

No persisted data — no table, no migration. The model is the existing hand-maintained menu list plus the
route-set it is validated against.

## Entity: Volunteer menu entry (existing, extended)

One navigable staff destination. Already defined in `src/server/auth/nav.ts` as the `NAV` array element.

| Field | Type | Notes |
|-------|------|-------|
| `href` | `string` | Staff route (e.g. `/payments`). Must resolve to a real page under `(admin)`/`(door)`. |
| `label` | `string` | Human-readable menu text. |
| `capability` | `Capability \| null` | The capability the page is **for** (its primary purpose); `null` = every authenticated volunteer (base). Exhaustive string-literal union — a wrong value is a compile error. |

- **Collection**: `NAV` — an ordered array; `navItemsFor(actor)` filters it to `{ href, label }[]` by the
  actor's capabilities (unchanged). Hand-maintained (clarify A).
- **Display rule (FR-003)**: an entry appears only when `capability === null` or the actor holds `capability`.
- **Completeness invariant (FR-002/FR-006)**: the set of `NAV` hrefs must cover the set of **static** staff
  page routes (below). Enforced by test, not types.
- **Derived active state (FR-008)**: computed on the client from `usePathname` — active when
  `pathname === href || pathname.startsWith(href + "/")`. Not stored.

### Entries added this feature (fix the orphans)

| `href` | `label` | `capability` |
|--------|---------|--------------|
| `/payments` | Payments | `performer_payment.write` |
| `/bookings-report` | Booking report | `booking.write` *(confirm)* |
| `/door-parameters` | Door parameters | `parameter.write` *(confirm)* |
| `/venue-rents` | Venue rents | `venue.write` *(confirm)* |

## Entity: Staff page route (derived from the source tree)

Not stored — enumerated by the completeness walker from the filesystem.

| Field | Type | Notes |
|-------|------|-------|
| `path` | `string` | URL path of a `page.tsx` under `src/app/(admin)` or `src/app/(door)`, with route-group `(…)` folders stripped and `[param]` segments kept. |
| `dynamic` | `boolean` | True if the path contains a `[param]` segment. |

- **Source**: `routeInventory.findFiles` over the two staff route groups.
- **Validation (the guard test)**: every **static** (`dynamic === false`) staff page route under
  `(admin)`/`(door)` MUST be an `NAV` href; every `NAV` href MUST resolve to a real staff page. Two documented
  exception sets: **dynamic** routes are excluded (`/organizer/[seriesKey]` → represented by `/organizer/tnc`),
  and an **href allowlist** covers `NAV` entries whose page lives outside the two walked groups — currently
  `/dev/routes` (`src/app/dev/routes/page.tsx`, the super-user dev index). Allowlisted hrefs satisfy the reverse
  "no dead entry" check.

## Relationships

- `NAV` (menu entries) ↔ staff page routes: a completeness correspondence enforced by the guard test, not a
  stored relationship.
- Intentionally **decoupled** from the public menu's `PUBLIC_NAV` (feature 034) — different concern (public,
  no capabilities) and different landmark (`Site` vs `Main`).
