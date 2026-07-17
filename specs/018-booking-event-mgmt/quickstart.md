# Quickstart / Validation Guide: Booking & Event Management (Booker)

End-to-end validation that P3-4 works. See [data-model.md](data-model.md) and [contracts/](contracts) for
field-level detail — this is the run/verify path, not an implementation spec.

## Prerequisites

```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 24 >/dev/null 2>&1   # ALWAYS first
pnpm run db:migrate            # applies 0023_booking_event_mgmt.sql (additive)
pnpm test                      # full suite green (new tests included)
pnpm exec tsc --noEmit         # typecheck
pnpm run lint                  # eslint + markdownlint
```

Roles needed (grant via `/access` as President/VP, or `auth:bootstrap`):

- a **Booker** scoped to a test series (e.g. `tnc`) — programmes events/bookings.
- a **Webmaster** — sets the advertised price; must be refused the event date.

Dev server for manual checks: `preview_start {name:"dev"}` (port 3000).

## Automated validation (the primary proof — constitution: test-first)

The suite must cover, at minimum:

1. **B23** — a new booking is `proposed`; `patchBooking` advances proposed → requested → confirmed and
   rejects a skip; any non-terminal → declined; re-pointing to a new performer resets to `proposed`.
2. **B24** — `GET /api/bookings/report` returns the right events for each filter (series, date range,
   caller, band, individual musician) and each row carries booking status; combined filters compose.
3. **B25 reschedule** — the event PATCH with `eventDate` moves the event; a **Webmaster** submitting
   `eventDate` is refused (403 `FIELD_NOT_PERMITTED`); a **Booker** (own series) succeeds.
4. **B25 cancel** — setting `status: cancelled` retains the event and it shows **marked cancelled** on the
   public schedule; revive sets it back.
5. **B25 delete guardrail** — `DELETE` on an event with a door record / attendance / a booking with a check
   number is refused
   (409); `DELETE` on an empty event succeeds (204).
6. **B26** — `POST /api/events/recurring` with first/last/everyNWeeks generates the expected count of
   independent events; editing/cancelling one leaves siblings untouched; an empty range creates nothing; a
   run over 60 is refused (422).
7. **B22** — `PATCH /api/venues/[id]` sets and clears `landlordContactId`; deleting the landlord contact
   nulls the link.
8. **B27** — setting `advertisedPriceCents` (as Booker or Webmaster) shows the price on `/whats-on` and does
   **not** change the treasurer/organizer figures for that event.
9. **Public exposure (FR-022)** — `/whats-on` shows **only `confirmed`** bookings (a proposed/requested/
   declined performer does not appear) and never exposes performer pay; the staff cross-event report still
   shows all statuses. Migration backfills existing bookings to `confirmed`, so current events keep their
   public performers.

## Manual walkthrough (optional, via the browser preview)

As the **Booker** (own series):

1. On `/bookings`, create a booking (proposed), request it, confirm it; decline another and re-point it to a
   new performer.
2. Open `/bookings-report`, filter by an individual musician and by series + date range.
3. On `/events`, reschedule an event, cancel one (see it marked cancelled on `/whats-on`), delete an empty
   one, and try to delete one with a door record (refused → cancel).
4. Generate a season of Thursday events with a start time; edit one and confirm the rest are unchanged.
5. On `/venues`, set a venue's landlord to an existing contact.
6. Set an event's advertised price; confirm it shows on `/whats-on`.

As the **Webmaster**: set an advertised price (allowed); try to change an event's date (refused).

## Expected outcomes (maps to Success Criteria)

- SC-001: a booking flows proposed → requested → confirmed or to declined, visible on `/bookings`.
- SC-002: the report returns exactly the matching events for any filter combination, with status.
- SC-003: an event can be rescheduled, cancelled (marked on `/whats-on`), and deleted — new capabilities.
- SC-004: a recurrence produces the right count of independent events; editing one leaves the rest untouched.
- SC-005: a venue names/clears a landlord; an event shows a public price with no accounting effect.
- SC-006: no public viewer sees booking status; the price is settable only by Booker (own series) or
  Webmaster and never affects accounting.

## Rollback

Migration `0023` is additive (two enums + four columns/links). No destructive change; an optional snapshot
before applying: `pg_dump -Fc "$DATABASE_URL" -f ~/zak1_pre_0023.dump`.
