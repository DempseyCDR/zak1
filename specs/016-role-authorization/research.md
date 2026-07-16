# Phase 0 Research: Authorization — Role × Capability × Scope

**Feature**: 016-role-authorization · **Date**: 2026-07-15 · **Spec**: [spec.md](spec.md)

Resolves every unknown in the plan's Technical Context. Two findings (**R8**, **R12**) are not visible
from the spec text and materially change the work; they are flagged where they arise and reflected in the
plan's Summary.

---

## R1 — Grant storage: a `role_grants` table

**Decision**: A new `role_grants` table. **Drop** `contacts.volunteer_roles` and the `volunteer_role`
enum; they become the table's rows.

**Rationale**: The array is a dead end. It cannot carry scope, and scope is the whole feature: FR-005
requires one contact to hold *the same role at several scopes* (Booker-of-ecd **and** Booker-of-tnc), which
a `role[]` cannot express without encoding structure into strings. FR-008 requires scope to vary *per
capability*. Keeping the array **alongside** the table would be worse than either alone — two sources of
truth for the same question, and `roles_require_volunteer` guarding only one of them.

The array is also barely load-bearing today: two enum values, **one holder** (`administrator`), and no UI
that writes it. Migrating one row is cheaper than living with the ambiguity.

**Alternatives considered**:

- *Encode scope into the array* (`'booker:ecd'`): rejected — no FK integrity, no constraints, unqueryable,
  and it reinvents a join table in string syntax.
- *Keep the array for club-wide roles, add a table for scoped ones*: rejected — the same question answered
  in two places is exactly the defect this avoids.

---

## R2 — Scope: two nullable FKs, not a polymorphic pointer

**Decision**: `role_grants.series_id` and `role_grants.group_id`, both nullable FKs, with
`CHECK (num_nonnulls(series_id, group_id) <= 1)`. **Club-wide is both NULL.**

**Rationale**: Three granularities (FR-006) map onto exactly three states of two nullable columns — the
constraint *is* the model. And because they are real foreign keys, the "grant names a deleted series"
edge case resolves itself: the FK refuses the delete rather than leaving a dangling id that some later
`WHERE scope_id = ...` silently fails to match. That matters more than it looks: the spec's own edge case
warns the grant "must not silently widen into club-wide authority", and **club-wide is the NULL state
here** — a polymorphic `scope_id` set to NULL on a cascade would do precisely the forbidden thing and
promote a series grant to club-wide.

FR-007 is explicit that scope is **not** a tree and must be evaluated as a *set of filters (series OR
group)*. Two columns say that structurally. One `scope_id` column implies a uniform hierarchy the model
spent three paragraphs denying.

**Alternatives considered**:

- *`scope_type` enum + `scope_id` uuid*: rejected — no referential integrity (a uuid pointing at two
  tables cannot be an FK), and it models scope as one axis when the spec insists on two orthogonal ones.
  It is the shape you would choose if scope *were* a tree.
- *Separate tables per scope kind*: rejected — three near-identical tables, and every read becomes a
  three-way UNION.

---

## R3 — `roles_require_volunteer` becomes transactional, not a CHECK

**Decision**: Enforce "only a volunteer may hold grants" in the **service layer**, and make FR-028b's
cascade (clear designation → revoke all grants) a **single transaction**. No trigger.

**Rationale**: Feature 001's `CHECK (is_volunteer OR array_length(volunteer_roles, 1) IS NULL)` worked
because roles were a *column on the same row*. Across two tables, only a trigger can express it, and this
codebase has no triggers anywhere.

