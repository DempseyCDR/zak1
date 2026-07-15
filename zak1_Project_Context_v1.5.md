# zak1 — Project Context for Session Transfer (v1.5)

**Snapshot date:** 2026-07-15 · **Repo:** `/Users/rcd/Repositories/zak1` · **Remote:**
`github.com/DempseyCDR/zak1`
**Head:** `da7695d`, `main` = `origin/main`, working tree clean.
**Purpose:** Seed a fresh session with everything needed to continue work on the zak1 (CDR) platform.
**Supersedes v1.4** (snapshot at end of Phase 2). Since then: **Phase 3 started** — the role model was
designed, the constitution amended, and **feature 015 (staff authentication) shipped**.

---

## 1. What this project is

**zak1** is "Build 1" of a single-tenant management platform for **CDR** (Country Dancers of Rochester, a
contra/English dance club). It handles contacts & membership, door attendance & gate money, performer
bookings, treasurer & organizer financial reports, mailing-list exports, and a public website.
**15 features shipped** (001–015), all committed and pushed to `origin/main`.

Money is always **integer cents**. Single club, single tenant (multi-tenant explicitly deferred).

> **Naming:** `zak1` is the internal build codename. The club-facing name is **cdrochester** (that is what
> appears on the Google consent screen). Google never sees "zak1". No rename is needed or wanted.

---

## 2. Tech stack & runtime

| Area | Choice |
|---|---|
| Language | TypeScript 5.7 (strictest flags) |
| Framework | Next.js 15.1 (App Router, RSC) |
| DB | PostgreSQL 16 (local Homebrew `postgresql@16`, LaunchAgent auto-start) |
| ORM | Drizzle (schema in `src/server/db/schema/`) |
| Validation | Zod at every API boundary → typed domain objects |
| Auth | **`arctic`** (Google OAuth2/OIDC client) + **`jose`** (ID-token verification) — feature 015 |
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

For direct `psql`/`pg_dump`, source the env first: `set -a; . ./.env; set +a`.

---

## 3. Databases

Three Postgres databases on `localhost:5432`:

- **`zak1_dev`** (`DATABASE_URL`) — dev/demo data. **Persists on disk**. Holds the user's real demo data:
  **~1335 contacts**, 8 events, 2 event groups, **1 volunteer** (Rich Dempsey, added by feature 015's
  bootstrap).
- **`zak1_test`** (`TEST_DATABASE_URL`) — auto-migrated by `ensureSchema`; `resetDb` TRUNCATEs.
- (**`zak1_demo`**) — unused.

**Migrations**: hand-authored SQL in `src/server/db/migrations/`, applied additively via
`pnpm run db:migrate`. **20 migrations**, latest **`0020_staff_auth.sql`**.

