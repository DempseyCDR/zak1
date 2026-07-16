# Implementation Plan: Authorization — Role × Capability × Scope

**Branch**: `main` (project convention: atomic commits direct to `main`, no feature branches) |
**Date**: 2026-07-15 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/016-role-authorization/spec.md`

## Summary

Feature 015 gave the platform an identity. This gives it **authority**. The permission matrix in
`docs/use-cases.md` becomes enforcement: the Organizer base plus ten additive grants, each carrying a scope
(club-wide / per-series / per-event-group), evaluated live on every protected read and write.

**Technical approach** (see [research.md](research.md)): a **`role_grants` table** — the `volunteer_roles`
array cannot carry scope and is dropped (R1). Scope is **two nullable FKs** (`series_id`, `group_id`) with
`num_nonnulls <= 1`, so three granularities are three states of two columns and the orthogonality FR-007
demands is structural rather than coded (R2). A **static capability catalog in code** maps role → capability
→ `scoped | global`, with FR-012's three supersets **flattened into the map** so the evaluator has no
concept of hierarchy at all (R4). Enforcement lands in **two layers**: routes *declare* a requirement —
a capability, or an explicit `'base'` for the 28 read routes FR-015 makes universal (guarded by extending
015's self-maintaining inventory test) — while services *assert scope* where the target is known, 015's
"close to the data" reasoning one level down (R5, R13).

**Two findings that the spec text does not reveal, both real work:**

- **R8 — the audit trail is log lines.** `writeAudit` only calls `logger.info`; its own comment says
  *"dedicated audit tables are introduced with those stories."* This is that story: SC-014 requires the
  PII-disclosure trail be queryable **without scanning application logs**, and FR-032 needs the grant trail.
  An **`audit_events` table** is unavoidable — three requirements are unimplementable without it.
- **R12 — the test harness's staff has no grants.** `seedTestStaff()` creates a volunteer with no roles and
  `jsonReq` attaches its session to everything. Under this feature that actor writes **nothing** — **~291
  tests across 112 files** would fail, none of them about authorization. The harness gets a club-wide
  `super_user` grant, which is 015's own move (seed real authority, never a bypass) applied one level up.

## Technical Context

**Language/Version**: TypeScript 5.7 (strictest flags), Node 24 (Active LTS; `.nvmrc`, `engines`)

**Primary Dependencies**: Next.js 15.1.3 (App Router, RSC), React 19, Drizzle ORM 0.36, `postgres` 3.4,
Zod 3.24, pino 9.5, `arctic` + `jose` (015). **No new dependencies** — authorization is domain logic, and
a policy engine (CASL, Casbin, OPA) would add a DSL to express a matrix that fits in one typed map (R4).

**Storage**: PostgreSQL 16 (`zak1_dev` / `zak1_test`). Adds **`0021_role_authorization.sql`** (latest is
`0020`). ⚠️ **The first destructive migration in this project** — it drops `contacts.volunteer_roles`, the
`volunteer_role` enum, and the `roles_require_volunteer` CHECK. ⚠️ **It migrates zero rows**: verified
2026-07-15, **no contact holds any `volunteer_role`** — the earlier "one live holder" premise was wrong
(the bootstrap CLI's `--role` is optional and 015 did not use it). The club therefore cold-starts its first
Super-user from the CLI ([data-model.md](data-model.md) §7a) — the only source of one anyway (FR-030a).

**Testing**: Vitest 2.1 against **real Postgres** (`zak1_test`), reusing `tests/integration/helpers/`. No
third-party boundary is involved: unlike 015, this feature calls nothing external, so the constitution's
v1.2.0 exception is **not needed here** — everything is live-tested.

**Target Platform**: Web app on Node 24 (single-tenant, self-hosted)

**Project Type**: Web application (Next.js App Router monolith; `src/app` + `src/server`)

**Performance Goals**: Not a driver. Authorization adds **one indexed query per request**
(`role_grants WHERE contact_id = $1`) beside 015's session read. Grants are loaded per request and
**deliberately not cached** — FR-014 requires a revoked grant to be gone on the *next* request, and a cache
is precisely how that stops being true.

**Constraints**:

- **FR-005a is a cross-row invariant** (President/VP/Treasurer mutual exclusivity) and cannot be a row
  CHECK. Enforced in the service, on **every** path including the CLI (FR-033).
- **FR-005c forbids a uniqueness constraint** — two people may hold President. Called out because
  one-President-at-a-time feels self-evident and a helpful index would violate the spec.
- **R3: the clear-designation cascade must be one transaction.** A partial write here is a *security*
  outcome: orphaned grants would silently restore on re-designation, which FR-028b forbids.
- **`pnpm run db:seed` TRUNCATEs `zak1_dev`** and is never the fix for a bad migration. Snapshot first
  ([quickstart.md](quickstart.md)).

**Scale/Scope**: Tens of staff; ~1335 contacts; 44 API routes and 21 pages to gate. Correctness and
revocation matter; throughput does not.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.* — Constitution **v1.2.0**.

| Principle | Gate | Status |
|---|---|---|
| **I. Test-First (NON-NEGOTIABLE)** | Failing tests before implementation; Red-Green-Refactor; new behavior covered. | ✅ **PASS** — US1's acceptance scenarios *are* the enforcement suite and are written first. This is load-bearing, not ceremony: R5's layer 2 has **no source-level guard**, so tests are the only thing standing between "scope is checked" and "scope is assumed". |
| **II. Simplicity / YAGNI** | No speculative abstraction; helper only at 3+ uses. | ✅ **PASS** — 2 tables, 0 new dependencies, no policy engine, no runtime role hierarchy, no DB-driven catalog. **Per-event scope was dropped** rather than built (FR-006): its only candidate user went club-wide, leaving it zero users. Rejected alternatives are recorded per-item in [research.md](research.md). |
| **III. Type Safety** | Strictest flags; no undocumented escape hatches; boundaries validated with Zod → typed domain objects. | ✅ **PASS** — `Capability` and `Role` are string-literal unions, so `CAPABILITIES` is exhaustively checked at compile time: a role missing from the catalog is a type error, not a silent deny. Grant-assignment input is Zod-validated at the API boundary as everywhere else. |
| **IV. Observability** | Structured logs + audit rows; no ad-hoc logging in production paths. | ✅ **PASS** — and this is where the principle's deferred half finally lands: **R8** replaces the log-only audit sink with `audit_events`, satisfying FR-017b/FR-032/SC-014. Refusals are audited (FR-026b). |
| **Technology Standards → Testing (v1.2.0)** | Integration tests against real infrastructure; DB never mocked; third-party services exercised at their boundary. | ✅ **PASS** — real `zak1_test` throughout. **The third-party exception does not apply**: this feature contacts nothing external. Notably, R12 refuses a test-mode authz bypass on exactly the constitution's reasoning — a bypass means never testing the protection. |
| **Development Workflow** | Atomic, meaningful commits; Constitution Check reviewed pre-Phase-0 and re-verified post-Phase-1. | ✅ **PASS** — re-verified below. |

**Initial gate: PASS.** No violations → Complexity Tracking is empty.

**Post-Phase-1 re-check: PASS.** The design added no abstraction beyond two tables, one catalog map, and
three helpers (`can` / `assertScope` / `projectContact`). Two points deserve the record:

1. **`audit_events` (R8) is not scope creep.** FR-017b, FR-032, and SC-014 are each unimplementable against
   a log stream, and `audit.ts` was written expecting this exact story. YAGNI governs speculative work; this
   is three requirements' stated need.
2. **The two-layer enforcement (R5) is a genuine trade.** One wrapper doing everything would be simpler to
   describe, but it would have to buffer and re-inject **every** request body to authorize the minority
   whose target lives there. Two layers is the cheaper honesty — with the risk (layer 2 is forgettable)
   named in the contract rather than glossed.

## Project Structure

### Documentation (this feature)

```text
specs/016-role-authorization/
├── plan.md                      # This file
├── research.md                  # Phase 0 — R1..R14, incl. findings R8 (audit) and R12 (harness)
├── data-model.md                # Phase 1 — role_grants, audit_events, migration 0021
├── quickstart.md                # Phase 1 — snapshot, migrate, verify, gotchas
├── contracts/
│   └── authorization.md         # Phase 1 — the capability catalog + the P3-3/4/5 seam
├── checklists/
│   └── requirements.md          # From /speckit-specify + /speckit-clarify (16/16)
└── tasks.md                     # Phase 2 (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── (admin)/
│   │   ├── layout.tsx           # UPDATE — role-aware nav (FR-039)
│   │   └── access/page.tsx      # NEW — volunteers, grants, annual review (US2)
│   ├── (door)/
│   │   └── gate/page.tsx        # UPDATE — read for all, write for FS/Treasurer (FR-020)
│   ├── api/
│   │   ├── access/
│   │   │   ├── volunteers/route.ts               # NEW — designate / clear (FR-028a/b)
│   │   │   ├── volunteers/[id]/approve/route.ts  # NEW — annual approval (FR-035)
│   │   │   └── grants/route.ts                   # NEW — grant / revoke (FR-029)
│   │   └── **/route.ts          # UPDATE ×41 — declare a requirement: capability or 'base' (R5 layer 1)
│   └── dev/routes/              # DELETE — retired (FR-040)
├── server/
│   ├── auth/
│   │   ├── capabilities.ts      # NEW — the catalog; role → capability → scoped|global (R4)
│   │   ├── actor.ts             # NEW — Actor = CurrentStaff + grants; loadGrants()
│   │   ├── can.ts               # NEW — can() / assertScope() (R5 layer 2)
│   │   ├── fields.ts            # NEW — assertFields(); refuse, never strip (R6)
│   │   ├── pii.ts               # NEW — projectContact() (R7)
│   │   └── withAuth.ts          # UPDATE — withAuth({ requires }, handler); Capability | 'base'
│   ├── domain/
│   │   ├── access/grantService.ts   # NEW — grant/revoke; FR-005a; transactional cascade (R3)
│   │   └── **/                  # UPDATE — assertScope/assertFields at the data
│   ├── db/
│   │   ├── schema/{authz,audit}.ts                 # NEW — roleGrants, auditEvents
│   │   ├── schema/contacts.ts                      # UPDATE — approval cols; drop volunteerRoles
│   │   ├── migrations/0021_role_authorization.sql  # NEW — ⚠️ destructive; see data-model §7
│   │   └── bootstrapOfficer.ts                     # UPDATE — role_grants writer (T010, compile break); FR-005a (T050)
│   └── lib/
│       ├── audit.ts             # UPDATE — write a ROW as well as a log line (R8)
│       └── apiError.ts          # UPDATE — UNAUTHORIZED, FIELD_NOT_PERMITTED (R11)
tests/
├── integration/
│   ├── authz.schema.test.ts         # NEW — scope CHECK + partial unique index, FAIL FIRST (Const. I)
│   ├── authz.scope.test.ts          # NEW — series/group/club; orthogonality (US1)
│   ├── authz.boundaries.test.ts     # NEW — DA reads gate, never writes (US1.3, SC-003)
│   ├── authz.refusal.test.ts        # NEW — 403 names the capability; audited (FR-026)
│   ├── authz.nav.test.ts            # NEW — nav follows grants; hidden ≠ protected (US5)
│   ├── authz.pii.test.ts            # NEW — base excluded; lookup vs bulk; dedup (US3/US4)
│   ├── authz.fields.test.ts         # NEW — refuse-not-strip (US3, SC-009)
│   ├── authz.grants.test.ts         # NEW — FR-005a/c; cascade; approval (US2)
│   ├── authz.audit.test.ts          # NEW — SC-014 answerable in SQL (R8)
│   ├── auth.routeInventory.test.ts  # UPDATE — every method declares a requirement (R13)
│   ├── auth.public.test.ts          # INHERITED from 015 — guards FR-018; must stay green
│   ├── helpers/db.ts                # UPDATE — ⚠️ seed super_user or ~291 tests fail (R12)
│   └── helpers/factories.ts         # UPDATE — scoped-actor factory for authz tests
└── unit/
    └── authz.can.test.ts            # NEW — the evaluator as a pure function
```

**Structure Decision**: Existing monolith; no new project. Authorization joins `src/server/auth/` beside
015's session code — cross-cutting infrastructure consumed by every route group, not a business domain.
The **one exception** is `domain/access/grantService.ts`: *assigning* roles is a business capability with
its own rules (FR-005a's exclusivity, FR-028b's cascade), so it lives in `domain/` like any other, while
*evaluating* authority stays in `auth/`. Enforcing and granting are different jobs.

⚠️ `src/app/dev/routes/page.tsx` is **deleted** by this feature (FR-040) — so the `CLAUDE.md` convention
requiring its upkeep must go in the same change, or it becomes an instruction that cannot be followed.

## Complexity Tracking

> No Constitution Check violations. Table intentionally empty.
