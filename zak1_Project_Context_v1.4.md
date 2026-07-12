# zak1 — Project Context for Session Transfer (v1.4)

**Snapshot date:** 2026-07-12 · **Repo:** `/Users/rcd/Repositories/zak1` · **Remote:** `github.com/DempseyCDR/zak1`
**Head:** `403befa` (feature 014), `main` = `origin/main`, working tree clean.
**Purpose:** Seed a fresh session with everything needed to continue work on the zak1 (CDR) platform.
This file distills project state as of the completion of **Phase 2**.

---

## 1. What this project is

**zak1** is "Build 1" of a single-tenant management platform for **CDR** (a contra/dance club). It handles
contacts & membership, door attendance & gate money, performer bookings, treasurer & organizer financial
reports, mailing-list exports, and a public-facing website. The original requirements split into 7 SpecKit
features; that grew to **14 shipped features** (001–014). Everything is implemented, tested, committed, and
pushed to `origin/main`.

Money is always **integer cents**. Single club, single tenant (multi-tenant is explicitly deferred).

---

## 2. Tech stack & runtime

| Area | Choice |
|---|---|
| Language | TypeScript 5.x (strictest flags) |
| Framework | Next.js 15 (App Router, RSC) |
| DB | PostgreSQL 16 (local Homebrew `postgresql@16`, LaunchAgent auto-start) |
| ORM | Drizzle (schema in `src/server/db/schema/`) |
| Validation | Zod at every API boundary → typed domain objects |
| Logging | pino (structured); `writeAudit` for audit rows |
| Tests | Vitest against **real Postgres** (no DB mocking — constitution requires it) |
| Runtime | **Node 24** (Active LTS) — `.nvmrc`=24, `engines.node>=24.0.0` |
| Package manager | **pnpm** (`packageManager: pnpm@11.10.0`) — NOT npm |

### ⚠️ Critical shell gotcha (read before running anything)

The Bash tool's shell defaults to **Node 18** (inherited PATH). **Every** command that runs `node`/`pnpm`
must prefix:

```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 24 >/dev/null 2>&1
```

For direct `psql`/`pg_dump` commands, source the env first: `set -a; . ./.env; set +a`.
(drizzle-kit uses a `workspace:` protocol only pnpm resolves — do not fall back to npm.)

---

## 3. Databases

Three Postgres databases on `localhost:5432`:

- **`zak1_dev`** (`DATABASE_URL`) — dev/demo data. **Persists on disk** across restarts/reboots.
  Currently holds the user's real demo data: **~1309 contacts**, 4 events, 1 door record.
- **`zak1_test`** (`TEST_DATABASE_URL`) — test DB. Auto-migrated by `ensureSchema`; `resetDb` TRUNCATEs.
  Tests never touch dev/demo data.
- (**`zak1_demo`**) — not currently used; a possible bulletproof option (see demo note below).

**Migrations** are hand-authored SQL in `src/server/db/migrations/` (runner `src/server/db/migrate.ts`),
applied additively via `pnpm run db:migrate`. **19 migrations**, latest `0019_door_comp_count.sql`.
Migrations are safe/additive; a fresh feature adds the next-numbered file.

**Seed:** `pnpm run db:seed` **TRUNCATEs all of `zak1_dev`** and reloads fixtures — it is the ONE command
that wipes demo data. Do NOT run it before/between demos.

### Demo persistence (user demos the app to prospects repeatedly)

- `zak1_dev` persists automatically; nothing special needed for restarts.
- **Snapshot exists:** `~/zak1_demo.dump` (custom-format `pg_dump`, created 2026-07-09, on the 0019 schema
  incl. `comp_count`). Reset-to-baseline:
  - Save: `pg_dump -Fc "$DATABASE_URL" -f ~/zak1_demo.dump`
  - Restore: `pg_restore --clean --if-exists --no-owner -d zak1_dev ~/zak1_demo.dump`
- `.env` loading is runtime-agnostic via `src/server/lib/loadEnv.ts` (used by tests + migrate), so those
  no longer need `.env` sourced; direct `psql` still does.

---

## 4. SpecKit workflow & governance

Features are built through the SpecKit pipeline, one feature at a time:

**`/speckit-specify` → `/speckit-clarify` (optional) → `/speckit-plan` → `/speckit-tasks` →
`/speckit-analyze` (optional) → `/speckit-implement`**

- **Active feature pointer:** `.specify/feature.json` → `{"feature_directory": "specs/NNN-short-name"}`.
  Currently `specs/014-door-comp-count`.
- **Numbering:** sequential 3-digit prefix; scan `specs/` for the next number.
- **Hooks:** `.specify/extensions.yml` has only optional `after_specify` / `after_plan` agent-context
  hooks (refresh the SpecKit block in `CLAUDE.md`). No `before_*`, `after_tasks`, `after_analyze`, or
  `after_implement` hooks.
