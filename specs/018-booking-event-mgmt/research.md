# Phase 0 Research: Booking & Event Management (Booker)

All spec-level unknowns were resolved in `/speckit-clarify` (Session 2026-07-17). This document records the
**design decisions** that follow, grounded in the existing code. No open `NEEDS CLARIFICATION` remains.

## R1 — Booking status is an enum column; re-point resets to proposed (B23)

**Decision**: Add `booking_status` enum (`proposed` | `requested` | `confirmed` | `declined`) and
`bookings.status NOT NULL DEFAULT 'proposed'`. `createBooking` and `bookBand` leave the default. Extend
`patchBooking` to (a) transition the status and (b) **re-point** the slot by accepting a new `performerId`,
which resets the status to `proposed` for the new performer.

**Transition rules** (validated in-service): `proposed → requested → confirmed`; any non-terminal status
`→ declined`; `declined → proposed` (revive) and re-point (`performerId` change) `→ proposed`. Illegal jumps
(e.g. `proposed → confirmed` skipping `requested`) are rejected. The optional `bookings.note` continues to
hold free-text context ("Katy said no").

**Rationale**: A single enum column is the minimum that expresses the lifecycle; the existing `patchBooking`
already owns pay/donated/note edits under `booking.write` scope, so status and re-point belong there.
Re-pointing on the same row is what the Booker asked for (backlog B23) and deliberately loses structured
decline history — only the note preserves it (accepted).

**Alternatives considered**: a separate `booking_status_history` table (rejected — YAGNI; the note suffices,
per the spec assumption); delete-and-recreate on re-point (rejected — loses the slot's identity and any
check number already recorded).

## R2 — Event cancel is an enum state; delete is a guarded DELETE (B25)

**Decision**: Add `event_status` enum (`scheduled` | `cancelled`) + `events.status NOT NULL DEFAULT
'scheduled'`. **Cancel** = set `cancelled` (a retained state; reversible by setting `scheduled`), surfaced on
`/whats-on`. **Delete** = a new `DELETE /api/events/[id]` (`event.write`, scoped) that **refuses with 409**
when the event has **a door record, attendance rows, or any booking with a check number**
(`check_number IS NOT NULL` = an actual recorded payment — **not** merely a non-zero booked rate, which
nearly every booking has); otherwise it hard-deletes the event and its dependent rows.

**Rationale**: An enum status (not a boolean) leaves room for future states and reads clearly in the public
model. The delete guardrail (clarification) protects accounting/attendance history — delete is for a
genuine mistake (an empty event), cancel is for a real event that will not happen. The three "history"
signals are cheap existence checks.

**Alternatives considered**: soft-delete-only (rejected — the Booker explicitly wants hard delete for
mistakes); a boolean `cancelled` (rejected — an enum is the same cost and more expressive).

## R3 — Reschedule and advertised price reuse the field-level auth on the event PATCH (B25/B27)

**Decision**: Extend the event PATCH (`/api/events/[id]`) rather than add endpoints. The existing
`EVENT_FIELDS` map + `assertFields` already refuses a write touching a field the actor may not own. Add:

| Field | Capability | Who |
|---|---|---|
| `eventDate` (reschedule) | `event.write` | Booker (scoped) |
| `status` (cancel/revive) | `event.write` | Booker (scoped) |
| `advertisedPriceCents` | `event.public.write` | Webmaster (global) **and** Booker (scoped) |