**Seed:** `pnpm run db:seed` **TRUNCATEs all of `zak1_dev`** — the ONE command that wipes demo data.
Do NOT run it. (Feature 015's `auth:bootstrap` is deliberately *not* like this — it touches one contact.)

**Demo snapshot:** `~/zak1_demo.dump` (`pg_dump -Fc`) — but it predates migration 0020.

---

## 4. SpecKit workflow & governance

`/speckit-specify` → `/speckit-clarify` → `/speckit-plan` → `/speckit-tasks` → `/speckit-analyze` →
`/speckit-implement`. Feature 015 used the full pipeline and it worked well — `analyze` caught real
defects before implementation.

- **Active feature pointer:** `.specify/feature.json` → currently `specs/015-staff-auth`.
- **Hooks:** only optional `after_specify` / `after_plan` agent-context hooks.
- **Constitution** (`.specify/memory/constitution.md`) — now **v1.2.0**, NON-NEGOTIABLE:
  - **I. Test-First** — failing tests before implementation (Red-Green-Refactor).
  - **II. Simplicity/YAGNI** — no speculative abstraction.
  - **III. Type Safety** — strictest flags; Zod at boundaries.
  - **IV. Observability** — structured logs + audit rows.
  - **Technology Standards → Testing (amended 2026-07-14, v1.1.0 → v1.2.0):** integration tests run
    against **real infrastructure**; databases and services we operate are **never** mocked. **New, narrow
    exception:** third-party services we do *not* operate (e.g. Google) MUST NOT have their **production
    endpoints** called from tests — exercise them at their **boundary** (a local conforming implementation,
    or a fixture reproducing the verified contract, e.g. signed OIDC tokens). All logic behind that
    boundary stays live-tested. *This is not a licence to fake semantics we depend on.*

**Full suite: 291 tests / 112 files green.** Typecheck, eslint, markdownlint, prettier all clean.

---

## 5. Repo layout (key paths)

```text
docs/                      # NEW in Phase 3
  use-cases.md             #   ★ AUTHORITATIVE role model + permission matrix + per-role use cases
  zak1_Help_Glossary.md    #   term → file index (end-user glossary + code locations)
  paypal_Z5FUDMVGE6CVQ.pdf #   PayPal Hosted Button snippets (for B30)
src/
  app/
    (admin)/ (door)/       # PROTECTED — layout.tsx calls requireStaff()
    (public)/              # OPEN — whats-on/
    login/                 # NEW — "Sign in with Google"
    api/auth/              # NEW — google, google/callback, signout (PUBLIC)
    api/…                  # everything else: default-deny via withAuth
    dev/routes/            # TEMPORARY route index (see convention below)
  server/
    auth/                  # NEW (feature 015) — cross-cutting, not a business domain
      claims.ts            #   ★ the Google boundary seam (injectable verifier)
      google.ts signIn.ts session.ts currentStaff.ts withAuth.ts cookies.ts redirect.ts
    db/{schema,migrations}/ , bootstrapOfficer.ts
    domain/                # attendance bands bookings contacts dedup door events exports
                           # gate membership organizer parameters performers public treasurer venues
    validation/ lib/
tests/{unit,integration}/  # + helpers/oidc.ts = the local IdP fixture
specs/                     # 001…015 + BACKLOG.md, PHASE2_REQUIREMENTS.md,
                           # PHASE3_REQUIREMENTS.md, DATA_MODEL.md
```

### Repo conventions

- **Route index** (`CLAUDE.md`, temporary): update `src/app/dev/routes/page.tsx` whenever a route is
  added/removed. *(Phase 3 / P3-2 is expected to retire this.)*
- **Linting/formatting ownership — one owner per file type.** prettier → code; **markdownlint → markdown**
  (`.markdownlint-cli2.jsonc`, also read by VS Code). `.prettierignore` excludes `*.md`,
  `.markdownlint-cli2.jsonc`, and `.specify/` — without those, `pnpm run format` silently breaks the
  markdown toolchain. `pnpm run lint` runs **eslint + markdownlint**.

---

## 6. Domain model highlights (rules a new session will need)

**Organizer report** (`domain/organizer/`), per event:

- `payingDancers(attendance, performers, comps=0) = max(0, attendance − performers − 1 − comps)`
- **Dance Net** = admission + merch − rent − performerTotal − ongoing − misc.

**Gate/door money** (`domain/gate/eventMoney.ts`): admission is **derived**, never stored —
`cash admission = gross cash − seed float − Σ non-admission cash lines`.

**Rent (011):** per-event → series-at-venue → venue-default → 0. **Series parameters (009):** one
`series_parameters` table. **Contacts (012):** required `first_name`, optional `last_name`,
`display_name_override`; `display_name` maintained; dedup keys on structured names.

**Series are a table, not an enum**: `tnc`, `ecd`, **`community_dance`**, `general`. A **community dance is
its own series** (peer to tnc) — *not* an event type. **Event groups deliberately span series**
("Thanksgiving 2026" = tnc + ecd); `event_groups` has no `series_id`.

**Two constraints from 001 that feature 015 leans on:**

- `contact_emails_unique_active` — an email is globally unique among `active`/`transition` rows. This makes
  the sign-in email→contact match unambiguous **by construction**.
- `roles_require_volunteer` — only an `is_volunteer` contact may hold `volunteer_roles`.

---

## 7. Implementation status — features 001–015 (ALL done & pushed)

**Phase 1 (001–009):** 001 contacts & membership · 002 door attendance & gate · 003 performers &
bookings · 004 treasurer report & QBO (manual copy/paste) · 005 organizer report · 006 iContact export
(6 standing lists + contact-tracing) · 007 public website (**browse-only**; online sales deferred) ·
008 band roster · 009 series parameters.

**Phase 2 (010–014):** 010 retired the JAB list · 011 venue-scoped rent · 012 structured contact names ·
013 event label/start-time/description · 014 door comp count.

**Phase 3 (015 — NEW):** **staff authentication & session foundation** (P3-1, closes B32).
See §8.

---

## 8. Feature 015 — staff auth (the big new thing)

Staff **sign in with Google**; **no password exists anywhere**. Verified Google email → matched to an
**active** email on a **volunteer** contact → that becomes the contact's `is_login` email. This
**activated the dormant feature-001 substrate** (`is_volunteer` / `volunteer_roles` / `is_login`: schema +
service existed since 001, but **no UI ever wrote them** — live data had 0 volunteers, 0 login emails).
There is deliberately **no `users` table**: the person *is* a `contact`.

**Load-bearing decisions — do not undo without reading why:**

- **Sessions are DB rows, not JWTs** (`staff_sessions`). FR-011 requires ending an **active** session when
  volunteer access is withdrawn; a JWT cannot be revoked. `readSession` joins live to
  `contacts.is_volunteer`, so clearing it locks the person out **on the next request**. Only a SHA-256
  **hash** of the cookie token is stored.
- **Enforcement is route-group layouts + a `withAuth` wrapper, NOT middleware** — Next 15.1.3 middleware is
  edge-only and the `postgres` driver isn't edge-compatible.
- **`arctic` + `jose` + own sessions, NOT Auth.js** — its adapter imposes a parallel user model that
  duplicates `contacts`.
- **Google config is parsed separately** (`getAuthEnv()`), not in the core `envSchema`: the suite never
  contacts Google, so requiring OAuth creds globally would stop a fresh clone running `pnpm test`.
- **`email_verified === true` is the linchpin** — without it a token could assert any address.
- **`identity_exists`** refusal, checked *before* insert: one Google account per person. A long-term
  volunteer plausibly holds **both** a personal and a `cdrochester.org` account → clean refusal, never a
  UNIQUE violation. **B38** makes re-binding self-service.
- **`ambiguous_match` is unreachable** for sign-in (see §6) — kept as an invariant guard on a security path.
- **All refusals are generic to the user**; the reason is server-side only (else anyone could probe club
  membership).

**Testing (why the constitution was amended):** the suite **never calls Google**. `tests/integration/
helpers/oidc.ts` mints an ephemeral keypair and signs ID tokens locally, injecting a local JWKS. Everything
behind the seam runs against real Postgres. Locking down 41 routes broke 98 pre-auth tests — rather than a
test-mode bypass (which would mean never testing the protection), **`resetDb()` seeds a standing staff
session and `jsonReq` attaches its cookie**, so `withAuth` runs in full.
⚠️ That seeded contact ("Zztest Staff", `TEST_STAFF_*` exported from `helpers/db.ts`) **pollutes
contact-count assertions** — exclude it explicitly rather than expecting "+1".
**`auth.routeInventory.test.ts`** is a source-level guard: any new `/api/*` route without `withAuth` fails
the suite automatically.

**Operator bootstrap** (cold start — nothing in the UI sets `is_volunteer`):

```bash
pnpm run auth:bootstrap -- --email <addr> [--contact-id <uuid>] [--role administrator]
```

Idempotent, audited. `--contact-id` exists because officers' Workspace addresses usually aren't on their
contact yet.

**Google console:** consent screen **User Type = External** (⚠️ *never* Internal — it would lock out
short-term volunteers on personal accounts) and publishing **Published** (Testing caps at 100 hand-listed
test users). Scopes `openid`+`email` are non-sensitive → no verification review expected.
**Currently still in Testing — publish before rollout.**

**Verified end-to-end against real Google** (2026-07-14): Rich Dempsey / `rcd@cdrochester.org` signed in;
identity auto-provisioned, `is_login` set, 8h rolling session, token hashed.

---

## 9. The role model (`docs/use-cases.md` — READ THIS FIRST for Phase 3)

Built by walking through what each role *does*. **Not enforced yet** — 015 is authentication only.

- **Organizer is the BASE, not a peer**: every authenticated role *is* an Organizer (read oversight, no
  write). Others = base **+ additive grant**.
- **Elected bylaws officers** (club-wide): **President** (assigns roles + settings), **VP** (publicity),
  **Secretary** (notices; backup exporter), **Treasurer** (finance; **⊇ FS**).
- **Super-user** — renamed from "Administrator"; **writes anything**. App role, not an officer. (DB enum
  value is still `administrator`.)
- **Delegation:** President→Booker ⬤ · Treasurer→FS ⬤ · VP→{Webmaster ⬡, Mailing List Manager ⬤}.
- **Scope: `role × capability × scope`, and scope is NOT a tree.** ⬡ club-wide · ⬤ per-series ·
  ⬢ per-event-group · ◍ per-event. **⬢ is orthogonal to ⬤** (groups span series), so evaluate scope as a
  **set of filters (series OR group OR event)**, never a tree walk. Scope can vary *per capability* (the
  Mailing List Manager is per-series but exports **all** series).
- **Short-term volunteers are ⬢ group-scoped.** Group names carry the year, so their grants go inert once
  the group's events pass.
- **Decided:** `is_volunteer` is cleared only when a volunteer *leaves*, so a volunteer **retains read
  access indefinitely** — accepted. **"Short-term" bounds authority, not access.** ⇒ **the Organizer base
  stays UNSCOPED**; scope filtering applies to **grants and writes only**.
- **Hard boundary:** Door Attendant ✗ `/gate` (the **FS** owns gate money, not the Door Attendant).

---

## 10. Backlog (`specs/BACKLOG.md`) — B22–B38 are Phase 3

**Open, from the Phase 3 role review:** B22 venue landlord contact · B23 booking status
(proposed→requested→confirmed/declined) · B24 Booker cross-event bookings report · B25 event
cancel/delete/reschedule · B26 recurring event generation · B27 advertised admission price (Webmaster) ·
B28 performer payment override (payments ≠ bookings; substitution + aggregation → likely a
`performer_payments` table) · B29 comp/gift capture at check-in (**resolves B21**) · B30 online membership
via the club's existing **PayPal Hosted Button** (no callback → **decided: use a webhook**;
snippets in `docs/`) · B31 door membership enrollment · B33 check-in roster sort · B34 check-in
new-contact capture · B35 family children count (**all series**; children count as **paying**) ·
B36 open-band musicians comp'd into the **whole event group** (community_dance's rule) · B38 self-service
login-email change.

