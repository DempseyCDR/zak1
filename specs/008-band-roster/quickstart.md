# Quickstart & Validation: Reusable Band Roster

End-to-end validation guide. Implementation details live in `tasks.md`. Builds on features 003
(performers/bookings) and 009 (series-scoped `musician` rate, already shipped).

## Prerequisites

- Features 001–009 applied; Postgres running
- `pnpm install`; `.env` with `DATABASE_URL` / `TEST_DATABASE_URL`

## Setup

```bash
pnpm db:migrate     # applies 0013_bands.sql (bands, band_members, bookings.band_id)
pnpm db:seed        # optional; seeds a couple of sample bands from the seeded performers
```

## Run

```bash
pnpm dev
# /bands       — band directory: create/edit/archive a band, manage its roster
# /bookings    — existing bookings UI, now with a "book a band" action
```

## Validation scenarios

Map to acceptance scenarios in [spec.md](spec.md); contracts in [contracts/api.md](contracts/api.md).

1. **Create + maintain a band** (US1): `POST /api/bands` with a name, a lead, and two musicians;
   confirm it appears in `GET /api/bands`. `PATCH` to add/remove a member and to reassign the lead;
   confirm exactly one lead is enforced and the change persists (FR-001/FR-002).
2. **Band bio/photo independent of members** (US1): set a band photo/bio; confirm no member's own
   `performers.photoUrl`/`bio` changed, and vice versa (FR-009/SC-005).
3. **Book a band as a unit** (US2): with a 4-person band, `POST /api/events/:id/book-band`; confirm 4
   bookings created, each with the right `performerType` (one lead_musician, rest musician) and
   `band_id` set (FR-003/SC-001).
4. **Skip already-booked member** (US2, FR-003c): book a member individually on an event, then book a
   band containing that member; confirm the response is `{ createdCount: n-1, skippedCount: 1 }` and
   no duplicate booking exists for that performer on the event.
5. **Musician-rate pay default** (US2, FR-003a): with a series `musician` rate set (feature 009),
   book a band; confirm every member's booking defaults to that rate. With no rate set, confirm pay
   defaults to 0 (the UI's propose-first-amount convenience is not asserted server-side) (FR-006/SC-007).
6. **Editing a band doesn't rewrite booking facts** (US2, SC-004): book a band onto an event, then
   edit the band's roster; confirm that event's already-created bookings (members, pay) are unchanged.
7. **Live band identity** (clarify): edit the band's name/photo; confirm `groupEventBookingsForDisplay`
   for a previously-booked event now reflects the new name/photo (live read, by design).
8. **Public grouping read model** (US3 — read model only, no public page): call
   `groupEventBookingsForDisplay(eventId)` and confirm: band-linked bookings collapse into one block
   per band (name/bio/photo, not individual members); ad-hoc (null-band) bookings appear separately;
   two bands on one event → two blocks (FR-007/FR-008, US3 scenarios).
9. **Soft-delete** (FR-011): `DELETE /api/bands/:id`; confirm it disappears from `GET /api/bands`,
   no performer or booking was altered, and a previously-booked event's grouping still resolves the
   band's identity.

## Test commands

```bash
pnpm test:unit          # roster/one-lead validation and any pure helpers
pnpm test:integration   # band CRUD, book-as-unit (skip + rate default), grouping read model — real Postgres
pnpm typecheck && pnpm lint
```

Expected: all green; booking a band reuses `createBooking` (per-type pay/check + `musician` rate
inherited from 003/009); no duplicate bookings; band identity reads live; soft-delete preserves past
bookings and display.
