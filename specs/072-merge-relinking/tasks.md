---
description: "Task list for feature 072 — merge relinking"
---

# Tasks: Merge relinking

**Input**: Design documents from `/specs/072-merge-relinking/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/merge-relink.md](./contracts/merge-relink.md)

**Tests are NOT optional here.** Constitution Principle I (Test-First) is NON-NEGOTIABLE, so every
behaviour lands as a failing test before its implementation.

## Format: `[ID] [P?] [Story] Description`

- **[P]** — may run in parallel (different files, no dependency on an incomplete task)
- **[US1]** etc. — the user story the task serves

## Path Conventions

Single Next.js app. Server code under `src/server/`, integration tests under `tests/integration/`,
migrations under `src/server/db/migrations/`.

---

## Phase 1: Setup (Shared Infrastructure)

- [X] T001 Create migration `src/server/db/migrations/0046_role_conflict_hold.sql` adding the enum value:
  `ALTER TYPE held_merge_reason ADD VALUE IF NOT EXISTS 'role_conflict';`. It must be **alone** in its
  migration — Postgres requires a new enum value to be committed before any statement can reference it.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Everything below depends on the classification existing.** T002 is written first and fails until T003
lands, which is the point: the guard defines what "complete" means.

- [X] T002 Write `tests/integration/dedup.contactReferences.test.ts` (FR-002a): query `pg_constraint` for
  every foreign key whose target is `contacts`, and assert each `(table, column)` appears exactly once in
  the classification with a disposition of `move`, `leave` or `structural`. The test MUST fail on an
  unclassified column, naming it. Assert the count matches the 24 columns enumerated in
  [data-model.md](./data-model.md) so a silently *removed* reference is caught too.
- [X] T003 Create `src/server/domain/dedup/contactReferences.ts` (FR-002, FR-003): the exported constant
  classifying all 24 columns per [data-model.md](./data-model.md), typed over Drizzle columns so a renamed
  column fails to compile. Classification is per **column**, not per table — `dedup_rejections` appears
  three times and falls on both sides. Document why each `leave` entry stays.
- [X] T004 [P] Extend `src/server/validation/dedup.ts` for the resolution bodies in
  [contracts/merge-relink.md](./contracts/merge-relink.md) §2: add `keepGrantIds` (array, may be empty) and
  `survivingIdentityId`. Keep the "exactly one kind of choice" refinement, and require
  `survivingIdentityId` and `survivingLoginEmailId` **together** — an address alone must not parse.

**Checkpoint**: every reference to a contact is classified, and adding one without classifying it breaks
the build.

---

## Phase 3: User Story 1 - A merge carries the whole person across (Priority: P1) 🎯 MVP

**Goal**: A merge moves every unconditional attachment, and the nine records stranded by past merges are
repaired.

**Independent test**: Merge two contacts carrying every kind of attachment; confirm the survivor holds all
of it, the retired record holds none, and the audit trail still names the retired contact. Separately,
confirm the stranded records now resolve to their survivors.

### Tests for User Story 1

- [X] T005 Write `tests/integration/dedup.mergeRelink.test.ts` (FR-001, FR-003, FR-004, FR-005, FR-016):
  every `move` reference moves — asserted **individually**, not as a total — and every `leave` reference
  does **not**, so the audit trail still names the retired contact. An **archived** contact behaves exactly
  as a merged one. A merge of a contact carrying nothing completes and reports zeros. Also assert a merge
  still needs only `dedup.write` and nothing more: FR-005 is a negative requirement, so without an explicit
  test nothing stops it drifting.
- [X] T006 [P] Extend `tests/integration/dedup.mergeAccounts.test.ts` with the collision cases (FR-008):
  both contacts attended the same event, and both are attached to the same membership account — the
  survivor holds each once and the merge completes rather than failing.

### Implementation for User Story 1

- [X] T007 Rewrite the relink block in `src/server/domain/dedup/mergeService.ts` (FR-001) to iterate the
  `move` entries from `contactReferences.ts` rather than naming tables inline, folding each into the
  existing `moved` counts. This is the change that makes FR-002's rule real: a newly classified reference
  is moved without touching this file.
- [X] T007a [P] Extend `tests/integration/gate.membership.test.ts` or a sibling attendance suite (SC-007):
  after a merge, the open-band guard in `src/server/domain/attendance/attendanceService.ts` resolves the
  booked performer through the **survivor**, so the same person is never counted as both a booked
  performer and an unpaid open-band comp. This is the organizer-report double-subtraction — one of the
  three failures motivating the feature, fixed by T007 but otherwise untested.
- [X] T008 Handle the attendance collision in `src/server/domain/dedup/mergeService.ts` (FR-008): delete
  the merged contact's row where the survivor already attended that event, then move the rest — the same
  idiom feature 069 uses for `membership_members`. Per [research.md](./research.md) R3 this and
  `role_grants` are the only new references that can collide.

### Historical repair for User Story 1

- [X] T009 Write `tests/integration/dedup.repairStranded.test.ts` (FR-015): the repair re-points records
  from a merged contact to its survivor; it **follows a merge chain** to the final live contact rather
  than one hop; it **excludes** records on archived contacts, which have no survivor; it tolerates a
  collision by dropping the duplicate; and it is idempotent.
- [X] T010 Create `src/server/domain/dedup/repairStrandedMerges.ts` (FR-015) as a callable routine, not
  SQL inside a migration — the same decision feature 068 made for `migrateToAccounts`, and for the same
  reason: the test database starts empty, so a backfill embedded in a migration can never be exercised
  against realistic input. Resolve the chain with a recursive CTE.
- [X] T011 Add a `db:repair-merges` script to `package.json` invoking T010 once against a real database,
  following the `contacts:load` pattern. Note in the script's doc comment that it is spent after running
  and should be removed, as `migrateToAccounts` was in feature 070.

**Checkpoint**: US1 is independently shippable — it fixes the seven performers, restores the Booker's
email links, and returns them to the performer mailing list.

---

## Phase 4: User Story 2 - Merging cannot quietly hand out authority (Priority: P2)

**Goal**: A merge that would compound privilege is held, changing nothing.

**Independent test**: Attempt a merge that would give the survivor role-assigning authority it does not
hold; confirm it does not complete and nothing changed.

### Tests for User Story 2

- [X] T012 Extend `tests/integration/dedup.heldMerge.test.ts` (FR-006, FR-007, FR-016): the survivor would
  **gain** `role.assign` → `held`/`role_conflict` with nothing written; survivor President + merged
  Treasurer → held, **even though the merged record carries no role-assigning authority**; merging a
  President into an existing Super-user is **not** held, because nothing is gained; ordinary working roles
  move with no hold; an identical duplicate grant collapses rather than colliding.
- [X] T013 [P] Extend `tests/integration/dedup.heldMerge.test.ts` for resolution (FR-009, FR-010a):
  resolving with `keepGrantIds` moves exactly that subset and completes; an empty array moves none and
  completes; resolution without `role.assign` is refused; and a `role_conflict` **auto-closes** when the
  conflicting grant is withdrawn, without merging.

### Implementation for User Story 2

- [X] T014 Add `role_conflict` detection to `src/server/domain/dedup/mergeService.ts` (FR-006, FR-007),
  computed from the **union** of both contacts' grants **before the transaction opens**. Read the
  role-assigning set from the capability catalogue and the exclusive set from `EXCLUSIVE_ROLES` in
  `src/server/domain/access/grantService.ts` — never restate either. Test "would gain", not "merged record
  holds".
- [X] T015 Move `role_grants` in `src/server/domain/dedup/mergeService.ts` (FR-008) with
  `ON CONFLICT DO NOTHING`, gated by the T014 check.
- [X] T016 Populate the `role_conflict` candidates payload per
  [contracts/merge-relink.md](./contracts/merge-relink.md) §1 (FR-010) — each grant with its role, scope,
  whether the survivor or the merged record holds it, and which condition it triggered — and confirm the
  hold surfaces in the needs-review queue alongside the existing two reasons, as its own item of work.
- [X] T017 Extend `src/server/domain/dedup/heldMergeService.ts` (FR-009, FR-010a): `authorityFor
  ("role_conflict") = "role.assign"`; the `keepGrantIds` resolution branch with its mismatch guard; and
  auto-close when the union no longer triggers.

**Checkpoint**: no merge can increase role-assigning authority or break office exclusivity.

---

## Phase 5: User Story 3 - A merged person can still sign in (Priority: P3)

**Goal**: Sign-in survives a merge, and the existing `two_logins` hold resolves the thing that actually
grants access.

**Independent test**: Merge a volunteer who signs in and confirm the session is the survivor's; resolve a
two-sign-in hold and confirm the choice determines who can sign in, not merely what is displayed.

### Tests for User Story 3

- [X] T018 Extend `tests/integration/dedup.heldMerge.test.ts` (FR-011, FR-012, FR-012a, FR-012b): where
  only one record can sign in, the identity **moves** and `last_sign_in_at` is preserved; where both can,
  the merge is held; resolving requires **both** the surviving identity and the surviving address;
  supplying the address alone is **refused**; and the identity and address named must belong to the same
  one of the two contacts.
- [X] T019 [P] Extend `tests/integration/auth.signin.test.ts` (FR-012b) — lowercase `signin`, which a
  case-insensitive macOS filesystem will forgive and CI will not: after such a merge, the person
  signs in with the surviving account and lands on the survivor; the non-surviving account is refused and
  does **not** enrol a second time.

### Implementation for User Story 3

- [X] T020 Move `staff_identities` in `src/server/domain/dedup/mergeService.ts` (FR-011) when the survivor
  has none — preserving `last_sign_in_at` — and detect the both-have-one case as the existing `two_logins`
  hold rather than a new reason (per [research.md](./research.md) R5).
- [X] T021 Correct the `two_logins` resolution in `src/server/domain/dedup/heldMergeService.ts` (FR-012,
  FR-012a) to move the account binding **and** the login label together. ⚠️ **This is a breaking change to
  a shipped endpoint**: feature 069 accepted `survivingLoginEmailId` alone, which set a label while leaving
  who could sign in untouched. Nothing calls it yet — the resolution screen was never built — but the
  contract change must be deliberate, not incidental.

**Checkpoint**: the sign-in decision a merge asks for is the decision it acts on.

---

## Phase 6: User Story 4 - Retired records are not offered as live ones (Priority: P4)

**Goal**: Two holes that re-create stranded links are closed.

**Independent test**: Attempt each path against an archived and a merged contact; confirm neither is
offered nor accepted.

### Tests for User Story 4

- [X] T022 [P] Extend `tests/integration/auth.protection.test.ts` (FR-013): a retired contact is refused
  **at sign-in** by both routes — a Google account already bound to a contact since merged, and a
  first-time address match on an archived contact — rather than being admitted and then rejected on every
  request.
- [X] T023 [P] Extend `tests/integration/contactLoad.performers.test.ts` (FR-014) — note the file is
  named for the *sheet* it loads, not for `matchPerformers`: a retired contact
  is not offered as a match, **and** a retired duplicate does not make a name ambiguous and thereby
  suppress the correct live match.

### Implementation for User Story 4

- [X] T024 [P] Add the active-contact predicate to **both** branches of `resolveSignIn` in
  `src/server/auth/signIn.ts` (FR-013) — the known-account lookup and the first-time enrolment match.
  Neither checks today; the known-account branch tests only `is_volunteer`. Keep the refusal generic
  (feature 015 chose that deliberately, so no Google user can probe club membership).
- [X] T025 [P] Add the same predicate to `src/server/domain/contactLoad/matchPerformers.ts` (FR-014),
  which currently selects **all** contacts with no filter.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T026 [P] Add the `role_conflict` explanatory text to the needs-review queue in
  `src/app/(admin)/contacts/page.tsx`, beside the existing two reasons, saying plainly that an officer
  must remove the conflicting role before the merge can proceed (the FR-010a route).
- [X] T027 [P] Update `specs/phase-8-requirements/mel-maintenance-remaining.md`: item 1b is closed by this
  feature; the held-merge **resolution chooser** remains open and now covers three reasons.
- [X] T028 Run the full gate: `pnpm vitest run`, `pnpm tsc --noEmit`, ESLint on the changed directories,
  and `pnpm exec markdownlint-cli2 --fix` then `pnpm lint:md` for the docs. Re-point any suite that
  asserts the old three-table `moved` shape rather than deleting it.
- [~] T029 Walk the manual pass in [quickstart.md](./quickstart.md).
  - **§1 verified** by SQL — SC-001 is 0 on `zak1_dev` after the repair.
  - **§4 verified 2026-09-11** — the hold-then-remove-the-cause loop works end to end. This is the route
    clarification Q1 accepted *in place of* a resolution screen, so the decision that shaped the feature
    is now confirmed rather than assumed.
  - **Remaining: §2, §3** (the Booker's email link and the performer export — both need a signed-in
    session) and **§6** (sign-in refusal against real Google).
  - ⚠️ **§5 is not walkable as written.** It asks how a `two_logins` hold resolves, but no resolution
    screen exists for any reason, and there is no UI to un-designate a login address or remove a sign-in
    identity either — so a `two_logins` hold has **no in-UI route at all**, only the API or a database
    edit. Rewrite §5 as an API check, or drop it until the chooser is built. Attempting it is what
    surfaced T033 below.
- [X] T030 Append an implementation-notes block to this file recording what shipped and the decisions
  taken during implementation, as in features 065–071.

---

## Dependencies & Execution Order

### Phase Dependencies

```text
Setup (T001)
  └─ Foundational (T002–T004)   ← the classification; everything depends on it
       ├─ US1 (T005–T011)  🎯 MVP — unconditional moves + historical repair
       ├─ US2 (T012–T017)        — role grants + role_conflict
       ├─ US3 (T018–T021)        — sign-in identity + corrected two_logins
       └─ US4 (T022–T025)        — adjacent fixes (independent of the others)
            └─ Polish (T026–T030)
