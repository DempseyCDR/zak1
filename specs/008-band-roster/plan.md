# Implementation Plan: Reusable Band Roster

**Branch**: `008-band-roster` | **Date**: 2026-07-03 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/008-band-roster/spec.md`

## Summary

Adds a reusable **Band** entity — a named, editable roster of one Lead Musician plus zero or more
Musicians (all existing Performers), with its own bio/photo — so an organizer can book a whole band
onto an event in one action instead of adding each member's booking individually. Each created
booking retains a link back to its Band (`bookings.band_id`), which lets a future public site brand
those bookings as the band. Band identity is **live** (edits re-read the current band; delete is a
soft-delete/archive). The per-member pay default already works: feature 009 shipped a series-scoped
`musician` rate kind that both Lead Musician and Musician bookings resolve — so **this feature builds
on 009's rate model rather than adding any rate mechanism** (FR-012/FR-013 are already satisfied).

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js LTS (24.x), strict mode (existing project)

**Primary Dependencies**: Next.js (App Router), Drizzle ORM, Zod, pino. Builds on feature 003
(`performers`, `bookings`, `bookingService.createBooking`, `PERFORMER_RULES`) and feature 009
(`resolveParameterCents` with the `musician` rate kind — already shipped). No new external dependency.

**Storage**: PostgreSQL 16. New: `bands` (id, name, bio, photo_url, archived_at, timestamps),
`band_members` (band_id, performer_id, is_lead) with a unique (band_id, performer_id); add a nullable
`band_id` FK to the existing `bookings` table. No changes to `performers`.

**Testing**: Vitest; band CRUD, roster edits, book-as-unit (including the skip-already-booked rule and
the Musician-rate pay default), and the public-display grouping helper are integration-tested against
real `zak1_test` (no DB mocking). Pure logic (e.g., roster→lead validation) can be unit-tested where
it doesn't touch the DB.

**Target Platform**: Linux server (Node); one new admin page (`/bands`) and an addition to the
existing bookings flow. **No public page** — see Scope note below.

**Performance Goals**: None specified; single-club scale — not a design constraint.

**Constraints**: Booking a Band MUST skip a member already booked on that event (FR-003c — the
`bookings` table has no (event, performer) uniqueness, so this must be enforced in the band-booking
service). Band identity is live, delete is soft-delete (FR-011/SC-004, per clarify). No new rate
mechanism — reuse feature 009's `musician` rate (FR-012/FR-013 already done).

**Scale/Scope**: Single tenant; a handful of bands, each a few members. On-demand admin edits only.

## Scope note — User Story 3 (public display) is a read model, not a page

Feature 007 (public website) is **not built** — the app has only `(admin)` and `(door)` route
groups, no public site. US3's acceptance scenarios describe how a public *listing* renders a band,
but there is no public listing to render into yet. Per the spec's own assumption ("Feature 007 …
will consume FR-007/FR-008 when it is planned"), this feature delivers the **grouping read model**
that 007 will consume — a helper that, given an event, returns its bookings grouped into band blocks
(current band name/bio/photo per distinct `band_id`) plus ungrouped ad-hoc bookings — and covers it
with integration tests. The actual public page rendering lands with feature 007. This keeps US3
independently testable (assert the grouping structure) without inventing a public site here.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Test-First (NON-NEGOTIABLE)**: PASS — band CRUD, the book-as-unit service (skip rule + rate
  default), and the public-grouping helper are integration-tested against real Postgres first; the
  book-as-unit service reuses the already-tested `createBooking` path per member, so per-type pay/
  check behavior is inherited, not re-derived.
- **II. Simplicity / YAGNI**: PASS — no band-identity snapshotting (live read, per clarify); no new
  rate mechanism (reuses feature 009's `musician` kind); book-as-unit is a thin orchestrator that
  loops the roster and calls the existing `createBooking` once per not-yet-booked member; the public
  concern is a single read-only grouping helper, not a speculative public UI.
- **III. Type Safety**: PASS — strict TS; Zod at the band CRUD + book-as-unit boundaries; `is_lead`
  and the "exactly one lead" invariant enforced in the service; no undocumented `any`/`as`.
- **IV. Observability**: PASS — structured logging via `withLogging` on the new routes; audit events
  for band create/update/delete and book-as-unit (mirrors existing `booking.created` auditing).

**Initial gate: PASS. No violations — Complexity Tracking left empty.**

## Project Structure

### Documentation (this feature)

```text
specs/008-band-roster/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
└── tasks.md   # /speckit-tasks (not created here)
```

### Source Code (repository root) — additions to the existing project

```text
src/
├── app/
│   ├── (admin)/bands/page.tsx              # NEW — band directory: create/edit/archive, manage roster
│   ├── (admin)/bookings/page.tsx           # add a "book a band" action to the existing bookings UI
│   └── api/
│       ├── bands/route.ts                  # GET list (non-archived) + POST create
│       ├── bands/[id]/route.ts             # GET one, PATCH (name/bio/photo/roster), DELETE (soft)
│       └── events/[id]/book-band/route.ts  # POST { bandId } → creates member bookings (skip rule)
├── server/
│   ├── db/
│   │   ├── schema/bands.ts                 # NEW — bands, bandMembers; + bookings.band_id column
│   │   └── migrations/0013_bands.sql       # NEW — bands, band_members, bookings.band_id
│   ├── domain/
│   │   └── bands/
│   │       ├── bandService.ts              # create/get/list/patch/archive; roster + one-lead invariant
│   │       └── bookBand.ts                 # book-as-unit: loop roster, skip already-booked, reuse createBooking
│   │       └── publicDisplay.ts            # grouping helper: event bookings → band blocks + ad-hoc (for 007)
│   └── validation/bands.ts                 # Zod: bandCreate/bandPatch (roster + exactly-one-lead), bookBand
└── (reuses performers/bookings from 003; resolveParameterCents "musician" rate from 009)
```

**Structure Decision**: Continue the single Next.js project. Bands get their own `domain/bands/`
module (matching how each feature area already has one). The book-as-unit orchestrator lives beside
band logic but **calls the existing `createBooking`** once per member so it inherits feature 003's
per-type pay/check rules and feature 009's `musician`-rate default with zero duplication — the only
new booking-time logic is the "skip a member already booked on this event" filter (FR-003c). The
public-display grouping helper (`publicDisplay.ts`) is a read-only function 007 will consume; no
public route is created here.

## Complexity Tracking

> No constitution violations — section intentionally empty.
