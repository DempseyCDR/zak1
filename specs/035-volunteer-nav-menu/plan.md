# Implementation Plan: Volunteer Navigation Menu

**Branch**: `035-volunteer-nav-menu` | **Date**: 2026-08-04 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/035-volunteer-nav-menu/spec.md`

## Summary

Make the role-aware volunteer menu **complete** and render it on **every** page when signed in (beneath the
public menu), fixing defect D1 and its whole class. Two clarified decisions drive the design:

- **Sourcing (A)**: keep the hand-maintained capability-tagged `NAV` list, fix the orphans, and add an
  **automated completeness test** that walks the staff page tree and fails if any volunteer page lacks an entry
  — the `routeInventory` guard-test pattern, no generation, no per-page metadata convention.
- **Placement (B)**: move the volunteer menu out of the `(admin)`/`(door)` layouts into the **root frame**,
  guarded by sign-in, so it appears on all pages beneath the public menu — symmetric with feature 034.

The completeness audit already found **five orphans** (not just D1): `/payments`, `/bookings-report`,
`/door-parameters`, `/venue-rents`, plus the dynamic `/organizer/[seriesKey]` route (the nav represents it as
`/organizer/tnc`). Option B also **supersedes feature 025's home-page staff nav** (`page.tsx` renders
`{staff && <Nav/>}` today — the root layout now provides it everywhere).

## Technical Context

**Language/Version**: TypeScript 5.7 (strictest flags)

**Primary Dependencies**: Next.js 16.2.10 (App Router, RSC), React 19.2, `next/link`, `next/navigation`
(`usePathname`); existing auth seam (`getCurrentStaff`/`Actor`/`navItemsFor`), existing source-tree walker
(`src/server/lib/routeInventory.ts`)

**Storage**: N/A — the menu is a hand-maintained typed list (`NAV` in `src/server/auth/nav.ts`); no DB, no
migration

**Testing**: Vitest — jsdom **component** tests for the client presenter (`tests/**/*.test.tsx`) + a **node**
completeness test that walks the page tree (`tests/**/*.test.ts`, no Postgres)

**Target Platform**: Web — server layout resolves the actor; a small client island applies active-state

**Project Type**: Web application (single Next.js App Router project)

**Performance Goals**: Negligible — the root layout adds one nullable actor load per request (already paid on
staff pages via `requireStaff`; on anonymous public requests it is a cheap no-session check)

**Constraints**: Presentation only / courtesy-not-control (FR-004); role-aware (FR-003); hidden when anonymous
(FR-005); accessible + active-state (FR-008/FR-009)

**Scale/Scope**: ~20 staff pages / ~18–22 menu entries. Edits across the auth seam, root + group layouts, the
home page, one new client component, one new completeness test

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Test-First (NON-NEGOTIABLE)** — PASS. The **completeness test** is written first and fails against
  today's five orphans (RED) → adding the `NAV` entries makes it green. The client presenter gets jsdom
  component tests (items render, active-state, hidden when no items) written first. The `navItemsFor`
  role-filtering already has coverage; the "hidden when anonymous" behavior moves to a layout/`Nav`-null test.
- **II. Simplicity / YAGNI** — PASS. Hand-maintained list + one completeness walker reusing `routeInventory`'s
  `findFiles`; **no** generation, **no** per-page metadata convention (clarify A). The server/client split is
  the minimal way to add active-state to a server-authorized menu (mirrors 034's PublicNav), not a new
  abstraction.
- **III. Type Safety** — PASS. `NAV` entries are typed; `Capability` is an exhaustive string-literal union
  (a wrong capability is a compile error). No new external boundary → no Zod.
- **IV. Observability** — PASS (N/A). No new HTTP route, mutation, or external call. The added root-layout actor
  read reuses the existing session path; nothing new to log.

**Result**: All gates pass. Complexity Tracking empty.

## Project Structure

### Documentation (this feature)

```text
specs/035-volunteer-nav-menu/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── volunteer-nav.md # Phase 1 output — UI + completeness-test contract
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks (NOT created here)
```

### Source Code (repository root)

```text
src/server/auth/
├── nav.ts                     # EDIT — add the 5 orphan entries; navItemsFor unchanged
└── currentStaff.ts            # EDIT — add a nullable actor loader (Actor | null) for the root layout
src/server/lib/
└── routeInventory.ts          # EDIT — add a staff-page-route walker (reuse findFiles over (admin)/(door))
src/app/
├── layout.tsx                 # EDIT — render <Nav/> after <PublicNav/> (beneath it), before {children}
├── Nav.tsx                    # EDIT — server loader: actor-or-null → items → <VolunteerNav/>; null if anonymous
├── VolunteerNav.tsx           # NEW  — "use client" presenter: items → links, active via usePathname, aria "Main"
├── page.tsx                   # EDIT — drop {staff && <Nav/>} (superseded by the root-layout nav — retires 025)
├── (admin)/layout.tsx         # EDIT — remove <Nav/> (keep requireStaff); nav now comes from the root
└── (door)/layout.tsx          # EDIT — same

tests/
├── integration/auth.navCompleteness.test.ts  # NEW — every staff page route is in NAV or the exclusion list
├── component/volunteerNav.test.tsx           # NEW — presenter: items, active-state, hidden when empty
└── component/home.staffNav.test.tsx          # EDIT/RETIRE — home no longer renders Nav (moved to root layout)
```

**Structure Decision**: Single Next.js App Router project. The volunteer menu moves to the **root layout**
(placement B) as an async server component `Nav` that loads the actor-or-null and returns `null` for anonymous
visitors — so the layout renders it unconditionally and it "just disappears" when signed out. `Nav` delegates
rendering to a client `VolunteerNav` (props: the resolved items) that applies active-state via `usePathname`
(the server can't read the path; same split rationale as PublicNav). Completeness (sourcing A) is enforced by a
node test that walks `(admin)`/`(door)` `page.tsx` files via `routeInventory`'s existing `findFiles` and asserts
each route is either an `NAV` href or in a small documented exclusion set (dynamic `[param]` routes, which can't
have one static href — `/organizer/[seriesKey]` is represented by the `/organizer/tnc` entry).

### Orphans to fix (found by the audit; capability = each page's primary purpose, confirmed in tasks)

| Route | Proposed label | Gating capability (confirm) |
|-------|----------------|-----------------------------|
| `/payments` | Payments | `performer_payment.write` (confirmed — D1) |
| `/bookings-report` | Booking report | `booking.write` |
| `/door-parameters` | Door parameters | `parameter.write` |
| `/venue-rents` | Venue rents | `venue.write` |
| `/organizer/[seriesKey]` | — (excluded; dynamic) | represented by `/organizer/tnc` (base) |

## Complexity Tracking

> No Constitution Check violations — table intentionally empty.
