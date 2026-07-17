# zak1 — Project Context for Session Transfer (v1.6)

**Snapshot:** 2026-07-15 · **Repo:** `/Users/rcd/Repositories/zak1` · **Remote:**
`github.com/DempseyCDR/zak1` · **Head:** `f463b7d` = `origin/main` (pushed), working tree clean.
**Supersedes v1.5.** Since then: **feature 016 (authorization / P3-2) shipped** — the whole role ×
capability × scope model is now enforced. Purpose: seed a fresh session to continue work on zak1 (CDR).

---

## 1. What this is

**zak1** = "Build 1" of a single-tenant management platform for **CDR** (Country Dancers of Rochester, a
contra/English dance club): contacts & membership, door attendance & gate money, performer bookings,
treasurer & organizer reports, mailing-list exports, a public website, staff auth, and now authorization.
**16 features shipped (001–016).** Money is always **integer cents**. Single tenant (multi-tenant deferred).

> **Naming:** `zak1` is the internal codename; the club-facing name is **cdrochester** (what Google's
> consent screen shows). No rename wanted.

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

**⚠️ CLI env (016 fix):** `db:migrate`, `db:seed`, `auth:bootstrap` now use
`tsx --env-file-if-exists=.env` — `client.ts` reads env at module scope, so the old scripts failed on a
clean shell. Don't revert.

## 3. Databases

- **`zak1_dev`** (`DATABASE_URL`) — dev/demo data, **persists on disk**. ~1335 contacts.
- **`zak1_test`** (`TEST_DATABASE_URL`) — auto-migrated; `resetDb()` TRUNCATEs.
- **Migrations:** additive SQL in `src/server/db/migrations/`, `pnpm run db:migrate`. **Latest =
  `0021_role_authorization.sql`** — the project's **FIRST destructive migration** (dropped
  `contacts.volunteer_roles` + the `volunteer_role` enum). Snapshot: `~/zak1_pre_0021.dump`.
- **`pnpm run db:seed` TRUNCATEs `zak1_dev`** — never run it; it is not a migration rollback.

## 4. SpecKit & governance

Pipeline `/speckit-specify → clarify → plan → tasks → analyze → implement`. Active pointer
`.specify/feature.json` → **`specs/016-role-authorization`**. **Constitution v1.2.0** (non-negotiable):
I Test-First (Red-Green-Refactor), II YAGNI, III Type Safety (Zod at boundaries), IV Observability
(structured logs + audit rows). Testing standard: integration against **real** local infra; DBs never
mocked; third-party services (Google) exercised at their **boundary** (signed OIDC fixtures), never
production endpoints. **Suite: 392 tests / 122 files green.** tsc, eslint, markdownlint, prettier clean.

**Commits:** one atomic commit per feature, direct to `main`, trailer
`Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Ask before pushing (routine).

## 5. Repo layout (key paths)

```text
docs/use-cases.md            ★ authoritative role model + permission matrix (NOW ENFORCED)
docs/zak1_Help_Glossary.md   term → file index
src/app/
  (admin)/ (door)/           PROTECTED — layout.tsx: requireStaff() + <Nav/> (role-aware)
  (admin)/access/page.tsx    NEW (016) — President/VP: designate volunteers, grant roles (ContactPicker)
  (public)/ whats-on/        OPEN
  api/access/{grants,volunteers,volunteers/[id]/approve}/  NEW (016)
  api/**/route.ts            all declare withAuth({ requires })
  dev/routes/page.tsx        generated from source tree, Super-user only (016)
  Nav.tsx  ContactPicker.tsx NEW (016)
src/server/
  auth/                      capabilities.ts (catalog) · can.ts (evaluator) · actor.ts · fields.ts ·
                             pii.ts · nav.ts · withAuth.ts · session.ts · currentStaff.ts (015+016)
  domain/access/grantService.ts  NEW (016) — grant/revoke/designate/clear/approve
  lib/routeInventory.ts      NEW (016) — source-tree walker (shared: test + /dev/routes)
  lib/audit.ts               writeAudit (log-only, legacy) + recordAudit (writes audit_events)
  db/schema/{authz,audit,contacts}.ts · migrations/0021 · bootstrapOfficer.ts
