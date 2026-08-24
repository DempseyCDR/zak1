# Phase 1 Data Model: Public venues & directions (P7-R8)

**Additive migration `0035_venue_public_directions.sql`** — two columns on `venues`, no destructive change,
no backfill (both defaulted/nullable). `0035` because `0034` is 051's (in flight); the tables differ, so merge
order is irrelevant.

## `venues` — two fields added

| Column | Type | Notes |
|--------|------|-------|
| `is_public` | `boolean` not null default **`false`** | opt-in public exposure; **default off** is the safety property (existing venues are private until opted in) |
| `directions` | `text` nullable | transit/parking/how-to-get-there note; shown only for public venues |

Unchanged: `id`, `name`, `short_name`, `address` (**not null**), `latitude`, `longitude`, `landlord_contact_id`,
timestamps. Existing name/address/short/location behavior is unchanged; only **when they're exposed publicly**
changes.

## The gate — `public = is_public AND has an address`

A single predicate (`domain/public/publicVenues.ts`):

- **`publicVenueView(v)`** → `PublicVenue`:
  - if `v.isPublic` **and** `v.address` is non-empty → `{ name, address, mapUrl: venueMapUrl(v), directions }`
    (full public shape).
  - else → **name-only** `{ name, address: null, mapUrl: null, directions: null }`.
- **`listPublicVenues(db)`** → the directory: every venue passing the predicate, as the full public shape,
  ordered by name.

## `PublicVenue` — reshaped (nullable = gated)

`PublicVenue = { name: string; address: string | null; mapUrl: string | null; directions: string | null }`.

- `getPublicEventDetail` sets its `venue` from `publicVenueView` — so a non-public venue yields `name` only.
- The nullable `address`/`mapUrl`/`directions` push the gate into the type: a renderer shows each **only when
  non-null**, so it cannot leak a withheld address.

## Validation (`validation/venues.ts`)

- `venueCreateSchema` / `venuePatchSchema` gain `isPublic: z.boolean().optional()` and
  `directions: z.string().trim().nullable().optional()`.
- **Guard (FR-007)** enforced in `venueService` (not just Zod): a create/patch MUST NOT leave a venue
  `is_public = true` with an empty/whitespace **effective address** (`incoming.address ?? existing.address`) —
  reject with a 422 validation error.

## State / rules

- **Mark public** (admin, `venue.write`): sets `is_public = true` — allowed only when the venue has an address.
- **Unmark public**: sets `is_public = false` — the venue immediately disappears from all public surfaces.
- **Edit directions**: free text; shown only while the venue is public.

## Validation rules (enforced by tests)

- `listPublicVenues` returns only public venues **with an address** (excludes non-public + address-less);
  includes `directions` (integration).
- `getPublicEventDetail` venue is **name-only** for a non-public venue (no address/map/directions) and the full
  block for a public one (integration).
- `venueService` **rejects** marking a venue public without an address (integration).
- The venue schemas accept `isPublic`/`directions` (unit).
