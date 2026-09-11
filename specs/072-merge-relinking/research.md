# Phase 0 Research: Merge relinking

All Technical Context items were known from the existing codebase; no `NEEDS CLARIFICATION` markers were
carried into this phase. The research below resolves *design* questions the spec deliberately left to
planning.

## R1 — How the parity guard enumerates references (FR-002a)

**Decision**: Enumerate foreign keys **from the live database** at test time, by querying `pg_constraint`
for every FK whose target is `contacts`, and assert each `(table, column)` appears in the classification
constant. The integration suite already runs against a real Postgres, so this needs no new machinery.

**Rationale**: This is the `routeInventory` pattern — the guard reads the thing itself rather than a
second list someone must remember to update. A new table with a contact reference fails the build on the
next run, which is the "fail in the safe direction" FR-002 asks for. Enumerating from the Drizzle schema
instead would only prove the constant matches TypeScript, not that it matches the database; a migration
adding a column without touching the schema file would slip through.

**Alternatives considered**: a Drizzle-relations walk (rejected: same blind spot); a lint rule over
migration files (rejected: fragile string matching); documentation and review only (rejected explicitly in
clarification Q4 — that is what failed before).

**Note**: The classification is per **column**, not per table. `dedup_rejections` has three references —
two that identify the pair and one that records who rejected it — and they fall on different sides.

## R2 — Where the classification lives

**Decision**: One exported constant in a new `src/server/domain/dedup/contactReferences.ts`, listing every
`(table, column)` with its disposition: `move`, `leave`, or `structural`. `mergeService` drives its relink
loop from the `move` entries; the parity guard asserts the constant covers the database.

**Rationale**: `CONTACT_DELETE_BLOCKERS` in `contactService.ts` already establishes this shape in this
codebase — a typed constant that is simultaneously the behaviour and the thing the guard checks — and its
parity test (C15) is the direct precedent. A constant that is *only* documentation would drift; one the
merge actually iterates cannot.

**Why three dispositions, not two**: `contacts.merged_into_id` is neither an attachment to move nor a
historical actor to leave — it is the merge mechanism itself. Calling it `structural` keeps the guard
honest rather than forcing a misleading label.

## R3 — Collisions on the newly-moved references

**Decision**: Move with the collision dropped rather than the merge failing, wherever a unique constraint
can bite. Confirmed by inspecting the live schema:

| Reference | Unique constraint | Can collide? |
|---|---|---|
| `attendance.contact_id` | `attendance_event_contact` on `(event_id, contact_id)` | **Yes** — both attended the same event |
| `role_grants.contact_id` | `role_grants_unique` on `(contact_id, role, series_id, group_id)` `NULLS NOT DISTINCT` | **Yes** — same role, same scope |
| `officers.contact_id` | `officers_role_key_key` on `role_key` only | No — a seat has one holder; the survivor may hold two seats |
| `performers.contact_id` | none | No |
| `gate_sales`, `membership_captures`, `venues.landlord_contact_id` | none | No |

**Rationale**: The spec's edge case already requires "the survivor holds it once, without the merge
failing", and feature 069 established the idiom for exactly this with `membership_members`. Dropping the
losing row is correct in both new cases: the survivor already attended that event, and already holds that
role at that scope.

**Alternatives considered**: holding the merge on a duplicate (rejected — there is nothing for a person to
decide); letting the constraint throw (rejected — that is the raw-database-error failure 069 exists to
eliminate).

## R4 — Detecting a `role_conflict` (FR-006, FR-007)

**Decision**: Compute the trigger from the **union** of both contacts' grants, before opening the
transaction, using two existing sources: the capability catalogue to find which roles carry `role.assign`
(`vice_president`, `president`, `super_user`), and `EXCLUSIVE_ROLES` from
`src/server/domain/access/grantService.ts` for the mutual-exclusion set.

**Rationale**: Both facts already exist and must not be restated. `EXCLUSIVE_ROLES` in particular enforces
FR-005a as a **cross-row** invariant in the service layer — there is no row constraint behind it — so a
merge relinking grants in SQL bypasses it entirely unless it checks deliberately. Reading the same
constant means the merge cannot disagree with the access screen.