- **Constitution** (`.specify/memory/constitution.md`, v1.1.0), NON-NEGOTIABLE:
  - **I. Test-First** — write failing tests before implementation (Red-Green-Refactor).
  - **II. Simplicity/YAGNI** — no speculative abstraction; helper only when needed in 3+ places.
  - **III. Type Safety** — strictest flags; no undocumented `any`/`as`; validate boundaries with Zod.
  - **IV. Observability** — structured logs + audit rows; no ad-hoc console in production paths.
- Each feature dir contains: `spec.md`, `plan.md`, `tasks.md`, `research.md`, `data-model.md`,
  `contracts/`, `quickstart.md`, `checklists/requirements.md`.

**TDD in practice:** integration tests run against real `zak1_test` (helpers in
`tests/integration/helpers/` — `db.ts` (`ensureSchema`/`resetDb`/`db`), `factories.ts`
(`makeEvent`/`makeDoorRecord`/`makePerformer`/`makeContactWithEmail`), `http.ts`). Confirm tests **fail
for the right reason** before implementing.

**Full suite currently: 220 tests / 101 files green.** Typecheck (`pnpm exec tsc --noEmit`) and lint
(`pnpm exec eslint …`) clean.

---

## 5. Repo layout (key paths)

```
src/
  app/
    (admin)/      events admin, etc.
    (door)/       gate/ (gate-money entry), checkin/ (attendance)
    (public)/     whats-on/ (public schedule + [eventId] detail)
    api/          route.ts handlers (events, door-records, bookings, attendance, …)
    dev/routes/   TEMPORARY route index (see convention below)
  server/
    db/
      schema/     Drizzle tables (door.ts, events.ts, contacts.ts, …)
      migrations/ 0001…0019 hand-authored SQL
      migrate.ts, seed.ts, client.ts
    domain/       attendance bands bookings contacts dedup door events exports
                  gate membership organizer parameters performers public treasurer venues
    validation/   Zod schemas (door.ts, venues.ts, …)
    lib/          loadEnv.ts, money.ts, audit.ts, apiError.ts
tests/
  unit/           pure-function tests
  integration/    real-Postgres tests + helpers/
specs/            NNN-feature-name/ dirs + BACKLOG.md, PHASE2_REQUIREMENTS.md, DATA_MODEL.md
.specify/         feature.json, extensions.yml, memory/constitution.md, templates/, scripts/bash/
```

### Repo convention (from `CLAUDE.md`, temporary)