**Rationale**: This is exactly the mechanism the PATCH was built for ("an event is written by TWO roles for
different reasons"). A Webmaster submitting `eventDate` is refused by `assertFields` before any write, just
like a Booker submitting a public field they don't own is today. The clarification put the advertised price
under `event.public.write`, which both roles already hold — so **no new capability** is added.

**Rescheduled event keeps its identity**: changing `eventDate` on the same row carries bookings, door
record, and history with it (not delete-and-recreate).

## R4 — Recurrence is a one-shot generator of independent rows, capped (B26)

**Decision**: New `generateRecurringEvents(db, { seriesKey, firstDate, everyNWeeks=1, lastDate, startTime,
… }, actor, authz)` + `POST /api/events/recurring` (`event.write`, scoped to the series). It computes dates
from `firstDate` stepping `everyNWeeks × 7` days through `lastDate`, inserts one independent event per date,
and **refuses (422)** if the computed count exceeds **60**; an empty range creates nothing.

**Rationale**: The club's need is weekly/biweekly dances on a fixed weekday (tnc Thursdays, ecd Sundays); an
every-N-weeks step covers it. Independent rows (not a stored recurrence rule) means each event is edited/
cancelled without touching siblings — matching FR-013 and avoiding a live-expansion engine (YAGNI). The cap
prevents a fat-fingered range from creating thousands of rows.

**Alternatives considered**: arbitrary day interval (rejected in clarify — YAGNI); a persisted recurrence
rule with live expansion (rejected — the spec explicitly wants plain independent rows); no cap (rejected —
runaway risk).

## R5 — Cross-event bookings report is a new read model, `base`-gated (B24)

**Decision**: New `assembleBookingsReport(db, filters)` + `GET /api/bookings/report` returning per-event rows
(date · caller · band if named · musicians · sound tech · each booking's status), filterable by caller,
band, individual musician, series, and date range (past + future). Read requirement: **`base`**.

**Rationale**: Under the feature-016 read model, reads are universal except contact PII (there is no
`booking.read` capability, by design — a read gate here would contradict that model). Booking status and pay
are not PII, so any authenticated volunteer may read the report — **confirmed by Rich 2026-07-17: "staff
may see the booking report."** The public never sees status or pay (FR-021). So "non-Booker viewer" in the
spec is the **public/unauthenticated** viewer, not other staff.

**Alternatives considered**: gating the report on `booking.write` (rejected — introduces a read restriction
the 016 model deliberately avoids; would also block a Treasurer/Organizer from a legitimate read).

## R8 — Public pages show only confirmed bookings; migration backfills existing to confirmed (B23/FR-022)

**Decision**: The public read model (`getPublicSchedule` / `getPublicEventDetail` and the band/performer
display) MUST filter bookings to **`status = 'confirmed'`** — proposed/requested/declined performers do not
appear on `/whats-on`. Migration `0023` **backfills every pre-existing booking to `confirmed`** (via an
`UPDATE` after adding the column), while the column default stays `proposed` for **new** bookings.

**Rationale**: The public should only advertise talent that is actually locked in (Rich, 2026-07-17).
Without the backfill, adding `status DEFAULT 'proposed'` would mark all existing bookings proposed and the
public schedule would suddenly show **no performers** for current events — a regression. Pre-lifecycle
bookings were treated as final, so `confirmed` is the correct backfill. Internal reports (treasurer/
organizer, and the B24 cross-event report) are **unaffected** — they count/show bookings regardless of
status; only the public display filters.

**Alternatives considered**: leave existing bookings `proposed` and let the Booker confirm each (rejected —
mass manual work and an immediate public regression); filter internal reports by confirmed too (rejected —
a proposed booking still represents a planned cost/plan the Booker needs to see).

## R6 — Venue landlord is a single nullable FK (B22)

**Decision**: Add nullable `venues.landlord_contact_id` → `contacts(id)` (`ON DELETE SET NULL`). Extend
`patchVenue` to set/clear it (`venue.write`, Booker scoped); show the landlord's name on the venue page,
chosen via the existing contact search picker (B39 convention).

**Rationale**: One optional link reuses the contact directory (not free text) and degrades gracefully if the
contact is removed (`SET NULL`) or merged. Single landlord is the clarified default; a venue-contacts join
table is deferred until multiple landlords are actually needed.

## R7 — Advertised price is display-only money, independent of accounting (B27)

**Decision**: Add nullable `events.advertised_price_cents integer`. Surface it on `/whats-on` (schedule +
detail). It is **never** read by the treasurer/organizer report or the gate — those keep deriving
admission from the door record. It is independent of `charges_admission` (an event may charge admission
with or without a displayed price).

**Rationale**: Integer cents matches every money field; keeping it out of every accounting path guarantees
FR-018 (display-only). The POS device owns point-of-sale price overrides (out of scope).

## Summary of new/changed persistence

| Change | Table | Why |
|---|---|---|
| `booking_status` enum + `bookings.status` (default `proposed`) | `bookings` | B23 lifecycle |
| `event_status` enum + `events.status` (default `scheduled`) | `events` | B25 cancel state |
| `events.advertised_price_cents` (nullable int) | `events` | B27 public price |
| `venues.landlord_contact_id` (nullable FK → contacts, SET NULL) | `venues` | B22 landlord |

Migration `0023_booking_event_mgmt.sql` — additive (two enums + four columns), no drops, safe defaults so
existing rows and every report are unchanged until the new write paths set them.
