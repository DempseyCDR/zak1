# zak1 — Project Context for Session Transfer (v1.8)

**Snapshot:** 2026-07-17 · **Repo:** `/Users/rcd/Repositories/zak1` · **Remote:**
`github.com/DempseyCDR/zak1`. **Supersedes v1.7.** Since then: **feature 018 (booking & event management /
P3-4) shipped** — the Booker's toolkit (B23, B24, B25, B26, B22, B27). Purpose: seed a fresh session to
continue work on zak1 (CDR).

---

## 1. What this is

**zak1** = "Build 1" of a single-tenant management platform for **CDR** (Country Dancers of Rochester, a
contra/English dance club): contacts & membership, door attendance & gate money, performer bookings,
treasurer & organizer reports, mailing-list exports, a public website, staff auth, authorization, an
overhauled check-in, and now full booking & event management. **18 features shipped (001–018).** Money is
always **integer cents**. Single tenant.

> **Naming:** `zak1` is the internal codename; the club-facing name is **cdrochester**.

## 2. Tech stack & runtime

| Area | Choice |
|---|---|
| Language | TypeScript 5.7 (strictest) |
| Framework | Next.js 16.2.10 (App Router, RSC, Turbopack) · React 19.2 |
| DB | PostgreSQL 16 (local Homebrew) |
| ORM | Drizzle · hand-authored SQL migrations |
| Validation | Zod at every API boundary |
| Auth | `arctic` (Google OIDC) + `jose` — feature 015 |
| Tests | Vitest against **real Postgres** (no DB mocking) |
| Runtime | **Node 24** (`.nvmrc`) · **pnpm** (NOT npm) |

**⚠️ Shell gotcha:** the Bash tool defaults to Node 18. Prefix every `node`/`pnpm`:
`export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 24 >/dev/null 2>&1`. For `psql`/`pg_dump`:
`set -a; . ./.env; set +a`.

**⚠️ Next 16 upgrade (2026-07-18):** bumped from 15.x to **16.2.10** (React already 19.2). Two fixes were
needed: (1) `dev/routes/page.tsx` must NOT pass a dynamic-segment path (`/organizer/[seriesKey]`) to
`<Link>` — App Router now hard-errors; dynamic paths render as plain text. (2) `.markdownlint-cli2.jsonc`
now ignores `.next/**` — the Turbopack build vendors deps under `.next/node_modules` whose READMEs the
`**/*.md` glob would otherwise lint. `pnpm run lint` uses `eslint` directly (not the removed `next lint`),
so it was unaffected. Full suite (450), tsc, build all green on 16.

## 3. Databases

- **`zak1_dev`** (`DATABASE_URL`) — dev/demo, persists on disk.
- **`zak1_test`** (`TEST_DATABASE_URL`) — auto-migrated; `resetDb()` TRUNCATEs.
- **Migrations:** additive SQL in `src/server/db/migrations/`, `pnpm run db:migrate`. **Latest =
  `0023_booking_event_mgmt.sql`** — two enums (`booking_status`, `event_status`), `bookings.status`,
  `events.status`/`.advertised_price_cents`, `venues.landlord_contact_id`; **one backfill**
  (`UPDATE bookings SET status='confirmed'` — see §7).
- **`pnpm run db:seed` TRUNCATEs `zak1_dev`** — never run it.

## 4. SpecKit & governance

Pipeline `/speckit-specify → clarify → plan → tasks → analyze → implement`. Active pointer
`.specify/feature.json` → **`specs/018-booking-event-mgmt`**. **Constitution v1.2.0** (non-negotiable):
I Test-First, II YAGNI, III Type Safety, IV Observability. Integration against **real** local Postgres; DBs
never mocked. **Suite: 450 tests / 137 files green.** tsc, eslint, markdownlint, prettier, production build
all clean.

