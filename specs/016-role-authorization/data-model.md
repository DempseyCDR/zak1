# Phase 1 Data Model: Authorization — Role × Capability × Scope

**Feature**: 016-role-authorization · **Date**: 2026-07-15 · **Spec**: [spec.md](spec.md) ·
**Research**: [research.md](research.md)

Migration **`0021_role_authorization.sql`** (latest today is `0020_staff_auth.sql`). Schema files land in
`src/server/db/schema/`.

---

## 1. What changes

| Object | Change |
|---|---|
| `role` enum | **NEW** — the ten grants of FR-003 |
| `grant_scope` | *(not a type — expressed structurally; see §3)* |
| `role_grants` | **NEW** — the unit the President/VP issues and revokes |
| `audit_events` | **NEW** — R8; the audit trail becomes queryable |
| `contacts.volunteer_approved_at` / `_by` | **NEW** columns — FR-034 |
| `contacts.volunteer_roles` | **DROPPED** — becomes `role_grants` rows |
| `volunteer_role` enum | **DROPPED** — replaced by `role` |
| `roles_require_volunteer` CHECK | **DROPPED** — re-expressed transactionally (R3) |

---

## 2. `role` enum

```text
door_attendant · booker · financial_secretary · treasurer · vice_president
webmaster · mailing_list_manager · secretary · president · super_user
```

**Ten values, not eleven.** `organizer` is deliberately absent: FR-001 makes the Organizer the **implicit
base** held by every authenticated volunteer. A grant row saying "organizer" would be a fact the evaluator
must then ignore — and worse, would make the base *revocable*, which FR-001 does not contemplate.

`administrator` is gone; its one live holder migrates to `super_user` (FR-013, §7).

---

## 3. `role_grants`

The assignment of **one role at one scope to one volunteer contact**. A contact may hold many (FR-005).

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | `defaultRandom()` |
| `contact_id` | `uuid` NOT NULL → `contacts(id)` ON DELETE CASCADE | The person *is* a contact (015) |
| `role` | `role` NOT NULL | §2 |
| `series_id` | `uuid` NULL → `series(id)` | Set ⇒ per-series scope |
| `group_id` | `uuid` NULL → `event_groups(id)` | Set ⇒ per-event-group scope |
| `granted_by` | `uuid` NULL → `contacts(id)` | NULL ⇒ granted by the operator CLI |
| `granted_at` | `timestamptz` NOT NULL | `defaultNow()` |

### Constraints

```sql
CONSTRAINT grant_scope_exclusive CHECK (num_nonnulls(series_id, group_id) <= 1)
CONSTRAINT role_grants_unique UNIQUE NULLS NOT DISTINCT (contact_id, role, series_id, group_id)
```

⚠️ **`NULLS NOT DISTINCT` is load-bearing — corrected 2026-07-15, caught by T004.** This section
originally specified a plain `UNIQUE` plus a partial index for the club-wide case, on the reasoning that
"Postgres treats NULLs as distinct, so club-wide duplicates escape the plain UNIQUE". That was right
about the mechanism and **wrong about the blast radius**: `grant_scope_exclusive` guarantees at least one
of `(series_id, group_id)` is **always** NULL, so *every possible row* has a NULL in the key and **the
plain UNIQUE would have caught nothing at all** — per-series `(c,r,sid,NULL)` and per-group
`(c,r,NULL,gid)` duplicates included, not just club-wide ones. `NULLS NOT DISTINCT` (Postgres 15+; we run
16) treats NULLs as equal and covers all three shapes with one constraint, which makes the partial index
redundant. It still permits the same role at two different series (FR-005) — those rows genuinely differ.

**Scope is the shape of the row, not a column.** Three granularities (FR-006) are exactly three states of
two nullable columns:

| `series_id` | `group_id` | Scope |
|---|---|---|
| NULL | NULL | ⬡ club-wide |
| set | NULL | ⬤ per-series |
| NULL | set | ⬢ per-event-group |

Both set is barred by the CHECK. **⬢ and ⬤ are orthogonal** (FR-007) — this is why they are two columns
and not one `scope_id`: a group grant reaching an event in a series the holder has no authority over is
*intended*, and two independent filters say that structurally.

> ⚠️ **Why real FKs matter here.** The spec's edge case warns a grant "must not silently widen into
> club-wide authority" if its scope target is deleted. **Club-wide is the NULL state.** A polymorphic
> `scope_id` with `ON DELETE SET NULL` would perform exactly the forbidden promotion — silently turning
> Booker-of-ecd into Booker-of-everything. With real FKs the default is `NO ACTION`: the delete is refused
> while grants reference it. There is no delete path for series or event groups today, so this is
> insurance, not behavior.