tests/{unit,integration}/    + authz.*.test.ts (scope/boundaries/fields/pii/grants/nav/audit/schema/can)
```

## 6. Implementation status (001–016, all done & pushed)

Phase 1 (001–009): contacts/membership · door/gate · performers/bookings · treasurer report+QBO ·
organizer report · iContact export · public website (**browse-only**; online sales deferred) · band roster
· series parameters. Phase 2 (010–014): retired JAB list · venue-scoped rent · structured contact names ·
event label/time/description · door comp count. **Phase 3: 015 staff auth (P3-1) · 016 authorization
(P3-2).**

## 7. Feature 016 — authorization (the big new thing)

Turns `docs/use-cases.md` into enforced behavior. **Organizer is the BASE** (every authenticated
volunteer; read oversight, no write) + **ten additive grants**. **Load-bearing design & decisions — do
not undo without reading why:**

- **`role_grants` table.** Scope = **two nullable FKs** `series_id`/`group_id`, `CHECK num_nonnulls<=1`,
  **both NULL = club-wide**. `UNIQUE NULLS NOT DISTINCT` (load-bearing: every row has a NULL scope col, so
  a plain UNIQUE catches nothing). Series & group are **orthogonal** (a group spans series) — a group
  grant legitimately reaches an event in a series the holder lacks. **No uniqueness on role** — two people
  may hold President (FR-005c). `volunteer_roles` array dropped (can't carry scope).
- **Capability catalog in code** (`auth/capabilities.ts`): `role → capability → scoped|global`. The
  **three supersets are FLATTENED in** (Treasurer ⊇ FS, VP ⊇ President, Super-user ⊇ all) — the evaluator
  has no runtime hierarchy. `global` exists for FR-008 (MLM exports all series, manages own).
- **Two-layer enforcement (R5):** routes declare `withAuth({ requires })` — **mandatory, omission is a
  compile error**, guarded by the self-maintaining `auth.routeInventory.test.ts`. `requires` is a
  **capability OR `'base'`** (`'base'` = any volunteer, per FR-015; ~25 GET routes). Services call
  `assertScope(actor, cap, target)` where the target resolves. `assertFields` does field-level writes.
- **Read is one rule: everything EXCEPT contact PII** (email/phone). **All money is OPEN incl. individual
  performer pay** — the club holds that pay secrecy *enables performer exploitation*, so transparency is a
  value; **do not "fix" this.** PII rides implicitly on roles that need it (DA/VP/MLM/Secretary/Booker/
  Treasurer/FS); the bare base is excluded. **Lookup not bulk:** matching a dancer shows PII, the roster
  shows names only. Disclosures **audited per request with a count** (`pii.disclosed`), so a harvest is
  detectable though not blocked. Dedup's FR-017a bulk-PII exception is **vacuous today** (dedup shows no
  PII yet). Only two endpoints disclose PII: `GET /api/contacts/[id]`, `GET /api/attendance/search`.
- **Gate boundary is a WRITE boundary** (FR-020): Door Attendant may **read** `/gate` (money is open),
  never write it; FS owns money, scoped per series.
- **President / VP / Treasurer are mutually exclusive** (separation of authority from money); **Secretary
  exempt**. Enforced in `grantService` + the CLI (cross-row invariant, not a CHECK). **President-as-FS is
  permitted, warned, surfaced** on the annual review — sound *because* exclusivity guarantees the Treasurer
  is a different person, and the FS reports to the Treasurer. The two rules hold each other up.
- **VP ⊇ President** — role assignment is **President + VP** (rows 20/21). The "Delegated by" column is
  nomination, not authority; the **Treasurer does NOT** assign the FS.
- **Super-user is CLI-only** (`auth:bootstrap --role super_user`) — grantable from no screen, by nobody.
- **Designation = a nomination, not a gated authority.** `is_volunteer` grants only the base (read, no PII,
  no write). So it is **deliberately writable by `contact.write` holders** via `PATCH /api/contacts/[id]`
  **and** by President/VP via `/access`. **Keep `isVolunteer` in `contactPatchSchema`.**
- **Annual approval is ADVISORY** (FR-037) — `contacts.volunteer_approved_at/_by`; nothing on the session
  path reads them, so a lapsed approval never costs access. Clear-designation **cascades** grant-revocation
  in ONE transaction (never silently restored).
- **`audit_events` table** (R8): `recordAudit(db,…)` writes rows + logs; `writeAudit` stays log-only for 31
  legacy sites (free-text actors an FK can't take). Answers SC-014 in SQL.
- **`/dev/routes`** regenerated from the source tree (`lib/routeInventory.ts`), Super-user only; the
  hand-maintenance convention retired (CLAUDE.md updated).
- **Per-event (◍) scope dropped** — Door Attendant is club-wide, so ◍ had no users. Three granularities:
  ⬡ club-wide, ⬤ per-series, ⬢ per-event-group.

**Findings corrected during build (all verified):** (1) **nobody held `administrator`** — the migration
moved zero rows; first Super-user bootstrapped via CLI (cold start). (2) the plain UNIQUE caught nothing →
`NULLS NOT DISTINCT`. (3) `can()` denied every scoped grant asked with no target (layer 1's question) →
fixed. (4) `auth:bootstrap` broke on a clean shell (env at module scope) → `--env-file-if-exists`.

## 8. Backlog (`specs/BACKLOG.md`) — Phase 3 remainder

**P3-3 check-in overhaul** (next): B34 new-contact first+last+display · B33 checked-in roster (sort) · B35
family children count (**all series**, children **paying**) · B36 open-band comp'd into whole event group
(community_dance rule; needs event-group-aware comp model) · B29 comp/gift capture at check-in (resolves
B21; the door-record money-vs-comp field split waits for this). **P3-4 booking** (Booker): B23 status
lifecycle · B24 cross-event report · B25 cancel/delete/reschedule · B26 recurring · B22 landlord · B27
advertised price. **P3-5 payments/membership:** B28 performer-payment override · B31 door membership · B30
online membership (PayPal hosted button + webhook). **B38** self-service login-email change. **B39 NEW —
entity pickers, not id fields:** a general UX convention (never require a UUID; offer search) for the
UI-spec phase; a provisional `ContactPicker` was added to `/access`. Deferred pre-Phase-3: B1 group tickets
· B2 non-volunteer login · 007 US2 online sales.

## 9. Command cheatsheet

```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 24 >/dev/null 2>&1   # ALWAYS first
pnpm run db:migrate            # apply migrations (additive; 0021 already applied)
pnpm test                      # 392 green / 122 files
pnpm exec tsc --noEmit         # typecheck
pnpm run lint                  # eslint + markdownlint
pnpm exec prettier --check .   # formatting
pnpm run auth:bootstrap -- --email a@b.org [--contact-id <uuid>] [--role super_user]
pnpm run db:seed               # ⚠️ WIPES zak1_dev — do NOT run
# snapshot (source env first): pg_dump -Fc "$DATABASE_URL" -f ~/zak1_demo.dump
# verification: preview_start {name:"dev"} — port 3000; GOOGLE_REDIRECT_URI must match exactly
```

## 10. Google / demo setup (operational, not code)

- OAuth client lives in Google Cloud **project `729886755025`, named "Maps Platform Project"** (created
  for feature 007 maps; that's why "cdrochester" doesn't find it). Owned under the **cdrochester
  Workspace** — browse the console **as `rcd@cdrochester.org`**, not a personal gmail.
- Consent screen: **User Type External** (never Internal — would lock out short-term volunteers on personal
  accounts), app name **cdrochester**, scopes `openid`+`email` (non-sensitive → no verification review).
  **Still in Testing** → only listed **test users** can sign in (cap 100). **Publish before rollout.**
- ⚠️ Test users must be **real Google accounts** — a placeholder address (e.g. `peggytbd@gmail.com`) on the
  list still can't authenticate if it was never registered with Google.
- Redirect URI (in `.env`, confirmed correct): `http://localhost:3000/api/auth/google/callback`.
- **`.env` is gitignored** and holds the real Google client secret — never paste secrets into chat.

## 11. Demo data state (zak1_dev, 2026-07-15)

Migration 0021 applied. Grants created so far: `rcd@cdrochester.org` = **Super-user** (CLI bootstrap);
`dempsey.peggy@gmail.com` = **volunteer → President** (via the app UI, in-session). Verified end-to-end in
the browser as President: designate, grant, and contact search on `/access` all work.