**Commits:** one atomic commit per feature, direct to `main`, trailer
`Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Ask before pushing.

## 5. Repo layout (key paths — 018 deltas marked)

```text
docs/use-cases.md            ★ role model + permission matrix (Booker/Webmaster rows enforced by 018)
src/app/
  (admin)/bookings/page.tsx        018 — status controls (advance/decline/revive) + re-point
  (admin)/bookings-report/page.tsx NEW (018) — cross-event report w/ filters (B24)
  (admin)/events/page.tsx          018 — reschedule, cancel/revive, delete, recurrence, advertised price
  (admin)/venues/page.tsx          018 — landlord contact picker (B22)
  (public)/whats-on/**             018 — cancelled marker + advertised price; CONFIRMED bookings only
  api/events/[id]/route.ts         018 — PATCH +eventDate/+status/+advertisedPriceCents; NEW DELETE (guarded)
  api/events/recurring/route.ts    NEW (018) — POST, event.write (B26)
  api/bookings/[id]/route.ts       018 — PATCH +status +re-point
  api/bookings/report/route.ts     NEW (018) — GET, base (B24)
  api/venues/[id]/route.ts         018 — PATCH +landlordContactId
src/server/
  domain/bookings/{bookingService,bookingStatus,reportService}.ts
  domain/events/eventService.ts    018 — updateEventDetails(+date/status/price), deleteEvent (guarded),
                                   generateRecurringEvents + recurringDates
  domain/venues/venueService.ts    018 — landlord on patchVenue
  domain/public/publicSchedule.ts  018 — cancelled + advertisedPrice; domain/bands/publicDisplay.ts confirmed-only
  db/schema/{bookings,events,venues,enums}.ts · migrations/0023
```

## 6. Implementation status (001–018, done)

Phase 1 (001–009) · Phase 2 (010–014) · **Phase 3: 015 auth (P3-1) · 016 authorization (P3-2) · 017
check-in (P3-3) · 018 booking & event mgmt (P3-4).** Remaining: **P3-5** (performer payments & membership
acquisition: B28, B31, B30) + B38 (login-email change), B39 (entity pickers), B40 (contact email UI), B41
(client 401 redirect).

## 7. Feature 018 — booking & event management (the new thing)

**Load-bearing decisions:**

- **B23 booking status** — `booking_status` enum on `bookings.status` (default `proposed`). `patchBooking`
  validates transitions (`proposed→requested→confirmed`; any→`declined`; `declined→proposed`; skips
  rejected) and handles **re-point** (change `performerId` → reset to `proposed` **and clear `check_number`**
  so a paid performer's check never carries to a substitute).
- **Public shows only CONFIRMED bookings (FR-022)** — filtered in `groupEventBookingsForDisplay`; internal
  reports use all statuses. Migration **backfills existing bookings to `confirmed`** (they predate the
  lifecycle) so no current event lost its public performers. Performer pay is never public; the cross-event
  report is **staff-only** (`base`) and shows all statuses.
- **B25 event lifecycle** — `event_status` enum (`scheduled`|`cancelled`). Reschedule = `eventDate` on the
  event PATCH; cancel = `status` (retained, shown marked on `/whats-on`); **DELETE guarded** — refused (409
  `EVENT_HAS_HISTORY`) when the event has a door record, attendance, or a **booking with a check number**
  (a non-zero booked *rate* alone does NOT block — that was the analyze fix).
- **Field-level auth reused** — the event PATCH's `EVENT_FIELDS` map gained `eventDate`/`status` →
  `event.write` (Booker) and `advertisedPriceCents` → `event.public.write` (Webmaster + Booker). A Webmaster
  submitting the date is refused by `assertFields` (403 `FIELD_NOT_PERMITTED`). No new auth mechanism.
- **B26 recurrence** — `generateRecurringEvents` + `POST /api/events/recurring`: every-N-weeks (default 1)
  from first to last date, **independent rows**, capped at **60/run** (422 `RECURRENCE_TOO_LARGE`); empty
  range creates nothing. Pure `recurringDates` for the date math.
- **B22 landlord** — nullable `venues.landlord_contact_id` FK → contacts, `ON DELETE SET NULL`.
- **B27 advertised price** — nullable `events.advertised_price_cents`, public display-only (never an
  accounting input; not read by the treasurer/organizer reports/gate).

**Not file-parallel:** US1/US3/US6 shared `validation/venues.ts`/`EVENT_FIELDS`, `eventService.ts`,
`publicSchedule.ts`, `/events` page → built in priority order.

## 8. Backlog (`specs/BACKLOG.md`) — remainder

**P3-5:** B28 performer-payment override · B31 door membership · B30 online membership (PayPal hosted button
`Z5FUDMVGE6CVQ` + webhook). **B38** self-service login-email change. **B39** entity pickers (UI-spec).
**B40** contact email management UI (Phase 4). **B41** client-side 401 → /login redirect. Deferred: B1 group
tickets · B2 non-volunteer login · 007 US2 online sales. **Done in 018:** B22, B23, B24, B25, B26, B27.

## 9. Command cheatsheet

```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 24 >/dev/null 2>&1   # ALWAYS first
pnpm run db:migrate            # apply migrations (0023 already applied)
pnpm test                      # 450 green / 137 files
pnpm exec tsc --noEmit         # typecheck
pnpm run lint                  # eslint + markdownlint
pnpm exec prettier --check .   # formatting
pnpm build                     # production build (clean)
pnpm run auth:bootstrap -- --email a@b.org [--role super_user]
pnpm run db:seed               # ⚠️ WIPES zak1_dev — do NOT run
# verification: preview_start {name:"dev"} — port 3000
```

## 10. Google / demo setup (operational, unchanged from v1.6/1.7)

OAuth client: Google Cloud project `729886755025` under the **cdrochester Workspace** — browse as
`rcd@cdrochester.org`. Consent screen External, app **cdrochester**, scopes `openid`+`email`; still Testing.
Redirect URI (in `.env`): `http://localhost:3000/api/auth/google/callback`. `.env` gitignored.
**Sign-in gotcha:** `resolveSignIn` matches a Google email to an **active** email on a **volunteer** contact
(exact match). A domain typo (`@google.com` vs `@gmail.com`) yields `no_match` — fixed by correcting the
`contact_emails.email`. There is **no UI** to edit a contact's emails yet (B40).

## 11. Demo data state (zak1_dev, 2026-07-17)

Migration 0023 applied (existing bookings backfilled to `confirmed`). `db:seed` NOT run. To exercise 018:
on `/bookings` move a booking proposed→confirmed and re-point one; `/bookings-report` filter by musician;
`/events` reschedule/cancel/delete + generate a recurring run + set an advertised price; `/venues` set a
landlord. The public `/whats-on` shows only confirmed performers, cancelled markers, and advertised prices.
