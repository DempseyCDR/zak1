# Contract: The Authorization Seam

**Feature**: 016-role-authorization · **Date**: 2026-07-15 · **Spec**: [../spec.md](../spec.md) ·
**Research**: [../research.md](../research.md)

The interface P3-3/P3-4/P3-5 plug into, and the capability catalog that is this feature's real deliverable.
015's `withAuth` answered *"who is signed in?"*; this answers *"may they do this, here?"*.

---

## 1. Capabilities

A capability is a thing a person may do to a resource — **not a page**. Pages are where capabilities are
*used*; the split between them is what makes matrix rows 2, 12, and 17/17a expressible, because one record
is written by different roles for different reasons.

Named `<resource>.<action>`, with `.read` present **only** where reading is not universal — under FR-015
the Organizer base reads everything except contact PII, so a `event.read` capability would be a constant
`true` pretending to be a decision.

> ### ⚠️ Reads declare `'base'`, and the declaration is mandatory
>
> That leaves **28 of the 41 non-auth routes** — every `GET` — with no capability to name. They do not get
> to stay silent: a route that declares nothing is indistinguishable from a route where someone *forgot*,
> which is the exact failure §4's inventory guard exists to catch.
>
> So a route declares a **requirement**, and a requirement is either a capability or the base:
>
> ```text
> Requirement = Capability | 'base'
> ```
>
> `'base'` means *"any authenticated volunteer, per FR-015"* — no catalog lookup, allow. It is deliberately
> **not** a member of `Capability` and **not** an entry in the catalog: adding `event.read` to every role's
> map would reintroduce the constant-`true` this section rejects, and would imply the base is grantable
> (and therefore revocable), which FR-001 does not contemplate.
>
> ⚠️ **`requires: 'base'` is not the same as "no PII rules apply."** `GET /api/contacts` declares `'base'`
> and **still** projects PII away at the service layer (§5, FR-016). Route-level requirement and
> field-level projection are different mechanisms answering different questions.

| Capability | Matrix row | Write-owners | Scope |
|---|---|---|---|
| `event.write` | 3 | Booker | scoped |
| `event.public.write` | 2 | Booker, Webmaster | scoped / global (WM) |
| `venue.write` | 5 | Booker, Treasurer | scoped / global (Tr) |
| `performer.write` | 6 | Booker | scoped |
| `booking.write` | 7, 8 | Booker | scoped |
| `parameter.write` | 9 | Booker (own), Treasurer (any) | scoped / global (Tr) |
| `attendance.write` | 11 | Door Attendant, FS, Treasurer | global (DA) / scoped |
| `gate.write` | 12 | FS, Treasurer | scoped / global (Tr) |
| `performer_payment.write` | 13 | FS, Treasurer | scoped / global (Tr) |
| `treasurer_report.write` | 14, 15 | Treasurer | global |
| `contact.write` | 17 | Door Attendant, FS, Treasurer | global |
| `contact.mailing.write` | 17a | VP, Mailing List Manager | scoped |
| `contact.pii.read` | 17b | DA, VP, MLM, Secretary, Booker, Treasurer, FS | global |
| `dedup.write` | 17a | VP, Mailing List Manager | global |
| `membership.write` | 18 | Treasurer, FS | global |
| `export.read` | 19 | VP, MLM, Secretary | **global** |
| `mailing_list.write` | 19 | VP, MLM | **scoped** |
| `role.assign` | 20 | President, VP | global |
| `club_settings.write` | 21 | President, VP | global |
| `volunteer.approve` | 22 | President, VP | global |
| `dev.routes.read` | — | **Super-user only** | global |

> **`export.read` global + `mailing_list.write` scoped, both held by the MLM, is FR-008 in one line** —
> the Mailing List Manager is per-series for *managing* their list and cross-series for *exports*. This is
> the whole reason `scopeMode` exists. If a future change collapses these into one capability, the scope
> exception is lost silently.
>
> **`dev.routes.read`** gates the generated route index (FR-040b) and is held by the Super-user alone. It
> is a **capability, not a role check**: `if (role === 'super_user')` would be a second authorization
> mechanism beside this catalog — the one place a role got inlined at a call site, which §2's flattening
> exists to prevent.

**Not in the catalog**: capabilities for unbuilt resources (booking status lifecycle, event cancel/delete,
recurring generation, landlord, advertised price, payment override, membership enrollment). Those arrive
with their features. `performer_payment.write` is listed because check numbers exist today (feature 004);
B28's override does not.

---

## 2. The catalog

```text
CAPABILITIES: Record<Role, Partial<Record<Capability, 'scoped' | 'global'>>>
```

- **`scoped`** — honour the grant's own `series_id` / `group_id` filters.
- **`global`** — the grant confers this everywhere, *regardless of its own scope*.

The three supersets of FR-012 are **flattened into the map**, not resolved at runtime:

- **Treasurer** ⊇ FS — carries every FS capability as `global`.
- **VP** ⊇ President — carries every President capability.
- **Super-user** — carries every capability as `global`.

So the evaluator has no notion of role hierarchy at all. That matches FR-004 ("authority is the union") and
means a superset cannot drift out of sync with the role it supersets — the map *is* the relationship.

---

## 3. Evaluation

```text
can(actor: Actor, capability: Capability, target?: Target): boolean
Target = { seriesId?: string; groupId?: string }
```

