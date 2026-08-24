# Phase 0 Research: Public venues & directions (P7-R8)

Format per decision: **Decision / Rationale / Alternatives**. The three UX/scope choices (non-public event
display, public-requires-address, directions-page scope) were settled in `/speckit-clarify`; this resolves the
implementation unknowns.

## R1. Fields — `is_public` (default false) + `directions`, additive

**Decision**: Add `venues.is_public boolean not null default false` and `venues.directions text` (migration
**`0035`**, additive). Default-off is the whole safety property — every existing venue becomes non-public until
a staff member opts it in, so the migration itself cannot expose an address.

**Rationale**: Matches the spec's opt-in requirement and the likely-schema note. Additive + defaulted → no
backfill, no data transform. `0035` (not `0034`) avoids a filename collision with 051's in-flight `0034`
(different tables → merge order is irrelevant).

**Alternatives**: A separate `public_venues` table — rejected (a venue is one thing; a flag is simpler than a
join). Default `is_public` true — rejected (that IS the defect; opt-in is the requirement).

## R2. The single gate — `public = is_public AND has an address`; non-public → name-only

**Decision**: One shared predicate/view in `domain/public/publicVenues.ts`. `publicVenueView(v)` returns the
**public** venue shape `{ name, address, mapUrl, directions }` only when `v.is_public` **and** `v.address` is
non-empty; otherwise it returns **name-only** `{ name, address: null, mapUrl: null, directions: null }`.
`listPublicVenues(db)` returns the full public shape for every venue passing the predicate (the directory).
Both public surfaces — `/directions` and `getPublicEventDetail` — go through this one place.

**Rationale**: A privacy rule applied in two places drifts; one predicate can't be half-applied. Expressing the
non-public projection as **nullable address/mapUrl/directions** (not omission at the call site) makes the safe
outcome the default the type enforces. Requiring a non-empty address in the predicate kills the "null records"
defect even for any legacy row.

**Alternatives**: Filter `is_public` in each query independently — rejected (two sources of the same rule).
Omit the venue entirely for non-public on the event page — rejected by clarification (show the name).

## R3. `PublicVenue` shape — add `directions`, make `address`/`mapUrl` nullable

**Decision**: `PublicVenue = { name: string; address: string | null; mapUrl: string | null; directions: string
| null }`. `getPublicEventDetail` sets it from `publicVenueView`. The event page renders the **name always**,
and the **address**, **map link**, and **directions** **only when non-null** (i.e. only for a public venue).

**Rationale**: The nullable fields carry the gate into the type — a page literally cannot render an address the
projection withheld. Adding `directions` here also feeds the event-page venue block (and the R5 block later).

**Alternatives**: A discriminated union (`{kind:'public',…} | {kind:'private',name}`) — rejected (nullable
fields are simpler and the render is a straight `x != null` check). Keep `address` non-null and use `""` for
private — rejected (`""` is a value that can leak into markup; `null` is unambiguous absence).

## R4. Directions page + route — `/directions`, all public venues, nav entry

**Decision**: A new public page `src/app/(public)/directions/page.tsx` renders `listPublicVenues` — every public
venue with its name (`<h2>`), address, tappable map link, and directions note (omitted when empty) — under one
`<h1>`. Add `{ href: "/directions", label: "Directions" }` to `PUBLIC_NAV`. **Not `/venues`** — the admin
venues page already owns `/venues` (route groups share the root path).

**Rationale**: `/directions` is the clear public name and avoids the admin-route collision. Listing **all**
public venues (clarified) makes it a stable directory, useful between events. `PUBLIC_NAV` is the hand-maintained
single source (034).

**Alternatives**: `/venues` — rejected (collides with the admin page). Only venues with upcoming events —
rejected by clarification. A CMS content page — rejected (this is structured venue data, not prose; R7's CMS is
for prose).

## R5. Admin editing + the public-requires-address guard

**Decision**: Extend the existing venues editor (`(admin)/venues/page.tsx`) with an **is-public** toggle and a
**directions** textarea; the existing `venue.write`-gated `PATCH /api/venues/[id]` carries them via the extended
`venuePatchSchema`. `venueService` (`createVenue`/`patchVenue`) **rejects** a change that would leave the venue
`is_public = true` with an empty/whitespace address (checking the effective address = incoming ?? existing) —
`errors.validation(...)` (422). No new capability; `venue.write` already gates venue edits, and venue edits
already emit `writeAudit('venue.updated')`.

**Rationale**: Reuses the whole venue-admin path; the guard is the FR-007 hard rule (public requires address)
and the structural defense against placeholder venues. Keeping `writeAudit` matches the existing venue-edit
pattern (no new audit requirement in this feature).

**Alternatives**: A dedicated public-venues admin screen — rejected (the venue editor already exists). Enforce
the guard only in the UI — rejected (server-side is the real boundary). `recordAudit` for the toggle — deferred
(venue edits use `writeAudit` today; converting is out of scope).

## R6. Event-page venue block + the R5 tie-in

**Decision**: Update `whats-on/[eventId]/page.tsx` (main's thin event page, present on this branch) to render
the gated venue: **name always**; **address** + **map link** + **directions** only when the projection provides
them. When **P7-R5 (049)** lands, its richer `VenueBlock` consumes the same gated projection (it already handles
a null venue; it gains a `null-address` case + the directions slot it reserved) — a small **merge
reconciliation** on this shared file/projection, expected for the parallel branches.

**Rationale**: The projection is the enforcement point; the page just renders what it's given. Both 052 and 049
touch this file, so the reconciliation is unavoidable and small (both consume the same `PublicVenue`).

**Alternatives**: Wait for R5 to merge, then do R8 on top — rejected (R8's privacy fix shouldn't block on the
frontend stack; the projection gate is the substantive part and is independent).

## R7. Testing — the privacy gate is the headline

**Decision**: integration `publicVenues.test.ts` (real Postgres): seed a **public** venue (address + directions)
and a **non-public** venue; assert `listPublicVenues` returns only the public one (with directions) and never
the non-public/address-less one; seed an event at the non-public venue and assert `getPublicEventDetail`'s
venue is **name-only** (no address/map/directions), and at a public venue assert the full block incl.
directions; assert `venueService` **rejects** setting `is_public=true` on a venue with an empty address
(inserted directly to bypass create validation). Unit `venueValidation.test.ts`: the schemas accept
`isPublic`/`directions`. The `/directions` page + the event page (public vs. private) are browser-verified.

**Rationale**: The gate carries the privacy weight, so it gets the explicit real-Postgres test at both surfaces;
the schema change gets a fast unit test; layout is browser-verified (async RSC).

**Alternatives**: Rendering the async pages in jsdom — rejected (they read the DB). Trusting the UI toggle
without a service-level guard test — rejected (the server is the boundary).