**Why the union**: the exclusivity trigger can arise wholly from the survivor's side (survivor holds
President, merged record holds Treasurer), where the record being merged carries no role-assigning
authority at all. Testing only the merged contact would miss it.

**Escalation test is "would gain"**, not "merged record holds": merging a President into an existing
Super-user escalates nothing, since Super-user already supersets it, and holding there would be pointless
friction.

## R5 — Correcting the sign-in hold (FR-011, FR-012, FR-012a)

**Decision**: Extend feature 069's existing `two_logins` hold rather than adding a fourth reason, and make
its resolution move **both** the account binding and the login label as one choice. Where only one record
can sign in, move the identity with no hold.

**Rationale**: 069 already raises a hold in exactly this situation, so a second reason would mean two
holds for one collision. What 069 got wrong is the *resolution*: it sets `contact_emails.is_login` and
never touches `staff_identities`, so the officer answering "which sign-in survives?" changes a label while
the binding that actually grants access is untouched. Correcting the existing resolution is smaller than
adding a parallel one and removes a live defect.

**Why the label alone can never be the answer**: feature 015's R9 decided the Google account id is the
durable binding precisely *because* an address can change without warning — "the `sub` binding wins and
the mismatch is logged". The two are therefore designed to be able to disagree, which is what makes
resolving the address alone meaningless.

**Discarding the non-surviving account is safe**: sign-in auto-enrols (015 FR-012, no registration form),
and after a merge the addresses are on the survivor, so a discarded binding re-establishes itself against
the *right* contact. Where the survivor already has one, the refusal is 015's FR-006 ("one Google account
per person") working as designed; making that re-pointable is backlog **B38**.

## R6 — Where the retired-contact sign-in guard goes (FR-013)

**Decision**: Add the active-contact predicate to **both** branches of `resolveSignIn` — the known-account
lookup and the first-time enrolment match — not to the session read.

**Rationale**: Feature 071 already refuses a retired contact at session *read*, which is what makes the
failure visible: sign-in appears to succeed, then every request 401s. Fixing it at sign-in turns a
confusing dead session into an honest refusal. Both branches need it because they reach a contact by
different routes and neither checks today — the known-account branch tests only `is_volunteer`.

**Alternatives considered**: relying on 071 alone (rejected — the user experience is a working sign-in
followed by a broken app); deleting sessions on merge (rejected — 071 already covers live sessions, and
this is about the sign-in that follows).

## R7 — Delivering the historical repair (FR-015)

**Decision**: A **callable routine** invoked once by a `package.json` script — not SQL inside a migration
— resolving the merge chain to its **final** survivor, covering all `move` references, and excluding
contacts that are archived rather than merged.

**Rationale**: Principle I. The test database starts empty, so a backfill embedded in a migration can
never be exercised against realistic input — it would ship untested. Feature 068 faced exactly this and
wrote `migrateToAccounts` as a routine for the stated reason that it could then be TESTED; feature 070
deleted it once spent. This follows that precedent rather than the plain-DDL one (0033's level backfill,
which had no logic worth testing).

**Alternative considered and rejected**: a numbered data migration (simpler to run, applies automatically)
— rejected because the chain resolution and collision handling below are precisely the logic that needs a
test, and a migration cannot have one here.

**The chain is real, not hypothetical**: three contacts in the development database were merged into a
target that was itself later merged. A single-hop `SET contact_id = merged_into_id` would leave those
records pointing at another retired contact — re-creating the very condition being repaired. The repair
must follow `merged_into_id` until it reaches a live contact (a recursive CTE).

**Archived contacts are excluded**: there is no survivor to move to. A performer linked to an archived
contact stays linked; the person has retired from the club, which is what archived means.

**Collisions apply here too**: the repair uses the same drop-the-duplicate rule as R3, since a survivor may
already hold what is being moved to them. Verified clean on current data — neither stranded attendance row
has a survivor who also attended — but the migration must not assume that.