**Closed/retired:** **B32 → feature 015**. **B37 RETIRED** (community_dance is a *series*, already seeded;
the item came from a misreading — the code was right). B12/B14→Phase 2, B15→008, B16→009, B19→P2-2,
B20→P2-3. B21 → resolved by B29.

**Still deferred (pre-Phase-3):** B1 group tickets · B2 non-volunteer login · B3 primary email · B4–B11 ·
B17 · B18. **007 US2 online sales** stays deferred (B30 is the only toe in the water).

---

## 11. Next: Phase 3 (`specs/PHASE3_REQUIREMENTS.md`)

Five packages, dependency-ordered:

| Pkg | Theme | Items | Status |
|---|---|---|---|
| P3-1 | Authentication & session foundation | B32 | ✅ **SHIPPED** (feature 015) |
| **P3-2** | **Authorization — role × capability × scope** | *(derived from `use-cases.md`)* | **NEXT** |
| P3-3 | Check-in overhaul + community dance | B34, B33, B35, B36, B29 | planning |
| P3-4 | Booking & event management (Booker) | B23, B24, B25, B26, B22, B27 | planning |
| P3-5 | Payments & membership acquisition | B28, B31, B30 | planning |

P3-3/P3-4 can parallelize after P3-2; P3-5 last.

