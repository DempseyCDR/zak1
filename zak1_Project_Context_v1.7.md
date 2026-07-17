# zak1 — Project Context for Session Transfer (v1.7)

**Snapshot:** 2026-07-17 · **Repo:** `/Users/rcd/Repositories/zak1` · **Remote:**
`github.com/DempseyCDR/zak1` · working tree clean at commit time. **Supersedes v1.6.** Since then:
**feature 017 (check-in overhaul / P3-3) shipped** — the Door Attendant's `/checkin` workflow is
overhauled (B34, B33, B35, B36, B29; resolves B21). Purpose: seed a fresh session to continue work on zak1.

---

## 1. What this is

**zak1** = "Build 1" of a single-tenant management platform for **CDR** (Country Dancers of Rochester, a
contra/English dance club): contacts & membership, door attendance & gate money, performer bookings,
treasurer & organizer reports, mailing-list exports, a public website, staff auth, authorization, and now
an overhauled door check-in. **17 features shipped (001–017).** Money is always **integer cents**. Single
tenant (multi-tenant deferred).

> **Naming:** `zak1` is the internal codename; the club-facing name is **cdrochester**. No rename wanted.

## 2. Tech stack & runtime

| Area | Choice |
|---|---|
| Language | TypeScript 5.7 (strictest flags) |
| Framework | Next.js 15.1.3 (App Router, RSC) · React 19 |
| DB | PostgreSQL 16 (local Homebrew, LaunchAgent auto-start) |
| ORM | Drizzle (`src/server/db/schema/`) · hand-authored SQL migrations |
| Validation | Zod at every API boundary |
| Auth | `arctic` (Google OAuth2/OIDC) + `jose` (ID-token verify) — feature 015 |
| Tests | Vitest against **real Postgres** (no DB mocking — constitution) |
| Runtime | **Node 24** (`.nvmrc`, `engines`) · package manager **pnpm** (NOT npm) |

**⚠️ Shell gotcha:** the Bash tool defaults to Node 18. Prefix every `node`/`pnpm` command:
`export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 24 >/dev/null 2>&1`. For `psql`/`pg_dump`:
`set -a; . ./.env; set +a`.

**⚠️ CLI env (016):** `db:migrate`, `db:seed`, `auth:bootstrap` use `tsx --env-file-if-exists=.env`.
Don't revert.

## 3. Databases

- **`zak1_dev`** (`DATABASE_URL`) — dev/demo data, **persists on disk**. ~1335 contacts.
- **`zak1_test`** (`TEST_DATABASE_URL`) — auto-migrated; `resetDb()` TRUNCATEs.
- **Migrations:** additive SQL in `src/server/db/migrations/`, `pnpm run db:migrate`. **Latest =
  `0022_checkin_overhaul.sql`** — **additive** (attendance.children_count, attendance.is_open_band,
  door_records.open_band_count; no drops/backfill). Contrast 016's destructive `0021`.
- **`pnpm run db:seed` TRUNCATEs `zak1_dev`** — never run it.

## 4. SpecKit & governance

Pipeline `/speckit-specify → clarify → plan → tasks → analyze → implement`. Active pointer
`.specify/feature.json` → **`specs/017-checkin-overhaul`**. **Constitution v1.2.0** (non-negotiable):
I Test-First, II YAGNI, III Type Safety (Zod at boundaries), IV Observability. Testing: integration against
**real** local infra; DBs never mocked; Google exercised at its boundary (signed OIDC fixtures).
**Suite: 413 tests / 127 files green.** tsc, eslint, markdownlint, prettier clean. Production build clean.

**Commits:** one atomic commit per feature, direct to `main`, trailer
`Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Ask before pushing (routine).

## 5. Repo layout (key paths — 017 deltas marked)

```text
docs/use-cases.md            ★ authoritative role model + permission matrix (open-band note updated 017)
src/app/
  (door)/checkin/page.tsx    OVERHAULED (017) — last+display name, children count, open-band flag
                             (community_dance only), comp/gift capture, sortable checked-in roster
  (door)/gate/page.tsx       017 — gift-redemption input + read-only open_band_count for FS confirm
  api/events/[id]/attendance/route.ts       017 — GET ?sort=first|last
  api/events/[id]/checkin-counts/route.ts   NEW (017) — POST, requires attendance.write (B29)
src/server/
  domain/attendance/attendanceService.ts    017 — recordAttendance: displayNameOverride, childrenCount,
                                            open-band (community_dance + not-a-booked-performer checks,
                                            attendance_count + open_band_count); listEventAttendance sort
  domain/door/doorRecordService.ts          017 — recordCheckinCounts (attendance.write); openBandCount view
  domain/gate/eventMoney.ts                 017 — carries openBandCount
  domain/organizer/reportService.ts         017 — effectiveComps = comp_count + open_band_count
  db/schema/{attendance,door}.ts · migrations/0022
tests/{unit,integration}/    + checkin.family/counts/counts.boundary/openBand, contacts.deriveNames, and
                             extended attendance.list / door.attendance-new / organizer.report
