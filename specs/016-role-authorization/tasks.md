---

description: "Task list for feature 016 — Authorization: Role × Capability × Scope"
---

# Tasks: Authorization — Role × Capability × Scope

**Input**: Design documents from `/specs/016-role-authorization/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/authorization.md](contracts/authorization.md),
[quickstart.md](quickstart.md)

**Tests**: **REQUIRED — not optional.** Constitution **Principle I (Test-First)** is NON-NEGOTIABLE: tests
are written first and MUST be confirmed failing for the right reason before implementation. This matters
more here than usual — research **R5** establishes that the service-layer scope check has **no source-level
guard**, so these tests are the only thing between "scope is checked" and "scope is assumed".

**Organization**: Grouped by user story (US1–US5 from spec.md) so each is an independently testable
increment.

**Traceability**: each task names the FR/SC keys it satisfies.

> ## ⚠️ Read these three before starting
>
> 1. **T005 is destructive and irreversible.** Migration 0021 drops `contacts.volunteer_roles` and its
>    enum — the first non-additive migration in this project. **T001's snapshot is the only way back.**
>    `pnpm run db:seed` is NOT a rollback; it TRUNCATEs `zak1_dev` and your ~1335 real demo contacts.
> 2. **T020 must land before any enforcement (T030+), or ~291 tests fail.** Research **R12**: the harness
>    seeds a volunteer with no roles and attaches its session to every request. The moment writes require
>    grants, that actor can do nothing — across 112 files, none of them about authorization.
> 3. **FR-005c forbids a uniqueness constraint on roles.** Two people may hold President. If you find
>    yourself adding `UNIQUE (role)`, stop — it feels obviously right and violates the spec.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1 / US2 / US3 / US4 / US5 (user-story phases only)
- Exact file paths included

## Path Conventions

Next.js App Router monolith: `src/app/` (routes/pages), `src/server/` (auth, domain, db, lib),
`tests/{integration,unit}/`. Per [plan.md](plan.md) — no new project.

---

## Phase 1: Setup

**Purpose**: Establish a known-good baseline and a way back from T005.

- [X] T001 🛑 Snapshot `zak1_dev` to `~/zak1_pre_0021.dump` via `pg_dump -Fc` per [quickstart.md](quickstart.md); verify the dump restores into a scratch DB. **Blocks T005 — this is the only rollback.**
- [X] T002 Record the pre-migration baseline: `pnpm test` (expect ~291 green / 112 files), `pnpm exec tsc --noEmit`, `pnpm run lint`. A red baseline must be fixed before T005, not diagnosed after it.
- [X] T003 Confirm the starting state: `psql "$DATABASE_URL" -c "SELECT id, display_name, volunteer_roles FROM contacts WHERE is_volunteer"` → **expect `Rich Dempsey | {}` — an EMPTY array**. ⚠️ *Corrected 2026-07-15 against live data: this task originally expected `{administrator}`. Nobody holds any role and nobody ever has — `bootstrapOfficer`'s `--role` is optional and 015 did not use it. The migration therefore migrates zero rows, and the cold start (T011) is real.* (FR-013)

**Checkpoint**: A restorable snapshot exists and the suite is green.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The grant substrate, the evaluator, and the audit table — everything every story needs.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Schema & migration

- [X] T004 [P] Write **failing** integration tests for the grant-scope constraints in `tests/integration/authz.schema.test.ts`: (a) a grant carrying **both** `series_id` and `group_id` is rejected by `grant_scope_exclusive`; (b) a **second club-wide grant of the same role to the same contact** is rejected by the partial unique index — the plain `UNIQUE` misses this, because Postgres treats NULLs as distinct ([data-model.md](data-model.md) §3); (c) a grant whose `series_id` names a non-existent series is rejected by the FK. Confirm all three **FAIL** before T005 creates the table. Mirrors 015's own T004→T005 ordering, and these are the constraints that carry FR-006/FR-007's meaning — Constitution **Principle I** applies to a CHECK exactly as it does to a function. (FR-005, FR-006, FR-007, Constitution I)
- [X] T005 🛑 Write `src/server/db/migrations/0021_role_authorization.sql` in the exact order of [data-model.md](data-model.md) §7: create `role` enum (**ten** values, no `organizer`) → `role_grants` → `audit_events` → add `contacts.volunteer_approved_at`/`_by` → **migrate any `administrator` holders to `super_user`** → drop `roles_require_volunteer` → drop `contacts.volunteer_roles` → drop `volunteer_role` enum. The migrate step MUST precede the drops. ⚠️ **The migrate step moves ZERO rows** (T003) — keep it anyway: it is data-driven, it documents that the enum was retired rather than silently dropped, and it is correct in any environment that *does* have a holder. **Do not hardcode a contact id** — this migration also runs against `zak1_test` and every future environment. (FR-003, FR-006, FR-013, FR-034)
- [X] T006 [P] Add `src/server/db/schema/authz.ts` — `roleGrants` with `grant_scope_exclusive` CHECK `num_nonnulls(series_id, group_id) <= 1`, `UNIQUE (contact_id, role, series_id, group_id)`, and a **partial unique index on `(contact_id, role)` where both scope columns are NULL** (Postgres treats NULLs as distinct, so club-wide duplicates escape the plain UNIQUE — [data-model.md](data-model.md) §3). Real FKs to `series`/`event_groups`, default `NO ACTION`. (FR-005, FR-006, FR-007)
- [X] T007 [P] Add `src/server/db/schema/audit.ts` — `auditEvents` (`kind` as `text`, not an enum), indexes on `(occurred_at)`, `(kind, occurred_at)`, `(actor_contact_id, occurred_at)`. (R8, SC-014)
- [X] T008 Update `src/server/db/schema/contacts.ts` — add `volunteerApprovedAt`/`volunteerApprovedBy`; **remove** `volunteerRoles`; drop the `volunteerRoleEnum` import from `src/server/db/schema/enums.ts`. (FR-034)
- [X] T009 Run `pnpm run db:migrate` against `zak1_test` and `zak1_dev`; **T004 must now pass**. Verify `role_grants` is **empty** (zero rows — the migrate step had nothing to move, per T003) and that Rich Dempsey can still **sign in** (authentication is unaffected; only authority is gone). (FR-005, FR-006, SC-001)

### The cold start (⚠️ discovered at T003 — the database has zero grants after T005)

- [X] T010 Update `src/server/db/bootstrapOfficer.ts` to write a **`role_grants` row** instead of appending to `contacts.volunteer_roles`, and accept `--role super_user`. **This is not optional cleanup — it is a compile break**: T008 removes `volunteerRoles` from the schema, and `bootstrapOfficer.ts:83-86` sets it, so the build fails until this lands. (Its FR-005a exclusivity check comes later, at T050.) (FR-030a, FR-033)
- [X] T011 🧊 Bootstrap the first Super-user: `pnpm run auth:bootstrap -- --email <operator> --role super_user`. **After T005 nobody holds any grant — including the operator.** That is the designed cold start ([data-model.md](data-model.md) §7a), not breakage: FR-030a makes the CLI the only source of a Super-user, so this step exists regardless. Confirm one club-wide grant (**both scope columns NULL**) and an `authz.grant.created` audit row. (FR-013, FR-030a, FR-033)

### Audit trail (research R8)

- [X] T012 Write `tests/integration/authz.audit.test.ts` — **FAIL FIRST**: `writeAudit` persists a row; SC-014's question ("which volunteer saw the most contacts' PII last month, and how many") is answerable **in SQL with no log access**. (SC-014)
- [X] T013 Update `src/server/lib/audit.ts` — `writeAudit` writes an `audit_events` **row** and keeps its structured log line; add the new kinds (`authz.grant.created`/`.revoked`, `authz.refused`, `volunteer.designated`/`.cleared`/`.approved`, `pii.disclosed`). Signature unchanged, so existing callers are untouched. (FR-017b, FR-026b, FR-032, SC-014)

### The evaluator

- [X] T014 [P] Write `tests/unit/authz.can.test.ts` — **FAIL FIRST**: the evaluator as a pure function. Union/allow-wins; `scoped` vs `global`; club-wide grant matches any target; **a group-scoped grant reaches an event whose series the holder has no grant for** (FR-007's orthogonality); an ungrouped event simply does not match a group grant (no error); no grant ⇒ deny. (FR-004, FR-007, FR-008, FR-013)
- [X] T015 Add `src/server/auth/capabilities.ts` — the catalog of [contracts/authorization.md](contracts/authorization.md) §1–2 as `Record<Role, Partial<Record<Capability, 'scoped'|'global'>>>`. **Flatten the three supersets into the map** (Treasurer ⊇ FS, VP ⊇ President, Super-user ⊇ all) so the evaluator has no runtime notion of hierarchy. `export.read` is `global` while `mailing_list.write` is `scoped` — that pair *is* FR-008. (FR-003, FR-008, FR-009, FR-010, FR-011, FR-012)
- [X] T016 [P] Add `src/server/auth/actor.ts` — `Actor = { staff: CurrentStaff; grants: Grant[] }` and `loadGrants()`. **Wrap `CurrentStaff`, do not extend it**: 015 wrote that it "carries no roles… P3-2 will layer around this rather than replace it". One indexed query per request; **no caching** — FR-014 needs a revoked grant gone on the *next* request. (FR-014)
- [X] T017 Add `src/server/auth/can.ts` — `can(actor, capability, target?)` and `assertScope(...)` per [contracts/authorization.md](contracts/authorization.md) §3. Evaluate as a **set of filters (series OR group)**, never a tree walk. Make T014 pass. (FR-004, FR-007, FR-013, FR-019)

### Errors & the wrapper

- [X] T018 [P] Update `src/server/lib/apiError.ts` — add `UNAUTHORIZED` (403, **names the refused capability**) and `FIELD_NOT_PERMITTED` (403, names the field). Note in the code why 403 is talkative where 015's 401 is silent: under FR-015 the actor could already *read* the thing, so concealment protects nothing. (FR-026, FR-026a)
- [X] T019 Update `src/server/auth/withAuth.ts` — accept `withAuth({ requires }, handler)` and inject `Actor`, where `Requirement = Capability | 'base'` ([contracts/authorization.md](contracts/authorization.md) §1, §4). **`'base'` is mandatory for read routes, not an omission**: 28 of 41 non-auth routes export a `GET` that FR-015 makes universal, and if they could simply leave the field out, "declared nothing" and "forgot" would be indistinguishable — which would gut T038's guard. `'base'` is **not** a `Capability` and never enters the catalog. Keep the bare `withAuth(handler)` form working **transitionally** so routes convert in parallel; T037 removes it. (FR-015, FR-019)

### The test harness (research R12)

- [X] T020 🛑 [P] Update `tests/integration/helpers/db.ts` — `seedTestStaff()` grants "Zztest Staff" a **club-wide `super_user`**. **Must land before T030.** Not "all roles": FR-005a makes President+Treasurer illegal, so "every role" is not a valid state — Super-user is the only coherent do-anything actor. A test-mode bypass is rejected on 015's precedent (a bypass means never testing the protection). (R12)
- [X] T021 [P] Add a scoped-actor factory to `tests/integration/helpers/factories.ts` — build a volunteer holding given roles at given scopes, returning an attachable session cookie. Authorization tests MUST use this; asserting against the Super-user harness actor proves nothing. (US1–US5)

**Checkpoint**: Grants exist and evaluate; the audit trail is a table; the suite is still green because nothing enforces yet.

---

## Phase 3: User Story 1 — Grants are enforced, with scope (Priority: P1) 🎯 MVP

**Goal**: Authority is real. A Booker-of-ecd acts on ecd and is refused on tnc; a Door Attendant reads the gate but cannot write it; a group grant crosses series; the base reads everything but contact PII.

**Independent Test**: Seed actors with known grants (T021) and exercise each capability, asserting allow/deny. No assignment UI required — which is why this is the MVP.

### Tests for User Story 1 ⚠️ Write FIRST, confirm they FAIL for the right reason

- [X] T022 [P] [US1] `tests/integration/authz.scope.test.ts` — Booker-of-ecd writes ecd, refused on tnc **with no data change**; Treasurer performs any FS write on any series (⊇); VP performs any President action (⊇); Super-user writes anything; a base-only volunteer is refused every write **and every allow traces to a specific grant or the documented base**. (US1.1–2, US1.5–6, US1.9–10, FR-001, FR-002, SC-001, SC-002, SC-008)
- [X] T023 [P] [US1] `tests/integration/authz.scope.test.ts` — group scope: a grant on a group spanning tnc+ecd reaches its **ecd** event with no ecd series grant, and is refused for an ecd event **outside** the group. (US1.7–8, SC-005)
- [X] T024 [P] [US1] `tests/integration/authz.boundaries.test.ts` — a Door Attendant **reads** gate figures successfully and is refused **every** write path; an FS-of-tnc writes tnc's and is refused ecd's while still reading them. (US1.3–4, SC-003)
- [X] T025 [P] [US1] `tests/integration/authz.scope.test.ts` — a base-only volunteer reads the treasurer report, gate figures, and **individual performer pay** for **every** series (the base is unscoped, FR-002). This asserts money is *open*; it looks like a bug and is not. (US1.10, FR-001, FR-002, FR-015, SC-004)
- [X] T026 [P] [US1] `tests/integration/authz.scope.test.ts` — the Mailing List Manager scoped to one series exports **all** series' lists but writes only its own series' mailing list. (US1.12, FR-008)
- [X] T027 [P] [US1] `tests/integration/authz.scope.test.ts` — clearing `is_volunteer` makes every grant evaluate denied on the **next request**, no sign-out; revoking one grant leaves the Organizer base read intact. (US1.13, FR-014, SC-006)
- [X] T028 [P] [US1] `tests/integration/authz.refusal.test.ts` — a refusal returns **403 naming the capability** (not 401, not 404, not a redirect) and is written to `audit_events` as `authz.refused`. (FR-026, FR-026b, SC-012)

### Implementation for User Story 1

- [X] T029 [US1] Add `assertScope` calls to the **event/venue/performer/booking/parameter** services in `src/server/domain/` (`events`, `venues`, `performers`, `bands`, `bookings`, `parameters`) — at the data, not at one caller (R5 layer 2). (FR-019, SC-002)

> **T030–T034 all follow one rule**: declare per **exported HTTP method**, not per file — `withAuth` wraps
> each method separately, so `GET` and `POST` in the same `route.ts` declare independently. **Writes get a
> capability; `GET`s get `requires: 'base'`** unless reading is genuinely restricted, which is true in
> exactly one place: `export.read` (FR-024). `contact.pii.read` is **not** a route requirement — PII is
> projected at the service layer (T063), so `GET /api/contacts` declares `'base'`.

- [X] T030 [P] [US1] Declare requirements on the **events** routes: `src/app/api/events/**`, `event-groups`, `series` — writes → `event.write` / `event.public.write`; `GET`s → `'base'`. (FR-015, FR-019)
- [X] T031 [P] [US1] Declare requirements on the **venue/performer/booking/parameter** routes: `src/app/api/{venues,venue-rents,performers,bands,bookings,rate-parameters,expense-parameters}/**` — writes → `venue.write` / `performer.write` / `booking.write` / `parameter.write`; `GET`s → `'base'`. (FR-015, FR-019)
- [X] T032 [P] [US1] Declare requirements on the **money** routes: `src/app/api/door-records/**` → `gate.write`; `src/app/api/events/[id]/{treasurer-report,misc-expenses,non-dance-income}` and `src/app/api/qbo-mapping/**` → `treasurer_report.write`. **Every `GET` here declares `'base'`** — money is open to all volunteers (FR-015), and this is the phase's most counter-intuitive line. (FR-015, FR-019, FR-020, FR-025)
- [X] T033 [P] [US1] Declare requirements on the **check-in / attendance** routes: `src/app/api/events/[id]/attendance`, `src/app/api/attendance/search` → `attendance.write` (Door Attendant is **club-wide**, FR-038); `GET`s → `'base'`. (FR-015, FR-019, FR-038)
- [X] T034 [P] [US1] Declare requirements on the **contacts / dedup / exports / memberships** routes: `src/app/api/{contacts,dedup,exports,memberships}/**` — writes → `contact.write` / `contact.mailing.write` / `dedup.write` / `membership.write`; `GET`s → `'base'`, **except `exports/**` → `export.read`**, the one place reading is genuinely restricted. (FR-015, FR-019, FR-023, FR-024)
- [X] T035 [US1] Add `gate.write` enforcement to the door-record services in `src/server/domain/{gate,door}/` — the FS owns the money; the Door Attendant's writes are refused **at every scope**. (FR-020, SC-003)
- [X] T036 [US1] Update `src/app/(door)/gate/page.tsx` — renders figures for any volunteer, disables/refuses writes without `gate.write`. The page showing live money to a Door Attendant is **correct** (`use-cases.md` §4). (FR-015, FR-020)
- [X] T037 [US1] Remove the transitional bare-handler form from `src/server/auth/withAuth.ts` (T019) — `{ requires }` becomes mandatory, so a route that forgets it is a **type error**. (FR-019)
- [X] T038 [US1] Extend `tests/integration/auth.routeInventory.test.ts` — every exported method of every non-auth route must **declare a requirement** (a capability or an explicit `'base'`), not merely be wrapped (R13). Keep it source-level and self-maintaining: no hand-maintained list of 41 paths, which is exactly what the existing test's comment refuses to become. Assert **`'base'` is written down**, never inferred from absence — that distinction is the whole guard. (FR-013, FR-019)

**Checkpoint**: US1 is independently demonstrable — the MVP. Authority is enforced; grants still come from the CLI.

> **Three deliberate scope calls during implementation** (all YAGNI-correct, recorded here so they are decisions rather than gaps):
>
> 1. **Venues and performers get layer 1 only.** They are shared directories that span series — a venue hosts tnc *and* ecd — so there is no per-resource series to scope against. Any Booker may edit the shared directory (`use-cases.md` §5.1.2: "Treasurer + Bookers together cover all venue data"). Layer 1 (`venue.write`/`performer.write` held at some scope) is the whole enforcement; a scoped grant with no target legitimately passes.
> 2. **`bookings/[id]/check` (check numbers) is layer 1 only.** It writes a booking field directly and is really a *payment* action (check numbers → FS, matrix row 13). Its proper home with `performer_payment.write` scoping is **P3-5/B28**, which builds the performer-payments model. Left at `booking.write` layer-1 rather than half-scoping it now.
> 3. **T036 gate page:** server enforcement is complete and tested (Door Attendant PATCH → 403, reads → 200); the page now surfaces a 403 as a clear "Financial Secretary only" message. Proactively *disabling* the control needs actor-capabilities plumbed to the client — that mechanism is US5's role-aware UI, so the affordance lands there.

---

## Phase 4: User Story 2 — The President or VP assigns volunteers and roles (Priority: P2)

**Goal**: Grants come from screens, not a terminal. The dormant feature-001 substrate finally gets a UI writer.

**Independent Test**: Sign in as President, designate a volunteer, grant a scoped role, watch it take effect on their next request, revoke it, watch access end.

### Tests for User Story 2 ⚠️ Write FIRST, confirm they FAIL

- [ ] T039 [P] [US2] `tests/integration/authz.grants.test.ts` — President and **VP** both designate volunteers and grant/revoke roles; a grant works on the grantee's next request; the **Treasurer is refused** granting FS. (US2.1–5, US2.8, FR-028, FR-029, FR-030, SC-007)
- [ ] T040 [P] [US2] `tests/integration/authz.grants.test.ts` — **FR-005a**: granting VP to a sitting Treasurer is **refused**, on the API path **and** via `bootstrapOfficer` (FR-033); **FR-005b**: the **Secretary is exempt** and may be held alongside any of the three. (US2.5–6, FR-005a, FR-005b, SC-016)
- [ ] T041 [P] [US2] `tests/integration/authz.grants.test.ts` — **FR-005c**: two contacts may **both** hold President. Asserts the absence of a uniqueness constraint someone will want to add. (FR-005c)
- [ ] T042 [P] [US2] `tests/integration/authz.grants.test.ts` — clearing a volunteer with 3 grants **reports all 3 first**, then on confirm revokes all 3 with **one audit row each**; re-designating them yields **zero** grants. Include the failure case: assert the clear+revoke is **atomic**, since a partial write would silently restore authority on re-designation (R3). (US2.13–15, FR-028a, FR-028b, SC-015)
- [ ] T043 [P] [US2] `tests/integration/authz.grants.test.ts` — annual approval: a volunteer approved >1yr ago (or never) is flagged **overdue**; an overdue volunteer's access is **unaffected**; approving records date + approver. (US2.11–12, FR-034–037, SC-011)
- [ ] T044 [P] [US2] `tests/integration/authz.grants.test.ts` — granting FS to a sitting President **succeeds with a warning** and surfaces as a standing concentration on the annual review. (US2.7, FR-029a, FR-029b)

### Implementation for User Story 2

- [ ] T045 [US2] Add `src/server/domain/access/grantService.ts` — grant/revoke; **FR-005a exclusivity** (a cross-row invariant, so it lives here and not in a CHECK); FR-029a's FS-concentration warning. Assigning roles is a business capability with rules, so it belongs in `domain/` while *evaluating* stays in `auth/`. (FR-005a, FR-027, FR-029a, FR-030, FR-032)
- [ ] T046 [US2] Add volunteer designation + the **transactional** clear-and-revoke-all cascade to `grantService` — one transaction, non-negotiable (R3): the atomicity *is* FR-028b's "never silently restored". (FR-022, FR-028, FR-028a, FR-028b)
- [ ] T047 [US2] Add annual approval to `grantService` — write `volunteer_approved_at`/`_by` and an audit row. **Nothing on the session path may read these columns** (FR-037): doing so converts an advisory review into a club-wide lockout on a forgotten meeting. (FR-034, FR-035, FR-036)
- [ ] T048 [P] [US2] Add `src/app/api/access/grants/route.ts` (POST grant, DELETE revoke) and `src/app/api/access/volunteers/route.ts` (designate/clear) + `src/app/api/access/volunteers/[id]/approve/route.ts`, all declaring `role.assign` / `volunteer.approve`, with Zod validation at the boundary. (FR-029, FR-030, FR-035)
- [ ] T049 [US2] Add `src/app/(admin)/access/page.tsx` — volunteers with every grant and scope; grant/revoke; **report-then-confirm** on clear (FR-028a); overdue flags; FS-concentration warnings. When FR-005a refuses (e.g. a Treasurer elected President), show the **required order** — revoke first — not a bare refusal. (FR-026, FR-028a, FR-031, FR-036, SC-007)
- [ ] T050 [US2] Add **FR-005a exclusivity enforcement** to `src/server/db/bootstrapOfficer.ts` — the CLI must refuse granting President/VP/Treasurer to a contact already holding one of the three, exactly as the API does: the invariant is a property of the data, not of one screen (FR-033). *(Writing `role_grants` and accepting `--role super_user` already landed at T010 — it was a compile break, not deferrable.)* It remains the **sole** path to Super-user (FR-030a). (FR-005a, FR-030a, FR-033)

**Checkpoint**: The club can operate the system without a terminal.

---

## Phase 5: User Story 3 — Field-level authority inside a shared record (Priority: P3)

**Goal**: The split runs *through* the record. A Webmaster writes an event's blurb, not its date.

**Independent Test**: Submit mixed permitted/forbidden fields of one record as each role; permitted persist, forbidden refuse.

### Tests for User Story 3 ⚠️ Write FIRST, confirm they FAIL

- [ ] T051 [P] [US3] `tests/integration/authz.fields.test.ts` — Webmaster edits an event's public description (succeeds) and its date/venue (**refused**); the Booker of that series edits date/venue (succeeds). (US3.1–2, FR-021)
- [ ] T052 [P] [US3] `tests/integration/authz.fields.test.ts` — a Door Attendant's check-in persists comp/gift counts but is refused the door record's cash/card/deposit. (US3.3, FR-021)
- [ ] T053 [P] [US3] `tests/integration/authz.fields.test.ts` — VP/MLM edit a contact's emails and consent topics (succeeds) and its membership record (**refused**); a Door Attendant creates a contact at check-in (succeeds). (US3.4–5, FR-023)
- [ ] T054 [P] [US3] `tests/integration/authz.fields.test.ts` — **FR-022**: a submission mixing permitted and forbidden fields is **refused entirely**, with no partial application. Assert the permitted field did **not** persist. (US3.6, SC-009)

### Implementation for User Story 3

- [ ] T055 [US3] Add `src/server/auth/fields.ts` — `assertFields(actor, entity, input)` throwing `FIELD_NOT_PERMITTED`. Check **key presence**, not value change: a submission carrying an unchanged `eventDate` is still an attempt to write a field the actor does not own, and treating "unchanged" as permitted makes authorization depend on current data. (FR-021, FR-022)
- [ ] T056 [US3] Wire `assertFields` into the **event** service (public fields vs. date/venue) and the **door record** service (money vs. comp/gift counts). (FR-021, SC-009)
- [ ] T057 [US3] Wire `assertFields` into the **contact** services — record/membership side vs. mailing side (emails, consent topics). Row 17 stands: the Door Attendant creates records; VP/MLM own the mailing side. (FR-023)

**Checkpoint**: Matrix rows 2, 12, and 17/17a are expressible and enforced.

---

## Phase 6: User Story 4 — PII on lookup, names in bulk (Priority: P3)

**Goal**: Identifying one person is the job; enumerating the membership is not.

**Independent Test**: As a Door Attendant, search a named dancer (PII present); list the roster (names only).

### Tests for User Story 4 ⚠️ Write FIRST, confirm they FAIL

- [ ] T058 [P] [US4] `tests/integration/authz.pii.test.ts` — a base-only volunteer receives **zero** emails/phones from **every** path: contact screens, `attendance/search`, `exports/*`, `exports/contact-tracing`, `dedup/suggestions`, and performers (which reach contacts via `performers.contact_id`). Enumerate all six — this is the leak surface FR-016 names. (US4.3, FR-016, SC-004)
- [ ] T059 [P] [US4] `tests/integration/authz.pii.test.ts` — a Door Attendant matching a dancer sees that dancer's PII; the checked-in roster returns PII for **0%** of rows. (US4.1–2, FR-017, SC-010)
- [ ] T060 [P] [US4] `tests/integration/authz.pii.test.ts` — **FR-017a**: VP/MLM see **all** PII on every dedup candidate pair. The sanctioned bulk view — comparing emails *is* the task. (FR-017a)
- [ ] T061 [P] [US4] `tests/integration/authz.pii.test.ts` — **FR-016a**: PII-read rides implicitly on Door Attendant / VP / MLM / Secretary / Booker / Treasurer / FS, and is **not** separately grantable. (FR-016a)
- [ ] T062 [P] [US4] `tests/integration/authz.audit.test.ts` — **FR-017b**: a PII-disclosing request writes **exactly one** `pii.disclosed` row carrying a **count**, never one row per contact. Assert a 20-result search yields 1 row, not 20. (FR-017b, SC-014)

### Implementation for User Story 4

- [ ] T063 [US4] Add `src/server/auth/pii.ts` — `projectContact(actor, contact)` dropping `phone` and emails unless `contact.pii.read`. One helper at the service boundary; a per-route filter would be the same rule restated ~7 times, and new routes would default to leaking (R7). (FR-016, FR-016a)
- [ ] T064 [US4] Apply `projectContact` across every reader in T058's list, and mark the **dedup review** surface as the FR-017a exception. Audit every contact read path rather than the obvious ones — `contacts.phone` is a column on the row and emails are a joined table. (FR-016, FR-017, FR-017a)
- [ ] T065 [US4] Emit `pii.disclosed` at **request** granularity with a count (FR-017b) — never per contact: check-in search fires per keystroke over 20 candidates, and per-contact rows would make this the largest table in the database while answering nothing SC-014 asks. (FR-017b, SC-014)

**Checkpoint**: The PII rule holds on every path, and a harvest is detectable in SQL.

---

## Phase 7: User Story 5 — You see only what you may use (Priority: P4)

**Goal**: Nobody is invited into a page that will refuse them. `/dev/routes` stops being hand-maintained.

**Independent Test**: Sign in as several grant-holders; nav offers exactly what their grants permit — and a hidden destination is still refused when requested directly.

### Tests for User Story 5 ⚠️ Write FIRST, confirm they FAIL

- [ ] T066 [P] [US5] `tests/integration/authz.nav.test.ts` — a Door Attendant's nav offers check-in and reports but not role assignment or club settings; a Treasurer's offers the gate and treasurer screens as writable. (US5.1–2, FR-039)
- [ ] T067 [P] [US5] `tests/integration/authz.nav.test.ts` — a destination hidden from nav is **still refused** when requested directly. Hiding is presentation, not a control. (US5.3, FR-039)

### Implementation for User Story 5

- [ ] T068 [US5] Derive navigation from the actor's capabilities in `src/app/(admin)/layout.tsx` and `src/app/(door)/layout.tsx`. (FR-039)
- [ ] T069 [US5] Extract the route walker to `src/server/lib/routeInventory.ts` — enumerate UI pages (`page.tsx` under `src/app`) and API endpoints (`route.ts` under `src/app/api`) **from the source tree**, returning each endpoint's exported methods and their declared `requires`. **Shared with `auth.routeInventory.test.ts`** (T038), which becomes its caller: the test proves the enumeration finds every route, and the page renders the same enumeration — one walker, so the index cannot disagree with the guard. (FR-040a)
- [ ] T069a [US5] Rewrite `src/app/dev/routes/page.tsx` to render `routeInventory` instead of its two hand-written arrays, showing each endpoint's declared requirement so the enforced matrix is directly inspectable. Gate it on **`dev.routes.read`** (Super-user only) — **never** an inline `role === 'super_user'` check, which would be a second authorization mechanism beside the catalog (FR-040b). ⚠️ The page is **kept, not deleted**: nav replaces it for *pages*, but the ~44 API endpoints have no nav home, and enumerating those is the index's actual job. The defect was only ever the hand-maintenance. (FR-040, FR-040a, FR-040b, SC-013)
- [ ] T069b [P] [US5] `tests/integration/authz.nav.test.ts` — a Super-user reaches `/dev/routes`; a Treasurer, a Door Attendant and a base-only volunteer are all **refused**. A newly added route appears **with no edit to any list** (add a throwaway route file in the test, or assert the walker's count against a filesystem count). (FR-040a, FR-040b, SC-013)
- [ ] T070 [US5] Remove the **Route index** upkeep convention from `CLAUDE.md`. The page survives (T069a) but is now generated, so the instruction to hand-edit it must go in the same change — otherwise it tells the next contributor to maintain arrays that no longer exist. (FR-040, SC-013)

**Checkpoint**: All five stories are independently functional.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T071 Run the full [quickstart.md](quickstart.md) validation, including all 9 hand-driven scenarios and the SC-014 SQL. Scenario 2 (Door Attendant reads the gate) and scenario 3 (base reads individual pay) both look like bugs — confirm they are the spec.
- [ ] T072 [P] Update `specs/DATA_MODEL.md` — `role_grants`, `audit_events`, the `contacts` changes, and the **removal** of `volunteer_roles`.
- [ ] T073 [P] Update `docs/use-cases.md` — the "does not enforce any of this yet" caveat is now false; authorization ships here.
- [ ] T074 [P] Update `specs/PHASE3_REQUIREMENTS.md` — P3-2 status → shipped; P3-3/P3-4 unblocked.
- [ ] T075 [P] Refresh auto-memory — `zak1-implementation-status` (016 shipped, new test count), `zak1-phase3-roles` (P3-2 done, P3-3 next); add a note that the audit trail is now a table.
- [ ] T076 Full green gate: `pnpm test`, `pnpm exec tsc --noEmit`, `pnpm run lint`, `pnpm exec prettier --check .`. Confirm **`tests/integration/auth.public.test.ts` (inherited from 015) is still green** — it is what guards FR-018, and this feature's coverage of "the public site stays open" is that test, deliberately rather than by luck.
- [ ] T077 Re-verify the Constitution Check in [plan.md](plan.md) against what was actually built; record any drift.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies. **T001 blocks T005** — it is the only rollback.
- **Foundational (Phase 2)**: needs Setup. **BLOCKS every story.**
- **User stories (Phases 3–7)**: need Foundational.
- **Polish (Phase 8)**: needs the stories you intend to ship.

### Story Dependencies — honest note

The template's ideal is fully independent stories. These are **not**, and pretending otherwise would
mis-sequence the work:

- **US1** is the MVP and stands alone (grants seeded via T021).
- **US2** depends only on Foundational's schema, **not on US1's enforcement** — it can genuinely run in
  parallel with US1.
- **US3** and **US4** *refine* US1's enforcement rather than standing beside it: they need the evaluator
  (T017) and are separable from each other, but shipping either without US1 would be incoherent.
- **US5** needs the catalog (T015) only. It is cosmetic and deliberately last — **hiding a link is not a
  security control**, and US1/US3 already deny the underlying action.

### Within Each Story

Tests first, confirmed failing for the right reason → services → routes → UI.

### Parallel Opportunities

- T006/T007 (different schema files); T014/T016; T018/T020/T021.
- **T030–T034** — five route-declaration tasks across disjoint directories, the phase's widest fan-out.
- All test tasks within a story ([P]) — they are separate assertions, mostly separate files.
- T072–T075 (four different documents).

---

## Parallel Example: User Story 1

```bash
# Tests first — all [P], write together, confirm ALL fail:
Task: "T022 scope: series allow/deny, supersets, base read-only"
Task: "T023 scope: group crosses series, denied outside the group"
Task: "T024 boundaries: Door Attendant reads gate, never writes"
Task: "T025 base reads treasurer report + individual performer pay"
Task: "T028 refusal is 403 naming the capability, and is audited"

# Then the route declarations — disjoint directories:
Task: "T030 events/event-groups/series"
Task: "T031 venues/performers/bands/bookings/parameters"
Task: "T032 door-records/treasurer/qbo"
Task: "T033 attendance/check-in"
Task: "T034 contacts/dedup/exports/memberships"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 Setup — **snapshot first** (T001).
2. Phase 2 Foundational — **T020 before any enforcement**, or ~291 tests fail.
3. Phase 3 US1.
4. **STOP and VALIDATE**: quickstart scenarios 1–5. Authority is real; grants still come from the CLI.

### Incremental Delivery

1. Setup + Foundational → the substrate exists, suite still green (nothing enforces yet).
2. **US1** → enforcement is real → the MVP.
3. **US2** → the club can operate without a terminal (in practice the first thing they'll *feel*).
4. **US3 + US4** → field-level authority and the PII rule.
5. **US5** → nav, and `/dev/routes` retires.

### Parallel Team Strategy

After Foundational: Developer A on **US1** (the widest), Developer B on **US2** (genuinely independent).
US3/US4 join once T017 lands. US5 last, by anyone.

---

## Notes

- **[P]** = different files, no dependencies on incomplete tasks.
- Verify every test fails **for the right reason** before implementing — a test that passes immediately is
  testing nothing (and with T020 seeding a Super-user, a mis-scoped test passes very convincingly).
- Commit per task or logical group; one atomic commit for the feature, direct to `main`.
- **Two things that look like bugs and are the spec**: a Door Attendant reading gate money (FR-015/020) and
  a base-only volunteer reading individual performer pay (FR-015). The club holds that pay secrecy enables
  performers to be exploited. Do not "fix" either.