`src/app/dev/routes/page.tsx` is a review page listing every UI page + API endpoint. **Whenever you add
or remove a route** (`page.tsx` under `src/app` or `route.ts` under `src/app/api`), update its
`uiRoutes`/`apiRoutes` lists in the same change. (Field-only changes don't require an update.)

---

## 6. Domain model highlights (rules a new session will need)

**Organizer report** (`src/server/domain/organizer/`), per event:
- `payingDancers(attendance, performers, comps=0) = max(0, attendance − performers − 1 − comps)`
  — subtracts distinct performers, the single door attendant (−1), and comps (feature 014). Floored at 0.
- `avgTicketCents(admission, dancers)` = admission ÷ dancers (0 when no dancers).
- **Dance Net** = admission + merch − rent − performerTotal − ongoing − misc.
- Comps come from the event's door record, threaded via `EventGate.compCount`
  (`computeEventGate` in `domain/gate/eventMoney.ts` already loads the door row — no extra query).

**Gate/door money** (`domain/gate/eventMoney.ts`): admission is **derived**, never a stored line —
`cash admission = gross cash − seed float − Σ non-admission cash lines`; `card admission = card gross −
Σ non-admission card lines`. Gate SALES categories (money lines): merchandise, donation, future_event,
membership, gift_card, misc_sales.

**Rent (feature 011):** resolved per-event → series-at-venue → venue-default → 0 (`venue_rents` +
`events.rent_cents`; `resolveEventRentCents`). **Ongoing** = labeled sum of concurrent series charges
each ended by a $0 entry (`resolveOngoingTotalCents`).

**Series parameters (feature 009):** one `series_parameters` table (rate + expense, `series_id` NOT
NULL); `resolveParameterCents` resolver; a `general` series + `musician` rate kind exist.

**Contacts (feature 012):** required `first_name`, optional `last_name`, nullable
`display_name_override`, free-text `pronouns`; `display_name` is a maintained effective name
(override ?? "first last"). Dedup keys on structured first+last (`dedup_normalized`, override-immune);
search stays on display name. Event PATCH schema `assignVenueSchema` (`validation/venues.ts`) has been
progressively extended (venueId → rentCents → label/startTime/description).

---

## 7. Implementation status — features 001–014 (ALL done & pushed)

**Phase 1 (001–009):**
- **001** contacts & membership · **002** door attendance & gate · **003** performers & bookings ·
  **004** treasurer report & QBO (manual copy/paste) · **005** organizer report.
- **006** iContact export — 6 standing mailing-list CSVs + event-scoped contact-tracing export.
- **007** public website — **browse-only** (schedule + venue/map + public performer/band display).
  Added `venues` + `events.venue_id`. Online sales (US2) deferred.
- **008** band roster — reusable Band (`bands`/`band_members`), `bookBand` as a unit.
- **009** series parameters — consolidated rate + expense params (implements old BACKLOG B16).

**Phase 2 — COMPLETE (010–014 = P2-1…P2-5):**
- **010** (P2-1) — retired the Jane Austen Ball standing mailing list from the enum (6 lists remain);
  `event_groups.kind` is now nullable free text. Migration 0015.
- **011** (P2-2) — venue-scoped rent + multi-ongoing charges (see §6). Migration 0016.
- **012** (P2-3) — structured contact names/pronouns/override (see §6). Migration 0017.
- **013** (P2-4) — optional `events.label`, `start_time` (zoneless wall-clock, pure `formatWallClock`),
  `description`; surfaced on public schedule/detail, events admin, door picker. Migration 0018.
- **014** (P2-5) — **door comp count feeding paying dancers** (this session). `door_records.comp_count`
  (integer, default 0) = one combined count of people admitted free ("next dance free" + performers'
  guests); captured on the door PATCH + `/gate` reconciliation UI, distinct from
  `gift_card_redemption_count`. Report subtracts comps from paying dancers → Avg Ticket rises. Gift-card
  redeemers stay counted as paying. Migration 0019 (additive). Commit `403befa`.

---

## 8. Deferred work / backlog (`specs/BACKLOG.md`)

**Genuinely open backlog items:**
- **B1** group tickets (prereq for 007 online sales) · **B2** non-volunteer login · **B3** primary email ·
  **B4** cross-club directory · **B5** configurable fiscal quarters · **B6** separate Venmo fee ·
  **B7** iContact API · **B8** QBO API · **B9** native apps · **B10** automated email ·
  **B11** multi-tenant · **B17** incremental export · **B18** self-service create-series.
- **B21** (new, from feature 014) — **dormant `gift_card_redemption_count`**: it's a *count* field
  present in schema + `doorRecordPatchSchema` + `updateDoorRecord` since feature 002, but **no UI sets it
  and no report reads it** (only tests). Distinct from the `gift_card` gate-*sales* dollar line that IS on
  the gate page. Queued for **Phase 3** to decide: (a) add a no-effect FYI/reconciliation UI entry, or
  (b) drop the column. Feature 014 deliberately left it untouched (P2-5: gift-card redeemers stay paying).

**Closed:** B12→P2-4, B14→P2-5, B15→feat 008, B16→feat 009, B19→P2-2, B20→P2-3. (No B13 exists.)

**Notable deferral:** **007 US2 online sales** (PayPal advance tickets + memberships) — deferred by explicit
user decision; this is why the treasurer online-fee calculator stays dormant. Depends on B1.

---

## 9. Next: Phase 3

Phase 3 will **flesh out user roles + UI** (the current UI is functional-but-minimal; e.g. `/gate` is a
plain form). B21 is explicitly homed here. When starting Phase 3, expect to (a) define role/permission
model, (b) revisit the provisional dev route index convention, (c) resolve B21. No Phase 3 requirements
doc exists yet — it will likely be authored like `specs/PHASE2_REQUIREMENTS.md` was.

---

## 10. Operating conventions & constraints

- **Commits:** only when the user explicitly asks. Established pattern: one atomic commit per feature,
  committed **directly to `main`** (not feature branches/PRs), message `Implement feature NNN: <summary>`,
  trailer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **Push:** historically deferred; feature 014 was the first explicit push. Local `main` now = `origin/main`.
- **Auto-memory:** refresh after each feature ships. Memory lives at
  `~/.claude/projects/-Users-rcd-Repositories-zak1/memory/` (index `MEMORY.md`). Key files:
  `zak1-implementation-status.md`, `zak1-phase2-and-backlog.md`, `zak1-feature-breakdown.md`,
  `zak1-build1-stack.md`, `zak1-rateparam-expense-consolidation.md`, `zak1-004-followups.md`,
  `zak1-demo-db-persistence.md`.
- **Security:** never paste secrets/tokens into chat (git auth via macOS osxkeychain; no token needed).
- **Verification:** feature 014 was browser-verified via the preview tools (the `/gate` Comps input round-
  tripped `comp_count` to the DB). Use `preview_start {name:"dev"}` for the dev server; never run dev
  servers via Bash.

---

## 11. Quick command cheatsheet

```bash
# always prefix node/pnpm commands:
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 24 >/dev/null 2>&1

pnpm run db:migrate         # apply new migrations to zak1_dev (additive, safe)
pnpm test                   # full Vitest suite (real Postgres) — expect 220 green
pnpm exec vitest run <path> # run specific test file(s)
pnpm exec tsc --noEmit      # typecheck
pnpm exec eslint <files>    # lint
pnpm dev                    # dev server (prefer preview_start {name:"dev"})
pnpm run db:seed            # ⚠️ WIPES zak1_dev and reseeds — do NOT run before demos

# demo snapshot (direct psql/pg tools — source env first):
set -a; . ./.env; set +a
pg_dump -Fc "$DATABASE_URL" -f ~/zak1_demo.dump                          # save baseline
pg_restore --clean --if-exists --no-owner -d zak1_dev ~/zak1_demo.dump   # reset to baseline
```