```

### User Story Dependencies

- **US1** depends only on Foundational. It is the MVP and ships alone.
- **US2** and **US3** both extend `mergeService`'s collision detection, so they touch the same file —
  sequence them rather than running them in parallel.
- **US4** touches neither `mergeService` nor `heldMergeService` and is fully independent; it could ship
  before US2 or US3 if that were useful.

### Within Each User Story

Tests before implementation, without exception (Principle I).

### Parallel Opportunities

- T004 runs alongside T002/T003 (different file).
- T006 alongside T005; T013 alongside T012; T019 alongside T018.
- All of US4's tasks (T022–T025) are `[P]` — two test files and two source files, none shared.
- T026 and T027 are `[P]` in Polish.

## Parallel Example: User Story 4

```bash
# Tests first, both independent:
#   T022 tests/integration/auth.protection.test.ts
#   T023 tests/integration/contactLoad.performers.test.ts
# then the two one-line predicates, also independent:
#   T024 src/server/auth/signIn.ts
#   T025 src/server/domain/contactLoad/matchPerformers.ts
pnpm vitest run tests/integration/auth.protection.test.ts tests/integration/contactLoad.performers.test.ts
```

## Implementation Strategy

### MVP First (User Story 1 only)

T001–T011 delivers the whole visible value: the seven stranded performers are repaired, the Booker's email
links return, the performer mailing list is complete again, and the organizer report stops double-
subtracting. It is shippable without US2–US4, because `role_grants` and `staff_identities` simply continue
not to move — exactly as today.

### Incremental Delivery

US2 and US3 each close a correctness gap that US1 opens by starting to move attachments; neither is
user-visible on current data (no retired contact holds a grant or an identity). US4 is independent and
small. Polish closes the documentation loop.

### Parallel Team Strategy

With two contributors: one takes US1 through to the repair, the other takes US4 immediately and then US2.
US3 must wait for whoever holds `mergeService`.

## Notes

- **The whole feature turns on T003.** If the classification is wrong, the guard passes and the merge is
  still wrong. Check it against `data-model.md` column by column rather than by count.
- `contacts.merged_into_id` is `structural`, not `leave` — it is the retirement marker itself and is never
  re-pointed. Flattening a merge chain would rewrite which merge actually happened.
- The repair (T010) must resolve the **full chain**: three contacts in the development database were
  merged into a target that was itself later merged, so a single hop would leave them pointing at another
  retired contact.
- A held merge must write **nothing** but its own row (FR-016), so both new collisions are detected before
  the transaction opens — the shape feature 069 already established.

---

## Added during the manual pass (2026-09-11)

Two gaps the automated suites could not have found, because both are about what the person in front of the
screen experiences:

- [X] T031 Withdraw a held merge (FR-017) — `abandonHeldMerge` in
  `src/server/domain/dedup/heldMergeService.ts`, `DELETE /api/dedup/held/{id}` gated on `dedup.write`, and
  a **Don't merge** control on every held row. Available to whoever could attempt the merge, because
  otherwise the queue fills with items that person cannot clear.
- [X] T033 Make the auto-close ask the SAME question as the detection — found walking §5. The sweep
  counted login addresses while the merge also checked sign-in identities, so clearing one address closed
  the hold and the next attempt raised it again: remove the cause, hold clears, retry, held again, with no
  exit and no explanation. `bothCanSignIn` is now exported from `mergeService` and called by both. The
  `role_conflict` case never had this bug because its auto-close already called the merge's own function —
  which is the pattern the others now follow.
- [X] T032 Say so when a merge is held (FR-018) — a held merge returns **200** carrying
  `outcome: "held"`, and the page treated every 200 as success: the list silently refreshed and nothing
  was shown. Note `warning` could not be reused — it renders only inside the create-contact form — so the
  notice has its own page-level state.

## Implementation notes (2026-09-11)

### What shipped

**The classification is the feature.** `src/server/domain/dedup/contactReferences.ts` names all 24 foreign
keys into `contacts` with a disposition, and `mergeService` iterates it instead of naming tables inline.
A newly classified reference is now carried without touching the merge. The parity guard
(`dedup.contactReferences.test.ts`) reads `pg_constraint` and fails, **naming the column**, on anything
unclassified — and equally on a classified reference that no longer exists.

**The live damage is repaired.** `pnpm db:repair-merges` moved the nine stranded records on `zak1_dev`;
SC-001 is now **0** across all three categories. Zak Spath resolves to Zachary Spath (3 addresses) and
Richard C Dempsey to Rich Dempsey (3), so the Booker's email links are back.

**`role_conflict` holds a merge that would compound privilege** — the survivor gaining `role.assign`, or
the union holding two mutually exclusive offices. Both read the existing sources (the capability catalogue
and `EXCLUSIVE_ROLES`, now exported) rather than restating them.

**Feature 069's `two_logins` resolution is corrected.** It set the login label and never the account
binding, so the officer answering it changed nothing about access.

### Decisions taken during implementation

**Every entry carries its Drizzle column, not just the moved ones.** Originally `col` was optional and
present only on `move`. Making it required means a renamed `leave` column fails to **compile**, rather
than waiting for the guard to run against a database.

**A third disposition, `structural`.** `contacts.merged_into_id` is neither an attachment nor an actor
record — it is the retirement marker. Forcing it into `leave` would have been a small lie in the one file
whose job is to be exact.

**`conditional: true` marks the two guarded moves.** `role_grants` and `staff_identities` are classified
`move` but excluded from the generic loop, so US1 shipped with them still not moving — exactly as before —
and US2/US3 added their guarded paths. The exclusion lives in the classification, where a reader can see
which entries are special, rather than as a hard-coded skip inside `mergeService`.

**FR-012a is conditional on a binding existing.** Requiring `survivingIdentityId` unconditionally made two
feature 069 tests unresolvable — and correctly so: a login **address** can be designated before the person
has ever signed in, leaving no binding to settle. The rule is now "name the binding when one exists",
which keeps FR-012a's intent (you may not settle the label while leaving the binding untouched) without
demanding an answer to a question nobody asked.

**The sign-in hold triggers on identities OR login addresses.** Either can collide — `staff_identities` is
unique per contact, the login address unique per contact — so detecting on both means a contact carrying
one without the other still holds correctly.

**Two test files needed their lifecycle hooks hoisted** (`checkin.openBand`, `contactLoad.performers`):
both had `afterAll(closeDb)` inside the first `describe`, which closed the shared pool before a second
one could run.

**`repairMerges.ts` was added to the ESLint `no-console` exemption list**, alongside the other CLI entry
points. It is a one-off: delete it, `repairStrandedMerges.ts` and its test once every database is repaired,
as feature 070 removed `migrateToAccounts`.

### Verification

1262 tests across 315 files (from 1246 at the MVP checkpoint, 1228 before the feature); `tsc --noEmit`,
ESLint and markdownlint clean. Migration `0046` applied to `zak1_dev`; the repair run and confirmed.

### Not done

**T029, the manual pass**, needs a signed-in session — in particular §4's hold-then-remove-the-cause loop
and §5's two-role sign-in check. The resolution **screen** remains unbuilt for all three reasons, which is
in scope for a later feature, not this one. Undo is feature 073.
