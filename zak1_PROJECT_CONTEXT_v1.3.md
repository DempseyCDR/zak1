# zak1 — Project Context & Handoff

_Snapshot for resuming work in a future session. Last updated: 2026-07-01._

## What this is

**zak1** is "build 1" of the **CDR (Country Dancers of Rochester) Dance Club Management
Platform** — a multi-build exploration driven by SpecKit workflows. The requirements
originate from `CDR_Project_Context_v1.2.md`, which was split into **7 SpecKit features**
(see the memory note _zak1-feature-breakdown_).

## Stack (chosen once in feature 001, reused throughout)

- **TypeScript / Next.js 15 (App Router) + React 19**, single-tenant
- **PostgreSQL 16** via **Drizzle ORM** + `postgres` driver
- **Zod** at all boundaries, **pino** structured logging, **node-cron** for jobs, **Vitest** tests
- **Money is stored as integer cents everywhere.** `centsToDollars` / `dollarsToCents` in `src/server/lib/money.ts`.
- Migrations are **hand-authored SQL** in `src/server/db/migrations/` applied by
  `src/server/db/migrate.ts` (each file in its own transaction; `ALTER TYPE ADD VALUE`
  works in-transaction on PG16).

## Constitution (`.specify/memory/constitution.md`, v1.1.0) — non-negotiable

1. **Test-First** — real Postgres, **no DB mocking**.
2. **Simplicity / YAGNI**.
3. **Type Safety** — strict TS, `noUncheckedIndexedAccess`, Zod at boundaries, no undocumented `any`/`as`.
4. **Observability** — pino, audit trails, no `console.log` in prod paths.

(TS/Node was intentionally removed from the constitution so each build can pick its own stack.)

## Feature status

| # | Name | Spec | Plan | Tasks | Implemented |
|---|------|------|------|-------|-------------|
| 001 | contacts-membership | ✅ | ✅ | ✅ | ✅ |
| 002 | door-attendance & gate capture | ✅ | ✅ | ✅ | ✅ |
| 003 | performers-bookings | ✅ | ✅ | ✅ | ✅ |
| 004 | treasurer-report & QBO hand-off | ✅ | ✅ | ✅ | ✅ |
| 005 | organizer-report & analytics | ✅ | ✅ | ✅ | ✅ |
| 006 | iContact export (7 CSV mailing lists) | ✅ | — | — | — |
| 007 | public website & online sales (PayPal, maps) | ✅ | — | — | — |

**Active SpecKit feature pointer** (`.specify/feature.json`): `specs/005-organizer-report`.

### Next step
Run the pipeline on **006** (recommended — smaller, self-contained CSV export on top of
001 contacts/consent; no new external deps) or **007** (larger — public UI + PayPal + maps):
`/speckit-plan` → `/speckit-tasks` → `/speckit-analyze` → `/speckit-implement`.
The plan step re-points `.specify/feature.json` to the chosen feature.

## Environment / how to run

Homebrew `postgresql@16` runs as a service; databases `zak1_dev` + `zak1_test`, peer auth as `rcd`.

```sh
eval "$(/opt/homebrew/bin/brew shellenv)"          # needed each shell
node --env-file=.env --import tsx src/server/db/migrate.ts   # run migrations
node --env-file=.env --import tsx src/server/db/seed.ts      # seed dev data
node_modules/.bin/tsc --noEmit                     # typecheck (clean)
node_modules/.bin/eslint .                          # lint (clean)
node_modules/.bin/vitest run                        # full suite (currently 105 tests / 54 files green)
```

- `.npmrc` has `verify-deps-before-run=false`; pnpm build-approval config lives in
  `pnpm-workspace.yaml` (no pnpm block in package.json).
- **Dev route index** (`src/app/dev/routes/page.tsx`) is a temporary page listing every UI
  page + API endpoint. **Convention (in CLAUDE.md): update it whenever a route is added/removed.**

## Migrations (`src/server/db/migrations/`)
`0001_init` · `0002_memberships` · `0003_dedup` · `0004_door` · `0005_performers` ·
`0006_treasurer` · `0007_gate_sales_redesign` · `0008_add_musician_type` · `0009_organizer`.

## Key domain concepts & decisions (hard-won; don't re-litigate)

### Money / gate (features 002/004/005)
- **Admission is DERIVED, never entered.**
  `admissionCash = grossCash − seedFloat − Σ(non-admission cash)`;
  `admissionCard = cardGross − Σ(non-admission card)`; `admission = sum`.
- **Deposit = gross cash − seed float − cash paid out.**
- Gate categories (`gate_category` enum): admission, merchandise, donation, future_event,
  membership, gift_card, misc_sales. Everything except admission is "Non-Dance Income."
