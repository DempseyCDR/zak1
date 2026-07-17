# Implementation Plan: Booking & Event Management (Booker)

**Branch**: `main` (repo convention: one atomic commit per feature) | **Date**: 2026-07-17 |
**Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/018-booking-event-mgmt/spec.md`

## Summary

Round out the Booker's toolkit (Phase 3 package P3-4), bundling six backlog items. Internal order
**B23 → B24** (the report shows status); the rest are independent. The work is mostly **net-new behaviour on
existing substrate**: bookings gain a status lifecycle; events gain a cancelled state, an editable date, and
a public advertised price; a recurrence generator bulk-creates independent events; venues gain a landlord
contact; and a new cross-event bookings report spans events.

The key architectural fit, confirmed by reading the code: the event PATCH **already** enforces field-level
authorization via `assertFields(actor, EVENT_FIELDS, …)`, mapping each field to the capability that owns it
(`label`/`startTime`/`description` → `event.public.write`; `venueId`/`rentCents` → `event.write`). So the
two new event fields slot straight in — **`eventDate` → `event.write`** (Booker reschedule) and
**`advertisedPriceCents` → `event.public.write`** (both Webmaster global and Booker scoped, per the
clarification). No new authorization mechanism is invented.

Approach per item:

- **B23** — add a `booking_status` enum + `bookings.status` column (default `proposed`); `createBooking`/
  `bookBand` default it; extend `patchBooking` to transition status and to **re-point** a slot (change
  `performerId` → reset to `proposed`). Status controls on `/bookings`.
- **B24** — a new read-across-events report service + `GET /api/bookings/report` with filters (caller / band
  / musician / series / date range), returning per-event rows with each booking's status. Read-gated `base`
  (any volunteer, per the feature-016 read model); the public site never shows status.
- **B25** — add an `event_status` enum (`scheduled` | `cancelled`) + `events.status`; **cancel** = set
  `cancelled` (retained, shown on `/whats-on`); **reschedule** = `eventDate` in the event PATCH; **delete** =
  a new `DELETE /api/events/[id]` that **refuses** (409) when the event has a door record, attendance rows,
  or bookings with recorded payments.
- **B26** — a recurrence generator service + `POST /api/events/recurring`: first date, every-N-weeks step
  (default 1), last date, series, start time → independent event rows; **capped at 60/run**.
- **B22** — add nullable `venues.landlord_contact_id` FK → `contacts`; extend `patchVenue`; show on the venue
  page.
- **B27** — add nullable `events.advertised_price_cents`; surface on `/whats-on`; display-only (no accounting
  effect).

## Technical Context

**Language/Version**: TypeScript 5.7 (strictest) · Node 24 (pnpm)

**Primary Dependencies**: Next.js 15.1.3 (App Router, RSC) · React 19 · Drizzle ORM · Zod · Vitest

**Storage**: PostgreSQL 16. New migration `0023_booking_event_mgmt.sql` — **additive**: two new enums
(`booking_status`, `event_status`), `bookings.status`, `events.status`, `events.advertised_price_cents`,
`venues.landlord_contact_id`. All columns `NOT NULL DEFAULT` (or nullable), no drops. One intentional
**backfill**: existing bookings are set to `confirmed` (pre-lifecycle bookings were final, so the
confirmed-only public display — FR-022 — doesn't regress); new bookings default `proposed`.

**Testing**: Vitest against real local Postgres (`zak1_test`); no DB mocking. New integration tests for
status transitions + re-point, the report filters, cancel/reschedule/delete (incl. the delete guardrail),
the recurrence generator (count, independence, cap, empty range), landlord set/clear, and price
display/non-accounting. Unit tests for status-transition rules and the recurrence date math.

**Target Platform**: Web app (single-tenant), same runtime as 001–017.

**Project Type**: Web application (Next.js App Router).

**Performance Goals**: Interactive admin use; the cross-event report over a club-sized dataset (dozens of
events/season, a few bookings each) returns well under a second. Recurrence caps at 60 rows/run.

**Constraints**: Booker actions scoped per series (feature 016); the advertised price is `event.public.write`
(both roles); the public site exposes only public-safe fields (cancelled marker + price, never status/pay/
PII). Money remains integer cents; the advertised price is display-only and feeds no accounting figure.

**Scale/Scope**: Six items; 1 migration (2 enums + 4 columns), ~4 domain services touched/added, ~4 new/
changed endpoints (event DELETE, recurring POST, bookings report GET, plus extended event/venue/booking
PATCH), the public read model extended, and three admin pages touched (`/bookings`, `/events`, `/venues`).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| **I. Test-First (NON-NEGOTIABLE)** | PASS (planned) | Each behaviour lands test-first: status transitions/re-point, report filters, cancel/reschedule/delete-guardrail, recurrence (count/independence/cap), landlord, price-non-accounting. |
| **II. Simplicity / YAGNI** | PASS | Recurrence generates plain rows (no live rule), capped; single landlord link; cancel is an enum state, not a workflow engine. Field-level auth is **reused**, not rebuilt. No speculative generality. |
| **III. Type Safety** | PASS | New Zod schemas + Drizzle enums (`booking_status`, `event_status`); no `any`. Server/client share types. |
| **IV. Observability** | PASS | Booking/event mutations audit via the existing `writeAudit`/`recordAudit` pattern; refusals (delete guardrail, over-cap recurrence, field auth) audited by `withAuth`/service errors. |
| **Testing standard** | PASS | Real local Postgres; no mocking; no third-party boundary here. |

**Authorization gate (feature 016):** every new write declares `withAuth({ requires })` and resolves scope
in-service (`assertEventScope`/`assertFields`), guarded by the self-maintaining `auth.routeInventory.test.ts`.
The event PATCH's `EVENT_FIELDS` map is **extended** (`eventDate` → `event.write`; `advertisedPriceCents` →
`event.public.write`) rather than replaced — a Webmaster setting the date is refused by `assertFields`
exactly as today. **No violation; no Complexity Tracking entry required.**

## Project Structure

### Documentation (this feature)

```text
specs/018-booking-event-mgmt/
├── plan.md              # This file
├── research.md          # Phase 0 — design decisions (status model, delete guardrail, report gating)
├── data-model.md        # Phase 1 — schema deltas + state machines
├── quickstart.md        # Phase 1 — end-to-end validation guide
├── contracts/           # Phase 1 — API contract deltas
│   ├── booking-lifecycle.md      # B23
│   ├── event-lifecycle.md        # B25 (reschedule/cancel/delete) + B27 (price)
│   ├── recurring-events.md       # B26
│   ├── bookings-report.md        # B24
│   └── venue-landlord.md         # B22
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
src/
  app/
    (admin)/bookings/page.tsx          # status controls + re-point (B23)
    (admin)/events/page.tsx            # reschedule, cancel/revive, delete, recurrence, advertised price
    (admin)/venues/page.tsx            # landlord contact picker (B22)
    (admin)/bookings-report/page.tsx   # NEW — cross-event report with filters (B24)
    (public)/whats-on/**               # show cancelled marker + advertised price (B25/B27)
    api/events/[id]/route.ts           # PATCH: +eventDate/+status/+advertisedPriceCents; NEW DELETE
    api/events/recurring/route.ts      # NEW POST — recurrence generator (B26)
    api/bookings/[id]/route.ts         # PATCH: +status, +re-point performerId (B23)
    api/bookings/report/route.ts       # NEW GET — cross-event report (B24)
    api/venues/[id]/route.ts           # PATCH: +landlordContactId (B22)
  server/
    db/schema/{bookings,events,venues,enums}.ts   # +status/+price/+landlord, +2 enums
    db/migrations/0023_booking_event_mgmt.sql     # NEW additive migration
    validation/performers.ts           # bookingPatchSchema: +status, +performerId (re-point)
    validation/venues.ts               # assignVenueSchema → +eventDate/+status/+advertisedPriceCents;
                                        #   venuePatchSchema: +landlordContactId; NEW recurringEventsSchema
    domain/bookings/bookingService.ts  # default status; transitions; re-point in patchBooking
    domain/bands/bookBand.ts           # default status on unit bookings
    domain/bookings/reportService.ts   # NEW — cross-event bookings report (B24)
    domain/events/eventService.ts      # reschedule (eventDate); cancel/status; deleteEvent (guarded);
                                        #   generateRecurringEvents (B26)
    domain/venues/venueService.ts      # landlord on patchVenue (B22)
    domain/public/publicSchedule.ts    # +cancelled marker, +advertisedPrice; filter to CONFIRMED bookings
    domain/bands/publicDisplay.ts       # confirmed-only performer/band display (FR-022)
tests/{unit,integration}/             # status/report/lifecycle/recurrence/landlord/price coverage
```

**Structure Decision**: Single Next.js App Router tree (features 001–017). New endpoints follow existing
conventions (`withAuth` + Zod + domain service + audit). One new admin page (`/bookings-report`) and one new
API collection (`/api/events/recurring`, `/api/bookings/report`).

## Complexity Tracking

> No Constitution Check violations. The design deliberately avoids the tempting over-builds: recurrence is a
> one-shot generator of plain rows (not a stored recurrence rule with live expansion), cancel is an enum
> state (not a status workflow engine), and the landlord is a single nullable FK (not a venue-contacts join
> table). The field-level authorization the two new event fields need already exists and is reused. No
> justification table required.