`role_grants_unique` makes re-granting idempotent and stops the same grant being issued twice, at every
scope shape. `bootstrapOfficer` relies on it via `ON CONFLICT DO NOTHING`.

### What is NOT constrained

- **No uniqueness on `(role)` or `(role, series_id)`.** FR-005c: **two people may hold President.**
  Unlikely, explicitly permitted, and *no uniqueness constraint may be added*. Recorded here because
  one-President-at-a-time feels self-evidently right and someone will try.
- **No CHECK for FR-005a** (President/VP/Treasurer mutual exclusivity). It is a cross-row invariant on
  `contact_id` and cannot be a row CHECK. Enforced in the service and by **every** write path including
  the CLI (FR-033); see §6.
- **No CHECK that `contact_id` is a volunteer** — cross-table; R3.

---

## 4. `audit_events` (R8)

The audit trail stops being log lines. Required by FR-017b, FR-032, and SC-014 (*"answerable without
scanning application logs"*).

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | `defaultRandom()` |
| `kind` | `text` NOT NULL | The existing `AuditEvent['kind']` union |
| `actor_contact_id` | `uuid` NULL → `contacts(id)` | NULL for system/CLI actors |
| `details` | `jsonb` NOT NULL | `default '{}'` |
| `occurred_at` | `timestamptz` NOT NULL | `defaultNow()` |

Indexes: `(occurred_at)`, `(kind, occurred_at)`, `(actor_contact_id, occurred_at)` — SC-014's question is
*"which volunteer, last month, how many"*, which is the third index plus a `details` aggregate.

`kind` is `text`, not an enum: the union already has ~35 values and grows every feature. An enum would mean
an `ALTER TYPE` per feature for a column nothing joins on.

**New kinds** this feature adds:

```text
authz.grant.created · authz.grant.revoked · authz.refused
volunteer.designated · volunteer.cleared · volunteer.approved
pii.disclosed
```

`pii.disclosed` carries `{ surface, count }` — **per request, never per contact** (FR-017b). Check-in
search fires per keystroke over up to 20 candidates; per-contact rows would make this table the largest in
the database by an order of magnitude and buy nothing SC-014 asks for.

`writeAudit` keeps its log line **and** writes a row. Existing callers are unchanged — the signature is
already `{ kind, actor, details }`.

---

## 5. `contacts` — annual approval (FR-034)

| Column | Type | Notes |
|---|---|---|
| `volunteer_approved_at` | `timestamptz` NULL | NULL ⇒ never approved ⇒ overdue |
| `volunteer_approved_by` | `uuid` NULL → `contacts(id)` | The President/VP who approved |

Overdue (FR-036): `volunteer_approved_at IS NULL OR volunteer_approved_at < now() - interval '1 year'`.

**Advisory only** (FR-037). Nothing in `readSession` or the evaluator reads these columns — that is the
whole point, and the design must keep it true. A future reader tempted to add `AND volunteer_approved_at >
...` to the session join would convert an advisory review into a club-wide lockout on a forgotten meeting.

Dropped in the same migration: `contacts.volunteer_roles`, the `volunteer_role` enum, and the
`roles_require_volunteer` CHECK.

---

## 6. Entities in code

### `Grant`

```text
{ role, seriesId: string | null, groupId: string | null }
```

### `Actor` — the authorization view of a signed-in person

```text
{ staff: CurrentStaff, grants: Grant[] }
```

**Deliberately a new type wrapping `CurrentStaff`, not an extension of it.** 015 wrote that `CurrentStaff`
"carries no roles, scopes, or permissions… the next feature's job, and it will **layer around this rather
than replace it**." `Actor` is that layer. `CurrentStaff` stays identity-only, so
`getCurrentStaff()`/`readSession` remain the answer to "who is signed in?" and nothing else.

Loaded by one indexed query per request (`WHERE contact_id = $1`), alongside the session read. **Live per
request** (FR-014) — no caching: a revoked grant must be gone on the *next* request, and a cache is how
that stops being true.

### `Capability` and the catalog (R4)

```text
Capability  := 'event.write' | 'gate.write' | 'contact.pii.read' | 'role.assign' | …
Requirement := Capability | 'base'          // what a route declares; 'base' = any volunteer (FR-015)
CAPABILITIES: Record<Role, Partial<Record<Capability, 'scoped' | 'global'>>>
```

**`'base'` is a `Requirement`, never a `Capability`** — it is not in the catalog. Most `GET` routes declare
it (28 of 41 non-auth routes export one), because FR-015 makes reading universal. Putting `event.read` in
every role's map instead would be a constant `true` masquerading as a decision, and would imply the
Organizer base is grantable — hence revocable — which FR-001 does not contemplate. See
[contracts/authorization.md](contracts/authorization.md) §1.

`scoped` honours the grant's series/group filters. `global` confers the capability everywhere regardless of
the grant's own scope — FR-008's Mailing List Manager, per-series for *managing* its list, cross-series for
*exports*. One flag, one case, and it keeps "scope varies per capability" out of the scope model itself.

The three supersets (FR-012) are expansions in the catalog, not runtime inheritance: **Treasurer** carries
FS's capabilities, **VP** carries President's, **Super-user** carries everything. Flattening them at the
map means the evaluator has no notion of role hierarchy — which matches FR-004's "authority is the union"
and leaves nothing to get subtly wrong at 3am.

---

## 7. Migration `0021_role_authorization.sql` — order

1. `CREATE TYPE role AS ENUM (...)` — ten values.
2. `CREATE TABLE role_grants` + constraints + indexes (`contact_id`; `contact_id, role`).
3. `CREATE TABLE audit_events` + indexes.
4. `ALTER TABLE contacts ADD volunteer_approved_at, volunteer_approved_by`.
5. **Migrate any `administrator` holders** — before dropping anything:

   ```sql
   INSERT INTO role_grants (contact_id, role)
   SELECT id, 'super_user' FROM contacts WHERE 'administrator' = ANY(volunteer_roles);
   ```

   ⚠️ **This migrates ZERO rows** — verified against live data 2026-07-15. Nobody holds `administrator`;
   nobody holds *any* `volunteer_role`. The statement stays anyway: it is data-driven and correct, it
   documents that the enum was retired rather than silently dropped, and it does the right thing in any
   environment where a holder *does* exist. **It must not be replaced with a hardcoded contact id** — this
   migration also runs against `zak1_test` and every future environment (FR-013).

   Consequence: **after this migration nobody holds a grant.** The first Super-user is bootstrapped from
   the operator CLI (FR-033), which FR-030a makes the only source of one anyway. See §7a.
6. `ALTER TABLE contacts DROP CONSTRAINT roles_require_volunteer`.
7. `ALTER TABLE contacts DROP COLUMN volunteer_roles`.
8. `DROP TYPE volunteer_role`.

### 7a. The cold start (⚠️ read with §7 step 5)

**After 0021, the database contains zero grants.** Every volunteer — including the operator — holds only
the Organizer base: reads everything but contact PII, writes nothing, assigns nothing.

That is not a defect, but it *is* a cliff, and it arrives the moment enforcement lands:

```bash
pnpm run auth:bootstrap -- --email <operator@cdrochester.org> --role super_user
```

FR-030a makes the CLI the **only** source of a Super-user, so this step exists regardless of the migration.
It is audited (`authz.grant.created`) like any other grant. From there the Super-user grants a President
through the UI, and the club is self-sufficient.

⚠️ Steps 6–8 are **destructive and irreversible** — the first non-additive migration in this project
(0015 retired an enum, but no column has been dropped before). Step 5 must run first and must be verified
against `zak1_dev` before the drops, because `volunteer_roles` is the only record of who held
`administrator`. `zak1_dev` holds the user's real demo data (~1335 contacts, 1 volunteer) and **`db:seed`
must never be used to "fix" a bad run** — it TRUNCATEs everything.

---

## 8. Relationships

```text
contacts 1──n role_grants          (contact_id, CASCADE — grants die with the person)
contacts 1──n role_grants          (granted_by, no cascade — history survives the granter)
contacts 1──n audit_events         (actor_contact_id)
contacts 1──1 contacts             (volunteer_approved_by)
series   1──n role_grants          (series_id, NO ACTION — refuses the delete; §3)
event_groups 1──n role_grants      (group_id, NO ACTION)
```

`role_grants.contact_id` cascades because a deleted contact cannot hold authority. `granted_by` does not:
the record of *who granted it* must outlive the granter leaving the club.

---

## 9. State transitions

**A grant**: *(absent)* → **granted** → *(revoked)*. There is no dormant state — FR-028b: grants never
survive their holder's volunteer designation being cleared, so a returning volunteer is re-granted
deliberately rather than silently restored.

**A volunteer's designation**:

```text
not a volunteer  ──designate──▶  volunteer (approved_at = NULL ⇒ overdue)
volunteer        ──approve────▶  volunteer (approved_at = now)
volunteer        ──clear──────▶  not a volunteer   ⚠️ ONE TRANSACTION with revoke-all (R3)
```

The clear transition is the one place a partial write is a **security** outcome rather than a mess: leave
the grants behind and re-designating that person later restores their old authority silently — precisely
what FR-028b forbids. Report-then-confirm (FR-028a) is UI; the transaction is the guarantee.