**P3-2 must also:** give the dormant `is_volunteer`/`volunteer_roles` **real UI writers** (only
`PATCH /api/contacts/[id]` writes them today; `auth:bootstrap` is the sole other path), rename the
`administrator` enum → Super-user semantics, and retire the `/dev/routes` convention.

### ⚠️ The one open question gating P3-2

**Row 17 — contacts/dedup ownership.** Does the VP (via the Mailing List Manager) own the **whole** contact
directory + dedup, or only the mailing side (emails, consent, exports), with contact *records* owned
elsewhere? Everything else in the matrix is decided.

### Known hard problem (P3-3)

**Comps must become event-group-aware.** Feature 014's `door_records.comp_count` is a **single-event**
counter and cannot express B36's "earned at the community dance, redeemed across the whole group". Ties to
B29 and B1.

---

## 12. Operating conventions & constraints

- **Commits:** only when the user explicitly asks. One atomic commit per feature, **directly to `main`**
  (no branches/PRs), trailer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Pushing is now
  routine (ask).
- **Auto-memory:** refresh after each feature ships. `~/.claude/projects/-Users-rcd-Repositories-zak1/
  memory/` (index `MEMORY.md`). Key: `zak1-implementation-status`, `zak1-phase3-roles`,
  `zak1-015-staff-auth`, `zak1-phase2-and-backlog`, `zak1-demo-db-persistence`.
