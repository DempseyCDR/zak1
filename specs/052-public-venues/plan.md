# Implementation Plan: Public venues & directions (P7-R8)

**Branch**: `052-public-venues` | **Date**: 2026-08-23 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/052-public-venues/spec.md`

## Summary

Make a venue's public exposure **opt-in**. Add two additive `venues` fields — **`is_public`** (default
**false**) and **`directions`** (text) — editable in the existing venues admin (gated by `venue.write`). A
venue's **address, map link, and directions are exposed publicly ONLY when it is public**: a new
`listPublicVenues` read (public + has an address) backs a **`/directions`** page, and `getPublicEventDetail` is
**gated** so a non-public venue on an event page shows its **name only** (no address/map/directions). The admin
**rejects** marking a venue public without an address (the "null records" defect killed at the source).
Additive migration **`0035`** (0034 is 051's, in flight). Branches off `main`, independent of the 048–050 stack.

## Technical Context

**Language/Version**: TypeScript 5.7 (strict), React 19, Next.js 16 App Router (RSC).

**Primary Dependencies**: existing — Drizzle, Zod, `withAuth`/`actorCan` (016), `venueService`, `venueMapUrl`
(007), P7-R1 tokens (045), P7-R2 public nav (046), `apiFetch` (client). **No new dependency, no new capability**
(`venue.write` already gates venue edits).

**Storage**: PostgreSQL — **additive migration `0035_venue_public_directions.sql`**: `venues.is_public boolean
not null default false` + `venues.directions text`. No destructive change. (Independent table from 051's `0034`
→ no merge-order dependency.)

**Testing**: Vitest — **integration** (real Postgres): `listPublicVenues` returns only public venues with an
address (excludes non-public / address-less); `getPublicEventDetail` **gates** the venue (non-public → name
only, no address/map/directions; public → full incl. directions); `venueService` **rejects** marking a venue
public without an address. A **unit** test that the venue Zod schemas accept `isPublic`/`directions`. The
`/directions` page + the event page (public vs. private venue) are **browser-verified** (async RSC).

**Target Platform**: Public website (directions page + event pages) + the staff venues admin.

**Performance Goals**: One indexed read per surface (the public-venue list; the event's venue). Negligible.

**Constraints**: **Privacy is load-bearing** — a non-public venue's address/map/directions must appear on **zero**
public surfaces (FR-005). Public pages are mobile-first (~375px, no horizontal scroll), one H1, AA, reachable
from the nav.

**Project Type**: Web application (Next.js App Router); admin + public route groups.

**Scale/Scope**: Two additive venue fields + migration, the venues admin + validation + service extended, one
gated projection + one new public read, a `/directions` page + nav entry, and an update to the event page's
venue block. ~4 focused tests + browser verification.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment |
|-----------|------------|
| **I. Test-First (NON-NEGOTIABLE)** | PASS (planned). Tests first: integration — `listPublicVenues` (public+address only), `getPublicEventDetail` gating (non-public → name only; public → full + directions), `venueService` reject-public-without-address; unit — the venue schemas accept `isPublic`/`directions`. Public pages browser-verified. |
| **II. Simplicity / YAGNI** | PASS. Two additive fields (no new table, no new capability); reuse the venues admin + `venueMapUrl`; a single gating predicate (public + has address) applied at each public read. No geocoding, no virtual venues (B45 out of scope). |
| **III. Type Safety** | PASS. Zod adds `isPublic`/`directions` at the boundary; `PublicVenue` gains `directions` and nullable `address`/`mapUrl` (a non-public venue's are null, so the type forces callers to handle absence — the gate is expressed in the type). No `any`. |
| **IV. Observability** | PASS (honest). Venue edits already emit `writeAudit` (`venue.updated`) — the public-toggle rides that; no new write path. |

**⚠️ Privacy note (load-bearing):** the gating predicate — **public = `is_public` AND has an address** — is
applied at **every** public read (`listPublicVenues` and `getPublicEventDetail`), so a private-home address can
never reach a public surface. The `PublicVenue` type carrying **nullable** `address`/`mapUrl` makes "no address
shown" the default a caller must opt out of, not something they must remember to hide.

**Development Workflow**: Multi-contributor mode — on `052-public-venues` (off `main`), lands via a **reviewed
PR** (no self-merge). No Complexity Tracking entries.

## Project Structure

### Documentation (this feature)

```text
specs/052-public-venues/
├── plan.md
├── research.md          # Phase 0 (fields, gating predicate + projection, directions page/route, admin, R5 tie-in, testing)
├── data-model.md        # Phase 1 (venues +is_public +directions; migration 0035; PublicVenue shape)
├── quickstart.md        # Phase 1 (opt-in toggle, private stays private, directions page, event-page gating)
├── contracts/
│   └── public-venues.md # UI/read contract: directions page + gated event venue + admin fields
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
src/server/db/migrations/0035_venue_public_directions.sql   # NEW additive: is_public + directions
src/server/db/schema/venues.ts                              # + isPublic (default false) + directions
src/server/validation/venues.ts                             # create/patch schemas += isPublic + directions
src/server/domain/venues/venueService.ts                    # create/patch handle the fields + REJECT public-without-address
src/server/domain/public/
├── publicVenues.ts                                         # NEW: listPublicVenues (public + has address) + the
│                                                           #   shared publicVenueView(v) gate → { name, address,
│                                                           #   mapUrl, directions } | name-only
└── publicSchedule.ts                                       # getPublicEventDetail: gate the venue via publicVenueView;
                                                            #   PublicVenue += directions, nullable address/mapUrl

src/app/(public)/directions/page.tsx + *.module.css         # NEW: the public directions page (all public venues)
src/app/(public)/whats-on/[eventId]/page.tsx                # render venue name always; address/map/directions only when present
src/app/publicNavItems.ts                                   # + { /directions, "Directions" }
src/app/(admin)/venues/page.tsx                             # + is-public toggle + directions field in the venue editor

tests/
├── unit/venueValidation.test.ts                            # NEW: schemas accept isPublic/directions
└── integration/publicVenues.test.ts                        # NEW: listPublicVenues + event gating + reject-public-without-address
```

**Structure Decision**: The gate lives in **one shared predicate/view** (`publicVenueView` /
`listPublicVenues` in `publicVenues.ts`): "a venue is public iff `is_public` AND it has an address", and the
public projection of a non-public venue is **name-only**. Both public surfaces — the `/directions` page and
`getPublicEventDetail`'s venue block — consume that single source, so the privacy rule can't be half-applied.
`/directions` (not `/venues`, which the admin route already owns) is a new public page + nav entry. The admin
reuses the existing venues editor + `venue.write`. The event page (`whats-on/[eventId]`) is updated to render a
gated venue (name always, address/map/directions only when the projection provides them) — the same file R5
(049) also touches, so a small merge reconciliation is expected when both land (R5 already reserved the
directions slot).

## Complexity Tracking

> No Constitution Check violations — table intentionally empty.
