# Quickstart & Validation: Door Attendance & Gate Capture

End-to-end validation guide. Implementation details live in `tasks.md`. Builds on the running
feature-001 app and database.

## Prerequisites

- Feature 001 applied (contacts, fuzzy search) and Postgres running
- `pnpm install`; `.env` with `DATABASE_URL` / `TEST_DATABASE_URL`

## Setup

```bash
pnpm db:migrate     # applies 0004_door.sql (series/events/door/gate/attendance/quarterly + contact review flag)
pnpm db:seed        # optional; seeds series TNC/ECD/Community Dance
```

## Run

```bash
pnpm dev
# /checkin  — volunteer check-in (search, match/new/unmatched)
# /gate     — gate-money entry for an event's door record
```

## Validation scenarios

Map to acceptance scenarios in [spec.md](spec.md); contracts in [contracts/api.md](contracts/api.md).

1. **Check-in match** (US1): `GET /api/attendance/search?q=` returns ranked candidates within 300 ms;
   `POST /api/events/:id/attendance { contactId }` records attendance against the event (no door
   record required). (FR-001/002/010)
2. **New contact at door** (US1): `POST /api/events/:id/attendance { newContact }` creates a contact
   flagged `needs_review` and records it; it appears in the admin review queue. (FR-003)
3. **Unmatched** (US1): `POST /api/events/:id/attendance { unmatched: true }` records attendance with
   no contact. (FR-004)
4. **Gate capture + fee hidden** (US2): `PUT /api/door-records/:id/gate-sales` stores all seven
   categories × {cash,card}; `PATCH /api/door-records/:id` computes the POS fee server-side and the
   response **omits** it. (FR-005/006/007)
5. **Deposit math** (US2): deposit = gross cash − seed float − cash paid out; payout without a reason →
   422 `CASH_PAYOUT_REASON_REQUIRED`. (FR-008)
6. **Separate + free events** (US2): a Community Dance the same evening gets its own event + door
   record; a free event (`chargesAdmission=false`) still accepts a door record, attendance, and
   donations while collecting no paid admission. (FR-009/010)
7. **Retention** (US3): run `node --env-file=.env --import tsx src/jobs/attendance-purge.ts`; rows
   >90 days are counted into `quarterly_attendance_counts` then deleted; quarterly counts persist; a
   second run changes nothing (idempotent). (FR-011)

## Test commands

```bash
pnpm test:unit          # fee/deposit/money math (pure)
pnpm test:integration   # door records, gate sales, check-in, purge — real Postgres
pnpm typecheck && pnpm lint
```

Expected: all green; money math exact to the cent; no door response exposes the POS fee.
