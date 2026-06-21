# Quickstart & Validation: Performers & Bookings

End-to-end validation guide. Implementation details live in `tasks.md`. Builds on features 001/002.

## Prerequisites

- Features 001 + 002 applied (contacts, events/series); Postgres running
- `pnpm install`; `.env` with `DATABASE_URL` / `TEST_DATABASE_URL`

## Setup

```bash
pnpm db:migrate     # applies 0005_performers.sql (performers, bookings, rate_parameters, rate_parameter_audit)
pnpm db:seed        # optional; seeds a couple of performers + standard rates
```

## Run

```bash
pnpm dev
# /performers — performer directory + bio/photo
# /bookings   — book performers onto an event
```

## Validation scenarios

Map to acceptance scenarios in [spec.md](spec.md); contracts in [contracts/api.md](contracts/api.md).

1. **Type rules** (US1): book one of each type to an event; Caller/Lead Musician → paid + check +
   full bio; Open Band → unpaid, no check, "Open Band"; Sound Tech → paid + check, hidden; Instructor
   → free, no check, name+note. (FR-001/002/003/005)
2. **Sound Tech blocked on Community Dance** (US1): booking a Sound Tech on a `community_dance` event →
   422 `SOUND_TECH_NOT_ALLOWED`. (FR-004)
3. **Donated $0** (US2): book a Caller with `isDonated:true`; `pay=0`, `requiresCheck=false`,
   appears in appearance history, excluded from YTD earnings. (FR-006/010)
4. **Effective-dated rate + override** (US3): set a caller rate effective 2026-01-01 and another
   2026-06-01; a booking on 2026-06-18 defaults to the June rate; supplying `pay` overrides it and sets
   `is_overridden`. (FR-007/008)
5. **Performer total** (US1): `GET /api/events/:id/bookings` returns `performerTotal` = Σ of booking
   pays shown in the drill-down. (FR-009/SC-004)
6. **Rate audit** (US3): creating a rate parameter writes an audit entry (who/what/when/effective-date). (FR-011)

## Test commands

```bash
pnpm test:unit          # performer rule table + rate resolution (pure)
pnpm test:integration   # bookings, rules, donations, rates — real Postgres
pnpm typecheck && pnpm lint
```

Expected: all green; no check ever generated for Open Band / Instructor / $0 bookings; pay math exact.