- **Named-customer receipts**: donation, future_event, membership are recorded per-contact
  (named lines); other categories are anonymous.
- **"Card" is the preferred term** (not POS / PC) in UI + FRs.
- **Non-dance income (FR-010, feature 004)** is INCLUDED separately in the treasurer report.
- Shared module `src/server/domain/gate/eventMoney.ts` — `computeEventGate(db, eventId)` —
  is reused by both the treasurer (004) and organizer (005) reports.

### Attendance
- Attendance rows are **purged after 90 days**, but `events.attendance_count` is an
  incrementing counter that **persists** so historical dancer counts survive the purge (FR-014).

### Performers / bookings (feature 003)
- `performer_type` enum: caller, lead_musician, **musician**, open_band_musician, sound_tech, instructor.
- A `lead_musician` is a band's booking contact; a plain `musician` is a band member paid
  individually. Same person can be lead for one band, musician for another. Band = per-event
  bookings (roster deferred — see BACKLOG B15).
- **Every performer must have a Contact record** — `createPerformer` auto-creates one if none given (FR-015).
- Bookings support **remove** (`DELETE /api/bookings/[id]`, writes `booking.deleted` audit).

### Organizer report (feature 005)
- Report for a series; **the TNC report also includes same-evening Community Dance events** (FR-001).
- **Dance Net = admission + merchandise − rent − performer total − ongoing − misc**
  (note: organizer Dance Net INCLUDES merchandise; treasurer "dance income" is admissions only).
- **Paying dancers = max(0, attendance − performerCount − 1)** (the −1 is the door attendant).
- **Avg Ticket = admission ÷ paying dancers** — does NOT subtract card/door fees.
- **Break-even dancers** = ceil(−net / avgTicket) only when net < 0 and avgTicket > 0, else null.
- **Card/door fees** are fixed formulas (not effective-dated params) and roll into "misc" for Dance Net.
- **Rolling trend charts appear only when 12 ≤ weeks ≤ 53** (window capped at the most recent
  53 weeks; hidden below 12). Two panels (Dance Net, attendance) + 4-event rolling average.
- **Quarterly summary**: calendar quarters, count + averages + FYI pass-through totals, plus YTD and Last Year.
- **Series expense parameters** (rent / ongoing) are **effective-dated**; resolver picks the
  greatest effective_date ≤ event date.
- **SC-003 perf**: a full-year (≥53-week) report must build in < 2 s (asserted in tests).

## Where things live (src/)

- `server/lib/` — shared: money.ts, logger.ts, audit.ts, apiError.ts, withLogging.ts, parseBody.ts; `DbOrTx` type.
- `server/db/schema/` — one file per table + enums.ts + index.ts barrel.
- `server/domain/<area>/` — services (contacts, membership, door, gate, attendance,
  performers, bookings, treasurer, organizer).
- `server/validation/` — Zod schemas per area.
- `app/(admin)/<page>/page.tsx` — admin UI (contacts, dedup, events, checkin, gate,
  performers, bookings, rate-parameters, treasurer, qbo-mapping, **organizer**, **expense-parameters**).
- `app/api/.../route.ts` — route handlers wrapped in `withLogging<{params}>`.
- `app/dev/routes/page.tsx` — temporary route index (keep in sync).

## Testing patterns

- Route handlers are exercised **directly** + domain services against **real Postgres**.
- **UI pages are NOT auto-tested** (accepted project-wide, deferred as N2).
- Helpers in `tests/integration/helpers/`: `db.ts` (ensureSchema / resetDb / closeDb — resetDb
  TRUNCATEs feature tables incl. config tables that are re-seeded each test), `http.ts`
  (jsonReq / ctx), `factories.ts` (makeEvent, makePerformer, makeDoorRecord, …).

## Backlog & deferred

See `specs/BACKLOG.md` (B1 group tickets, B12 event attributes/venue, B14 comps, B15 band
roster, plus B2–B11). Notable deferred UX: door attendant recording **comps** (future phase).

## Conventions

- Commits end with: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- Push target: `https://github.com/DempseyCDR/zak1.git`, branch `main`.
- User often wants commits split into logical parts; asks explicitly when so.
- SpecKit pipeline: specify → plan → tasks → analyze → implement, per feature.

## Auto-memory (persists across sessions)

`/Users/rcd/.claude/projects/-Users-rcd-Repositories-zak1/memory/` —
MEMORY.md (index), zak1-feature-breakdown.md, zak1-build1-stack.md, zak1-004-followups.md
(the 004 check-number follow-up is now DONE — that note is effectively closed).