```

## 6. Implementation status (001–017, all done & pushed)

Phase 1 (001–009) · Phase 2 (010–014) · **Phase 3: 015 staff auth (P3-1) · 016 authorization (P3-2) ·
017 check-in overhaul (P3-3).**

## 7. Feature 017 — check-in overhaul (the new thing)

Overhauls `/checkin` (Door Attendant), bundling five backlog items. **Load-bearing decisions:**

- **B34 new-contact capture** — first + last + **editable display name** (`display_name_override`); reuses
  `deriveContactNames` (012). Only the schema/service/UI gaps were closed.
- **B33 checked-in roster** — `listEventAttendance` now returns structured first/last (+children/open-band)
  and takes `?sort=first|last` (tiebreak on the other name, nulls last). Contact-tracing consumer only reads
  `count`, so it's backward-compatible.
- **B35 family check-in (all series)** — `attendance.children_count` on the **parent's row**; check-in
  increments `events.attendance_count` by `1 + children`. **Paying-dancer formula UNCHANGED** — children
  ride inside the persisted `attendance_count` and, being neither performers nor comps, are counted as
  paying automatically.
- **B29 comp/gift capture relocation (resolves B21)** — new `recordCheckinCounts` +
  `POST /api/events/[id]/checkin-counts` requiring **`attendance.write`** (NOT `gate.write`): the Door
  Attendant sets `comp_count`/`gift_card_redemption_count` on the door record without any money access
  (FR-018). The FS still edits the same two fields on `/gate` (`gate.write`, FR-015). This is the exact
  "door record's money vs. its counts, written by different roles" split the capabilities.ts catalog
  comment anticipated.
- **B36 open-band musician** — **manual** flag at check-in (FR-019; **never** sourced from
  bookings/performers). Accepted only on the `community_dance` series (FR-022) and **rejected for a booked
  performer** for that event (**FR-022a** — else the performer subtraction + comp would double-subtract).
  Counts as attending (`attendance_count +1`) and adds a comp via a **persisted `door_records.open_band_count`**.
  **Key design (clarify 2026-07-17):** the comp is recorded **per event on redemption** — NO cross-event
  counter, NO entitlement ledger (YAGNI). `open_band_count` is separate from `comp_count` so the FS's
  absolute comp edit never clobbers per-person increments and so it **survives the 90-day attendance purge**
  (the report reads persisted counters, not purge-eligible rows). Report:
  `effectiveComps = comp_count + open_band_count`.

**Why the stories were sequential, not parallel:** US1/US2/US3/US5 all edit
`attendanceService.ts`, `validation/attendance.ts`, and `checkin/page.tsx` — same files. Built in priority
order (also the spec's internal order B34→B33; B29 before B36).

## 8. Backlog (`specs/BACKLOG.md`) — Phase 3 remainder

**P3-4 booking** (Booker): B23 status lifecycle · B24 cross-event report · B25 cancel/delete/reschedule ·
B26 recurring · B22 landlord · B27 advertised price. **P3-5 payments/membership:** B28 performer-payment
override · B31 door membership · B30 online membership (PayPal hosted button + webhook). **B38**
self-service login-email change. **B39** entity pickers (UX convention, UI-spec phase). Deferred
pre-Phase-3: B1 group tickets · B2 non-volunteer login · 007 US2 online sales. **Done in 017:** B34, B33,
B35, B36, B29 (B21 resolved via B29).

## 9. Command cheatsheet

```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 24 >/dev/null 2>&1   # ALWAYS first
pnpm run db:migrate            # apply migrations (0022 already applied)
pnpm test                      # 413 green / 127 files
pnpm exec tsc --noEmit         # typecheck
pnpm run lint                  # eslint + markdownlint
pnpm exec prettier --check .   # formatting
pnpm build                     # production build (clean)
pnpm run auth:bootstrap -- --email a@b.org [--contact-id <uuid>] [--role super_user]
pnpm run db:seed               # ⚠️ WIPES zak1_dev — do NOT run
# verification: preview_start {name:"dev"} — port 3000; GOOGLE_REDIRECT_URI must match exactly
```

## 10. Google / demo setup (operational, unchanged from v1.6)

- OAuth client: Google Cloud project `729886755025` ("Maps Platform Project"), under the **cdrochester
  Workspace** — browse the console **as `rcd@cdrochester.org`**. Consent screen: **External**, app
  **cdrochester**, scopes `openid`+`email`. **Still in Testing** → only listed test users can sign in.
  Redirect URI (in `.env`): `http://localhost:3000/api/auth/google/callback`. `.env` is gitignored.

## 11. Demo data state (zak1_dev, 2026-07-17)

Migration 0022 applied. Grants: `rcd@cdrochester.org` = **Super-user** (CLI);
`dempsey.peggy@gmail.com` = **volunteer → President** (app UI). `db:seed` NOT run (would wipe). To exercise
017 in the demo, check in a family (parent + children) and, on a `community_dance` event, flag an open-band
musician; both surface on `/checkin` and the counts appear on `/gate` for the FS.