Algorithm — **a set of filters, never a tree walk** (FR-007):

1. For each grant the actor holds, look up `CAPABILITIES[grant.role][capability]`. Absent ⇒ this grant says
   nothing; continue.
2. `global` ⇒ **allow**.
3. `scoped`:
   - grant is club-wide (both NULL) ⇒ allow.
   - `grant.seriesId` set ⇒ allow iff `grant.seriesId === target.seriesId`.
   - `grant.groupId` set ⇒ allow iff `grant.groupId === target.groupId`.
4. No grant allowed ⇒ **deny** (FR-013 default-deny).

**Additive union, allow-wins** (FR-004). There is no deny rule and no precedence to reason about — "Door
Attendant ✗ gate" is expressed by the Door Attendant's row simply **not containing** `gate.write`. An FS
who also works the door keeps their gate write, because another grant allows it. This is why the "✗" in
`use-cases.md` must never become a deny entry: a deny would strip that FS's access, which §5.2.8 expects to
be routine.

**Orthogonality is free here.** Steps 3's series and group checks are independent `||` branches, so a
group-scoped grant reaches an event in a series the holder has no authority over — FR-007's intended
behavior — without anyone writing code to make it happen.

**Target resolution**: an event resolves to `{ seriesId: events.series_id, groupId: events.group_id }`.
`group_id` is nullable; a grant scoped to a group simply does not match an ungrouped event (no error).

---

## 4. Route layer

```text
withAuth({ requires: 'gate.write' }, handler)   // a capability
withAuth({ requires: 'base' }, handler)         // any authenticated volunteer (FR-015) — most GETs
// was: withAuth(handler)
```

For a capability, verifies the actor holds it **at some scope**, then injects `Actor`. Coarse and fast: it
rejects a Door Attendant reaching `gate.write` outright, without a database round-trip for the target. For
`'base'`, an authenticated volunteer passes — the check is that the route **said so**.

`requires` is mandatory and exhaustively typed, so a route that omits it is a **compile error**, not a hole
that ships.

**It does not do the scoped check** — for many routes the target is in the request body
(`POST /api/events` carries `seriesId`), and a body may be read only once (R5).

`/api/auth/*` stays exempt, as today: requiring a session to sign in is a deadlock.

**Guarded by `auth.routeInventory.test.ts`** (R13): every non-auth route must *declare* a requirement —
a capability or an explicit `'base'`. The test is source-level and self-maintaining: route 45 fails on
arrival rather than when someone remembers. **The guard is only meaningful because `'base'` must be written
down** — if reads could simply omit the field, "declared nothing" and "forgot" would be the same string.

---

## 5. Service layer

```text
assertScope(actor, capability, target): void   // throws UNAUTHORIZED
assertFields(actor, entity, input): void       // throws FIELD_NOT_PERMITTED
projectContact(actor, contact): ContactView    // drops PII unless contact.pii.read
```

The scoped check lands **in the domain service**, where the target is known and where the data actually
changes — 015's "close to the data" reasoning one level down. Services are also called by the CLI and by
each other; the check belongs at the data, not at one caller.

⚠️ **This layer has no source-level guard.** Layer 1 is declarative and testable statically; layer 2 depends
on runtime data and cannot be. It can be forgotten in a way layer 1 cannot. The mitigation is per-capability
integration tests — US1's acceptance scenarios *are* that suite, and SC-002 sets the bar at 100%.

---

## 6. Errors

| Code | Status | Meaning |
|---|---|---|
| `UNAUTHENTICATED` | 401 | No valid session (015). Deliberately says nothing about why. |
| `UNAUTHORIZED` | **403** | **NEW** — signed in, but not permitted. **Names the capability.** |
| `FIELD_NOT_PERMITTED` | **403** | **NEW** — the write contained a field this actor does not own. |

**401 and 403 take opposite postures, deliberately.** 015 made 401 uninformative because anyone could probe
it unauthenticated. 403's actor is a known volunteer who, under FR-015, *could already read the thing they
were refused* — so concealment protects nothing and only costs them the ability to understand what happened
(FR-026). The single carve-out: never render PII in the message (FR-026a).

`FIELD_NOT_PERMITTED` names the offending field and the whole write is **refused, not stripped** (FR-022).
Zod's instinct — drop unknown keys and continue — is the exact failure this forbids.

---

## 7. Audit (R8)

`writeAudit` gains a table behind it; its signature is unchanged.

| Kind | When | `details` |
|---|---|---|
| `authz.grant.created` | FR-032 | `{ subject, role, seriesId, groupId }` |
| `authz.grant.revoked` | FR-032 | `{ subject, role, seriesId, groupId, reason }` |
| `authz.refused` | FR-026b | `{ capability, target }` |
| `volunteer.designated` / `.cleared` | FR-028 | `{ subject, revokedGrants }` |
| `volunteer.approved` | FR-035 | `{ subject }` |
| `pii.disclosed` | FR-017b | `{ surface, count }` — **per request, never per contact** |

---

## 8. What P3-3/P3-4/P3-5 do with this

Each later package: adds its capabilities to §1, declares them on its routes (§4), calls `assertScope` in
its services (§5). **No package should add a scope mechanism, a role hierarchy, or a second catalog** — if
one seems to need one, the model in `docs/use-cases.md` has changed and that document is the thing to
change first.