- **Security:** never paste secrets into chat. `.env` is gitignored and holds the real Google client
  secret. Secret management for **deployment** is an open topic (the user has experimented with 1Password
  FIFO injection — note `loadEnv()` reads `.env` once per test file, so a FIFO will hang; `op run`-style
  env injection is the workable pattern).
- **Verification:** use `preview_start {name:"dev"}`; never run dev servers via Bash. The dev server runs
  on **port 3000** — `GOOGLE_REDIRECT_URI` must match it exactly or Google returns `redirect_uri_mismatch`.

---

## 13. Quick command cheatsheet

```bash
# always prefix node/pnpm commands:
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 24 >/dev/null 2>&1

pnpm run db:migrate         # apply new migrations (additive, safe)
pnpm test                   # full Vitest suite (real Postgres) — expect 291 green
pnpm exec vitest run <path> # specific test file(s)
pnpm exec tsc --noEmit      # typecheck
pnpm run lint               # eslint + markdownlint
pnpm run lint:md:fix        # auto-fix markdown
pnpm exec prettier --check .    # formatting (repo is prettier-clean as of 81b20f0)

pnpm run auth:bootstrap -- --email a@b.org [--contact-id <uuid>] [--role administrator]

pnpm run db:seed            # ⚠️ WIPES zak1_dev — do NOT run
```

```bash
# demo snapshot (source env first):
set -a; . ./.env; set +a
pg_dump -Fc "$DATABASE_URL" -f ~/zak1_demo.dump
pg_restore --clean --if-exists --no-owner -d zak1_dev ~/zak1_demo.dump
```
