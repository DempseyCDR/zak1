# Quickstart: Public venues & directions (P7-R8)

Validation/run guide. Implementation lives in `tasks.md` + code; this proves the feature end-to-end.

## Prerequisites

- On `052-public-venues` (off `main`; has the venues admin + public event read + P7-R1 tokens/nav).
- `pnpm install`; run the migration: `pnpm run db:migrate` (applies `0035_venue_public_directions.sql`).
  Snapshot `zak1_dev` first (`pg_dump`), per the migration convention.
- Signed-in staff with **`venue.write`** for the admin steps.

## 1. Automated checks (write tests first — constitution Test-First)

```bash
pnpm test -- venueValidation                     # schemas accept isPublic/directions
pnpm test:integration -- publicVenues            # list + event gating + reject-public-without-address
pnpm typecheck && pnpm lint
```

**Expected**: `listPublicVenues` returns only public venues with an address (with directions), never a
non-public/address-less one; `getPublicEventDetail` returns a **name-only** venue for a non-public venue and the
full block (incl. directions) for a public one; `venueService` **rejects** marking a venue public without an
address; the schemas accept `isPublic`/`directions`.

## 2. Admin opt-in (browser)

As a signed-in `venue.write` staff member in the venues admin:

- **SC-004**: mark a hall (e.g. the Rose Room) **public**, add a directions note, and save → it appears on
  `/directions`.
- Try to mark an **address-less** venue public → the save is **rejected** (SC-003 defense).
- **Unmark** a public venue → it disappears from `/directions` and any event page.

## 3. Public surfaces (browser, 375px)

- **SC-001**: open `/directions` → every **public** venue shows name, address, tappable map link, and its
  directions note; one H1, no horizontal scroll; reachable from the nav.
- **SC-002 / privacy**: with an event at a **non-public** venue, open that event's page → it shows the venue
  **name only**, with **no** address, map link, or directions. And the non-public venue does **not** appear on
  `/directions`.
- **SC-005**: the four public core venues (Rose Room, First Rochester, German House, Rosette Studio), once
  marked public, appear on `/directions`; private venues do not.

## Success criteria mapping

| Check | Criterion |
|-------|-----------|
| `/directions` lists public venues (name/address/map/directions), one H1 | SC-001 |
| Non-public venue: address/map/directions on zero public surfaces | SC-002 |
| Address-less/placeholder venue never public/listed | SC-003 |
| Staff opt-in + directions; unmark removes everywhere | SC-004 |
| The four core venues appear once public | SC-005 |