The invariant is already enforced twice over: `readSession` re-checks `contacts.is_volunteer` on a live
join every request (015's FR-011 mechanism), so a grant held by a non-volunteer evaluates to **denied**
regardless. It is unusable, not dangerous.

⚠️ **But the transaction is load-bearing, not a nicety.** If clearing the designation succeeded and the
cascade failed, the orphaned grants would linger — and re-designating that person a volunteer later would
**silently restore their old authority**, which is exactly what FR-028b forbids. The atomicity is what
makes "never silently restored" true. This is the one place where a partial write produces a security
outcome rather than a mess.

**Alternatives considered**:

- *`AFTER UPDATE` trigger on `contacts`*: rejected — introduces a mechanism the codebase has none of, to
  guard an invariant already guarded by the live join and the transaction. Reconsider only if a second
  non-transactional writer of `is_volunteer` ever appears.
- *Rely on the live join alone, no cascade*: rejected — violates FR-028b outright.

---

## R4 — The capability catalog lives in code, not the database

**Decision**: A static, exhaustive map: `role → capability → scopeMode`, where
`scopeMode ∈ { scoped, global }`. `scoped` honours the grant's own series/group; `global` confers the
capability everywhere regardless of the grant's scope.

**Rationale**: `global` exists for exactly one case in the spec and it is a real one — FR-008's Mailing
List Manager, per-series for *managing* its list but cross-series for *exports*. One flag expresses
"scope varies per capability, not per role" without a second scope model.

Capabilities belong in code because they are referenced *by* code: `event.write` means something only
because a handler checks it. A DB-driven catalog would let an officer grant a capability no code
implements — an admin surface whose only power is to lie.

**Alternatives considered**:

- *Capability table in Postgres*: rejected — YAGNI. There is no requirement to add a capability without a
  deploy, and the catalog must stay in lockstep with the handlers that honour it.
- *Roles check themselves inline* (`if (role === 'booker')` at each site): rejected — this is the
  role×capability indirection the spec exists to introduce; inlining roles at ~44 call sites is how the
  matrix rots.

---

## R5 — Enforcement attaches in two layers

**Decision**:

1. **Route layer** — `withAuth({ requires }, handler)`, where `Requirement = Capability | 'base'`. The
   wrapper verifies the actor holds that capability *at some scope*. Cheap, fails fast, and **guarded by an
   extended inventory test** (R13). **`'base'` is mandatory, not an omission** — 28 of 41 non-auth routes
   export a `GET` that FR-015 makes universal, and a route that could stay silent would be
   indistinguishable from one where someone forgot, which is exactly what the guard exists to catch.
   `'base'` is *not* a `Capability` and never enters the catalog: an `event.read` held by every role would
   be the constant `true` R4 rejects, and would imply the Organizer base is revocable.
2. **Service layer** — `assertScope(actor, capability, target)` where the target is actually known,
   resolving an event to its `{ seriesId, groupId }` and matching against the grant's filters.

**Rationale**: This is 015's own reasoning applied one level down: *an authorization boundary belongs
close to the data*. The wrapper cannot do the scoped check, because for many routes the target is in the
**request body** (`POST /api/events` carries `seriesId`), and a body may only be read once — a
target-resolving wrapper would have to buffer and re-inject every request body in the app.

**Known risk, accepted**: layer 2 can be forgotten in a way layer 1 cannot (no source-level guard is
possible when the check depends on runtime data). Mitigated by per-capability integration tests — US1's
acceptance scenarios *are* that test suite, and SC-002 states the bar as 100% of attempts.

**Alternatives considered**:

- *One wrapper with a target resolver*: rejected — body-buffering every request to authorize a minority of
  them.
- *Scoped check in the route handler rather than the service*: rejected — services are also called by the
  CLI and by other services; the check belongs where the data is touched, not at one of its callers.

---

## R6 — Field-level writes: refuse, never strip

**Decision**: The service compares the **keys present in the input** against the actor's writable field
set for that entity and throws when any is forbidden. New error `FIELD_NOT_PERMITTED` (403).

**Rationale**: FR-022 requires refusal, not silent discard — a Webmaster who submits a date change must be
told, not quietly ignored. The codebase already has the precedent: `errors.readOnlyField(field)` /
`READ_ONLY_FIELD` names the offending field for a structurally identical case.

Checking *presence* rather than *value change* is deliberate: a submission carrying `eventDate` unchanged
is still an attempt to write a field the actor does not own, and treating "unchanged" as permitted would
make authorization depend on current data.

**Alternatives considered**:

- *Per-role Zod schemas*: rejected — the field→capability matrix would be duplicated across a schema per
  role per entity, and Zod would strip unknown keys rather than refuse them (FR-022's exact failure).
- *Diff against current values and allow no-ops*: rejected — see above.

---

## R7 — PII read: one projection at the service boundary

**Decision**: A single projection helper. Contact-shaped readers return PII only when the actor holds
`contact.pii.read` (FR-016a); the **dedup review surface is the sanctioned bulk exception** (FR-017a).

**Rationale**: FR-016 lists the leak paths explicitly and they are not just the contact screens —
`attendance/search`, `exports/*`, `exports/contact-tracing`, `dedup/suggestions`, and performers (which
reach contacts via `performers.contact_id`). A projection at each *route* would be seven places to forget;
at the service boundary it is one.

**Field-level *read* is heavier than field-level write** and the plan should not pretend otherwise:
`contacts.phone` is a column on the contact row and emails are a joined table, so every contact read path
must be audited, not just the ones a reviewer thinks of.

**Alternatives considered**:

- *Filter in the route handlers*: rejected — same rule restated ~7 times, and new routes default to
  leaking.
- *A Postgres view or RLS*: rejected — the app connects as one role; RLS would need a per-request session
  variable, a mechanism this codebase does not have, to solve a problem one function solves.

---

## R8 — ⚠️ Finding: the audit trail is log lines, and SC-014 requires a table

**Decision**: Introduce an **`audit_events` table**. `writeAudit` writes a row **and** keeps its structured
log line.

**Rationale**: `src/server/lib/audit.ts` currently only calls `logger.info({ audit: true, ... })`. Its own
comment says the quiet part out loud: *"For the MVP the audit sink is the structured log; dedicated audit
tables are introduced with those stories."* **This is that story.** SC-014 requires that *"which volunteer
saw the most contacts' PII last month, and how many"* be answerable **without scanning application logs**,
and FR-032 requires grants and revocations to be recorded with actor, subject, role, scope, and timestamp.
Neither is satisfiable against a log stream.

This is real scope the spec does not name and the reader would not infer — surfaced here rather than
discovered during `/speckit-implement`. It is not scope creep: three separate requirements (FR-017b,
FR-032, SC-014) are unimplementable without it.

**Alternatives considered**:

- *Keep logs only*: rejected — fails SC-014 as written.
- *A PII-disclosure table only, leaving other audit kinds in logs*: rejected — two audit sinks with one
  `writeAudit` API, and the grant/revoke trail (FR-032) would still be in logs.

### ⚠️ Revised during implementation (2026-07-15) — "signature unchanged" was impossible

This entry claimed *"`writeAudit` writes a row and keeps its structured log line. Existing callers are
unchanged — the signature is already `{ kind, actor, details }`."* Both halves were wrong, and the code
says so:

1. **A database write is async.** `writeAudit` is synchronous and `void`-returning, called from **31 sites
   across 10 transactional files**. It cannot grow a row-write without becoming async and being awaited at
   every one of them — several of which have no `db`/`tx` handle in scope.
2. **`actor` is free text, not a contact.** Call sites pass `"admin"` (from an `x-actor` header default),
   `"operator"` (bootstrap), *and* sometimes a real uuid. An `actor_contact_id uuid REFERENCES contacts(id)`
   would reject the first two outright.

**Revised decision**: add **`recordAudit(db, event)`** — async, writes the row **and** logs — and leave
`writeAudit` as the log-only legacy path. Every kind the requirements actually need in the table
(`authz.grant.created`/`.revoked`, `authz.refused`, `volunteer.*`, `pii.disclosed`) is emitted from a
signed-in request with a real `contactId`, so the FK is correct for all of them.

**This is knowingly the "two sinks" outcome R8 rejected above**, and the objection stands on its merits —
so it is answered in the code rather than waved away: the rule is *"if you have an Actor and a `db` handle,
use `recordAudit`; `writeAudit` is the legacy log-only path being retired."* Retrofitting all 31 sites
means threading `db` into functions that lack it and converting `actor` from free text to a uuid — a large
refactor **no requirement asks for**, which Principle II (YAGNI) actively forbids. Legacy kinds migrate
when their own features next touch them.

---

## R9 — Roles enum and the `administrator` → Super-user migration

**Decision**: New `role` enum with the **ten grants** of FR-003 — `door_attendant`, `booker`,
`financial_secretary`, `treasurer`, `vice_president`, `webmaster`, `mailing_list_manager`, `secretary`,
`president`, `super_user`. **Organizer is not in it**: FR-001 makes it the implicit base held by every
authenticated volunteer, not a grant. A row saying "organizer" would be a lie the evaluator must then
special-case.

Migration: keep the data-driven `INSERT ... SELECT ... WHERE 'administrator' = ANY(volunteer_roles)`; then
drop `contacts.volunteer_roles`, the `volunteer_role` enum, and the `roles_require_volunteer` CHECK.

⚠️ **Corrected 2026-07-15 against the live database.** This entry originally said "the single
`administrator` holder becomes `role_grants(super_user, club-wide)`". **There is no holder.** Zero contacts
hold *any* `volunteer_role`: `bootstrapOfficer`'s `--role` flag is optional
(`src/server/db/bootstrapOfficer.ts:26`) and feature 015 bootstrapped the one volunteer without it. The
`INSERT ... SELECT` migrates **zero rows** — which is correct, and is why it stays data-driven rather than
hardcoding a contact id into a schema migration that also runs against `zak1_test` and every future
environment.

**Rationale**: after 0021 nobody holds a grant, so the club's first Super-user comes from the operator CLI
(FR-033) as a separate audited step. That path must exist regardless (FR-030a makes it the *only* source of
a Super-user), so the cold start costs nothing extra. **This is the designed path, not a fallback.**

**Alternatives considered**:

- *`ALTER TYPE ... RENAME VALUE 'administrator' TO 'super_user'`*: rejected — the enum is being dropped
  wholesale anyway; renaming a value on a type with no remaining users is ceremony.
- *Include `organizer` as a grantable role*: rejected — see above; it would also let someone *revoke* the
  base, which FR-001 does not contemplate.

---

## R10 — Annual approval: two columns plus the audit trail

**Decision**: `contacts.volunteer_approved_at timestamptz NULL` and `contacts.volunteer_approved_by uuid
NULL REFERENCES contacts(id)`. Overdue = `volunteer_approved_at IS NULL OR < now() - interval '1 year'`.
History lives in `audit_events` (R8).

**Rationale**: FR-034 asks for *last* approved and by whom — a scalar fact per volunteer, which is two
columns. FR-035's "recording the approval" is history, and R8 already builds the place history goes.

**Alternatives considered**:

- *A `volunteer_approvals` history table*: rejected — YAGNI. It would duplicate `audit_events`, and no
  requirement asks to query approval history relationally.

---

## R11 — Refusals: a new 403, distinct from 015's 401

**Decision**: New `ApiError` code **`UNAUTHORIZED` (403)** whose message names the refused capability.
Pages render a shared "not authorized" view rather than redirecting.

**Rationale**: 401 (`UNAUTHENTICATED`) already means "no valid session" and is deliberately uninformative
— 015 made it say nothing about *why*, because anyone could probe it unauthenticated. **403 is the
opposite case and takes the opposite posture** (FR-026): the actor is a known volunteer who, under FR-015,
could already *read* the thing they were refused. Concealment protects nothing and costs them the ability
to understand what happened. The one carve-out is FR-026a: never render PII in the message.

Redirecting (015's treatment of *unauthenticated*) is wrong here: it would look like a navigation glitch
for a user who is correctly signed in.

**Alternatives considered**:

- *Reuse 401*: rejected — conflates "sign in" with "you may not do this"; the client cannot tell whether
  to re-authenticate.
- *404 the resource*: rejected — the actor can read it (FR-015), so it would be a visible lie.

---

## R12 — ⚠️ Finding: the test harness's standing staff has no grants

**Decision**: `seedTestStaff()` gains a **club-wide `super_user` grant**. Authorization tests build their
own scoped actors with a factory.

**Rationale**: `tests/integration/helpers/db.ts` seeds "Zztest Staff" as `isVolunteer: true` with **no
roles**, and `jsonReq` attaches that session to every request. Under this feature that actor holds only the
Organizer base — which **writes nothing**. Every write test in the suite would fail: **~291 tests across
112 files**, none of them about authorization.

Granting the harness Super-user is the smallest change that keeps those tests testing what they are about.
It is also exactly the move 015 made and for the same reason: it chose to *seed a real session* rather than
add a test-mode bypass, because a bypass means the protection is never exercised. The same logic applies
one level up — the harness should hold real authority, not skip the check.

**Alternatives considered**:

- *A test-mode authorization bypass*: rejected on 015's precedent — it would mean never testing
  authorization in the 291 tests that touch protected routes.
- *Grant the harness every role individually*: rejected — FR-005a makes President+Treasurer **illegal**, so
  "all roles" is not even a valid state. Super-user is the only coherent "can do anything" actor, which is
  what it is for.

---

## R13 — Extend the route inventory guard to capabilities

**Decision**: Extend `tests/integration/auth.routeInventory.test.ts` so every non-auth route must
**declare a requirement** — a capability or an explicit `'base'` — not merely be wrapped in `withAuth`.

**Rationale**: The existing test is the best pattern in the codebase — a source-level invariant that is
*self-maintaining*: add route 45 without protection and it fails immediately, with no list to update. R5's
layer 1 is declarative, so the same trick extends to it for free. Without this, "default-deny per
capability" (FR-013/FR-019) degrades to a convention that holds until someone forgets.

**Alternatives considered**:

- *Enumerate route→capability expectations in the test*: rejected — a hand-maintained list of 44 paths is
  what the existing test's comment explicitly refuses to become.

---

## R14 — Role-aware navigation and retiring `/dev/routes`

**Decision** *(revised 2026-07-15)*: Derive the nav from the actor's capabilities. **Keep**
`src/app/dev/routes/page.tsx`, but **generate it from the source tree** and gate it on `dev.routes.read`
(Super-user only). Remove the upkeep convention from `CLAUDE.md`.

**Rationale**: the original decision — delete the page — assumed nav replaces it. It does not. Nav lists
**pages**; the index lists *"every UI page **and API endpoint**"*, and the ~44 endpoints have no nav home,
so deleting it destroys the endpoint inventory for everyone including the Super-user. The defect was only
ever the **hand-maintenance**, so that is what retires. Generating from the filesystem also makes the list
unfalsifiable-by-neglect: a new route appears with no edit.

The page and `auth.routeInventory.test.ts` (R13) then **share one walker** — the test proves the
enumeration finds every route, and the page renders the same enumeration, including each endpoint's
declared requirement. That makes the enforced matrix directly inspectable, which the hand-written list
never did.

**Alternatives considered**:

- *Delete the page (the original R14)*: rejected — see above; it solves upkeep by removing the tool.
- *Gate on `role === 'super_user'` inline*: rejected — a second authorization mechanism beside the
  catalog, and the only place a role would be inlined at a call site (R4).

FR-039 is presentation only: a hidden destination is still refused when requested directly (US5 scenario
3). The nav is a courtesy, not a control, and the plan should not let it be mistaken for one.

---

## Resolved unknowns summary

| # | Unknown | Resolution |
|---|---|---|
| R1 | Grant storage | `role_grants` table; drop the array |
| R2 | Scope columns | two nullable FKs + `num_nonnulls` CHECK; club-wide = NULL |
| R3 | `roles_require_volunteer` across tables | service enforcement + **transactional** cascade; no trigger |
| R4 | Capability catalog | static map in code; `scoped` / `global` per capability |
| R5 | Enforcement placement | route declares capability; service asserts scope |
| R6 | Field-level writes | refuse on key presence; `FIELD_NOT_PERMITTED` 403 |
| R7 | PII read | one projection helper at the service boundary |
| **R8** | **Audit sink** | **⚠️ `audit_events` table — logs cannot satisfy SC-014** |
| R9 | Role enum + rename | 10-value enum, no `organizer`; migrate the one `administrator` |
| R10 | Annual approval | two columns + audit history |
| R11 | Refusal shape | `UNAUTHORIZED` 403 naming the capability |
| **R12** | **Test harness** | **⚠️ seed Super-user, or ~291 tests fail** |
| R13 | Capability coverage | extend the self-maintaining inventory guard |
| R14 | Nav + `/dev/routes` | derive from capabilities; delete page **and** convention |

**No NEEDS CLARIFICATION remain.** The spec entered this phase with zero open questions; R8 and R12 are
findings about the *codebase*, not gaps in the spec.
