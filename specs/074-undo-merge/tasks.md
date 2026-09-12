---
description: "Task list for feature 074 — undo merge"
---

# Tasks: Undo merge

**Input**: Design documents from `/specs/074-undo-merge/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/undo-merge.md](./contracts/undo-merge.md)

**Tests are NOT optional here.** Constitution Principle I (Test-First) is NON-NEGOTIABLE, so every
behaviour lands as a failing test before its implementation.

## Format: `[ID] [P?] [Story] Description`

- **[P]** — may run in parallel (different files, no dependency on an incomplete task)
- **[US1]** etc. — the user story the task serves

## Path Conventions

Single Next.js app. Server code under `src/server/`, admin UI under `src/app/(admin)/`, integration tests
under `tests/integration/`, migrations under `src/server/db/migrations/`.

---

## Phase 1: Setup

- [X] T001 Create migration `src/server/db/migrations/0047_merge_reversal.sql`: add
  `reversal_manifest jsonb` (nullable, no default, no backfill — `NULL` *is* the FR-007 un-reversible
  signal) to `merge_audit`; create `merge_reversals` per [data-model.md](./data-model.md) with
  `merge_audit_id uuid NOT NULL UNIQUE REFERENCES merge_audit(id)`, `actor text NOT NULL`,
  `restored_counts jsonb NOT NULL DEFAULT '{}'`, `skipped jsonb NOT NULL DEFAULT '[]'`,
  `created_at timestamptz NOT NULL DEFAULT now()`. The UNIQUE is load-bearing (research R7) — it settles
  the concurrent-undo race, so it is a constraint and not just an index.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Nothing can be undone that was not recorded.** This phase makes the merge write its manifest and
teaches the system to judge reversibility. It has **no user-visible behaviour of its own** — the spec
says so explicitly — but both user stories are dead without it.

- [X] T002 [P] Extend `src/server/db/schema/audit.ts`: add `reversalManifest: jsonb("reversal_manifest")`
  to `mergeAudit` and rewrite its doc comment, which currently states that an unmerge is impossible —
  that warning is what this feature retires. Add the `mergeReversals` table and its `$inferSelect` type,
  and export both from `src/server/db/schema/index.ts`.
- [X] T003 [P] Create `src/server/domain/dedup/mergeManifest.ts`: the `ManifestEntry` discriminated union
  (`move` / `create` / `destroy` / `overwrite`), the optional `accessChanging` flag, the
  `{ version: 1, entries }` envelope, and a Zod schema parsing it on read (Principle III — a manifest
  written under an older shape must fail loudly, never be half-read). Include a small builder the merge
  accumulates into, so no call site hand-assembles an entry.
- [X] T004 Extend `tests/integration/dedup.contactReferences.test.ts`: assert every reference with
  disposition `move` declares a non-empty `pk`, and that each declared column really is part of that
  table's primary key per `pg_index`/`pg_constraint`. It MUST fail on a `move` entry with no `pk`, naming
  it. Written before T005 and failing until it lands.
- [X] T005 Add `pk: AnyPgColumn[]` to `ContactReference` and populate it on all 11 `move` entries in
  `src/server/domain/dedup/contactReferences.ts`. Ten are `[<table>.id]`; `membership_members` is
  `[membershipMembers.accountId, membershipMembers.contactId]` — it has **no `id` column** and its
  `contact_id` is simultaneously half its key and the column the merge rewrites, which is the entire
  reason this field exists (research R2). Document that in the `why`.
- [X] T006 Write `tests/integration/dedup.mergeManifest.test.ts` covering all ten manifest sources in
  [data-model.md](./data-model.md): a `move` per relinked table, `role_grants` moves, the
  `staff_identities` move and delete, the `is_login` overwrite, the household `create` rows, the
  discarded account `destroy`, the **cascade-lost household rows**, and both collision `destroy`s. Assert
  entry contents, not just counts — a manifest with the right shape and the wrong key is the failure this
  suite exists to catch. All failing until T007–T011.
- [X] T007 In `src/server/domain/dedup/mergeService.ts`, change the generic relink loop from
  `RETURNING 1` to returning each row's primary key per the classification, and record a `move` entry
  carrying `{table, column, key, fromContactId}`. Do the same for the `role_grants` update, which already
  returns ids.
- [X] T008 Record the sign-in operations in `mergeService.ts`: the uncontested `staff_identities` move as
  a `move`, the contested delete as a `destroy` with the full prior row (`DELETE … RETURNING *`), and the
  `contact_emails.is_login` clear as an `overwrite` carrying the prior value. All three carry
  `accessChanging: true` (FR-024, research R8).
- [X] T009 Record the account fold in `mergeService.ts`: each household row copied onto the surviving
  account as a `create`, and the discarded `membership_accounts` row as a `destroy`. **Then the part with
  no statement in the merge** — read every `membership_members` row on the discarded account and snapshot
  it as a `destroy` *before* deleting the account, because `membership_members.account_id` is
  `ON DELETE CASCADE` and those rows otherwise vanish silently, including the ones `ON CONFLICT DO
  NOTHING` never copied (research R4).
- [X] T010 Record the two collision drops in `mergeService.ts` as `destroy` entries by changing both
  `DELETE` statements to `DELETE … RETURNING *`. Remove the `⚠️ DESTRUCTIVE and unrecorded` comment at
  `mergeService.ts:370` and the `no unmerge path` warning at `:424`, replacing them with what is now
  true; leaving a stale warning in place is worse than none.
- [X] T011 Write the assembled manifest into the `mergeAudit` insert **inside the existing merge
  transaction** (FR-005). A merge that commits without a complete manifest must be impossible, so the
  manifest is part of the same insert that already records the merge — not a second write.
- [X] T012 Write `tests/integration/dedup.mergeHistory.test.ts` for the verdict only: each of
  `reversible`, `no_manifest`, `survivor_merged`, `contact_archived` and `already_undone` produced by the
  condition that should produce it (FR-007 to FR-010). These five are **exhaustive** — an earlier draft
  carried a sixth, `contact_missing`, which was removed because `merge_audit`'s foreign keys make it
  unreachable and the test for it could not have been written. Also assert FR-011 positively: a merge
  aged far beyond any plausible retention window, carrying a manifest, still verdicts `reversible`.
  Without that assertion nothing stops a later change from quietly introducing a cut-off. Failing until
  T013.
- [X] T013 Create `src/server/domain/dedup/mergeHistoryService.ts` with the reversibility verdict as
  **one exported function** returning the five-way discriminated union in
  [data-model.md](./data-model.md). Both
  the history read path and the undo write path call it and neither reimplements it — feature 072's
  auto-close/detection mismatch is the precedent for what happens when two paths ask nearly the same
  question (research R9).

**Checkpoint**: merges now record everything needed to reverse them, and the system can say whether a
given merge is reversible. Nothing user-visible has changed.

---

## Phase 3: User Story 1 — Take back a merge that was a mistake (Priority: P1) 🎯 MVP

**Goal**: A merge can be reversed, restoring the retired contact and everything the merge moved,
destroyed, overwrote or created.

**Independent test**: Merge a pair holding emails, a membership, a shared event attendance and a
performer link; undo; confirm both records are in their pre-merge state and the report accounts for every
entry.

- [X] T014 [US1] Write `tests/integration/dedup.unmerge.test.ts` — the clean round trip: merge a pair
  with something in every manifest category, undo, and assert each category is restored, the retired
  contact is live, and the survivor holds only what it held before (FR-012 to FR-016, SC-002). Assert
  FR-017 explicitly and separately: the cached membership status of **both** contacts is recomputed. A
  survivor left holding a status it earned only from the merge is exactly the silent wrongness features
  068 to 070 kept producing, and it will not show up in any of the row-level assertions above.
- [X] T015 [P] [US1] Add tests to `dedup.unmerge.test.ts` for the account fold: the discarded account
  returns with its level, expiry and last-payment date, the households separate again, and **every**
  member of the discarded account is reattached — including one who was already on the surviving account
  and was therefore cascade-deleted rather than copied. This is the case most likely to be got wrong.
- [X] T016 [P] [US1] Add tests for both skip reasons: a moved row deleted after the merge is skipped as
  `gone`; a `destroy` whose slot is now occupied (the same person re-checked-in to that event) is skipped
  as `occupied`. Both MUST commit and MUST appear in `skipped` (FR-018, SC-006).
- [X] T017 [P] [US1] Add tests for refusal and idempotence: a second undo of the same merge is refused as
  `already_undone` (FR-010), and a merge whose survivor has since been merged is refused as
  `survivor_merged` (FR-008).
- [X] T018 [P] [US1] Add a test that data created after the merge is untouched — an email and an
  attendance row added to the survivor post-merge both survive the undo (FR-022, SC-005).
- [X] T019 [US1] Create `src/server/domain/dedup/unmergeService.ts`: load and Zod-parse the manifest,
  re-check the verdict, and replay in the **fixed order** of research R5 — move re-linked rows back,
  delete created rows, re-insert destroyed rows, restore overwritten values, recompute both contacts'
  status, clear `merged_into_id`. Comment why the order is not arbitrary: restoring `is_login` before the
  addresses move back would put two login addresses on one contact and abort the transaction against
  `contact_emails_one_login_per_contact`, and a deleted identity cannot be re-inserted until the moved one
  has left the survivor.
- [X] T020 [US1] Implement per-entry skip handling in `unmergeService.ts`: an entry whose row is gone, or
  whose re-insertion would collide, is skipped with its reason and the reversal still commits. All-or-
  nothing applies to the undo as a whole (FR-019), never to an individual entry (FR-018).
- [X] T021 [US1] Write the `merge_reversals` row inside the same transaction — actor, restored counts,
  skipped entries — and emit a structured audit event alongside it (FR-021, Principle IV). `merge_audit`
  is NOT touched (FR-006).
- [X] T022 [US1] Create `src/app/api/dedup/merges/[id]/undo/route.ts` — `withAuth({ requires: "dedup.write" })`, returning the
  200 and 409 shapes in [contracts/undo-merge.md](./contracts/undo-merge.md). A non-`reversible` verdict
  is a 409 carrying the verdict, including for the loser of a concurrent-undo race.
- [X] T023 [US1] Add the undo action and its result reporting to the contact record modal in
  `src/app/(admin)/contacts/page.tsx`. A 200 with a non-empty `skipped` MUST NOT render as a clean
  success — feature 072 shipped exactly that bug when a `held` outcome was treated as a completed merge.
  Use a dedicated notice state, not the `warning` state, which renders only inside the create-contact
  form.

**Checkpoint**: a mistaken merge is recoverable without restoring the database — the feature's whole
purpose is met.

---

## Phase 4: User Story 2 — Know whether a merge can be taken back (Priority: P2)

**Goal**: Every merge that produced a contact is visible on its record, with an honest reversibility
verdict — and merges predating this feature offer no action at all.

**Independent test**: View a contact from a pre-feature merge and confirm the merge is listed, marked
un-reversible with its reason, and offers nothing; view one from a post-feature merge and confirm it
shows as reversible with age and activity.

- [X] T024 [US2] Extend `tests/integration/dedup.mergeHistory.test.ts` to the listing: merges newest
  first, each carrying the merged contact's name, actor, timestamp, `ageDays`, `activitySince`, verdict
  and any reversal (FR-026, FR-027). Assert a pre-feature merge (manifest `NULL`) reports `no_manifest`.
  Assert `activitySince` as a **number**, not merely as present: seed rows on both sides of the merge
  timestamp in each of the three counted tables, and one in an *excluded* table, and check the count is
  what the definition says it is.
- [X] T025 [US2] Implement `listMergesForContact` in `mergeHistoryService.ts`, including the
  `activitySince` count — rows on either contact whose `created_at` is later than the merge, across the
  **closed three-table set** defined in [data-model.md](./data-model.md): `contact_emails`,
  `attendance`, `membership_accounts`. Not the eleven moved references, and NOT `gate_sales`, which has
  no timestamp of its own and would need a join through `door_records` while `attendance` already
  registers the same visit. The set is closed so the count is one uniform query, and it is a risk
  indicator rather than an audit total. Reuse the T013 verdict function; do not recompute the
  conditions.
- [X] T026 [US2] Create `src/app/api/dedup/merges/route.ts` — `GET ?contactId=…`,
  `withAuth({ requires: "dedup.write" })`, returning the shape in
  [contracts/undo-merge.md](./contracts/undo-merge.md).
- [X] T027 [US2] Create `src/app/(admin)/contacts/_components/MergeHistory.tsx` and render it inside
  `RecordView` in `page.tsx`, alongside `MembershipAccount`. Each entry shows who was merged in, when,
  and its verdict. **Only a `reversible` verdict renders the undo control**; every other verdict renders
  its explanatory text instead (FR-028). Use the real design tokens — `--text`, `--text-muted`,
  `--surface`, `--hairline`, `--band`; `--muted`, `--danger` and `--surface-2` do not exist.
- [X] T028 [P] [US2] Add the reversibility note to the merge confirmation in `page.tsx` (FR-029), so the
  safety net is known before the merge rather than discovered after it. Copy only — no request needed.

**Checkpoint**: the undo is discoverable, and the system never offers an action that would fail.

---

## Phase 5: User Story 3 — Restoring sign-in is an access decision (Priority: P3)

**Goal**: The parts of an undo that change who can sign in require role-assignment authority, and their
absence skips those entries rather than blocking the reversal.

**Independent test**: Undo a merge that moved a sign-in binding, first without `role.assign` (completes,
binding untouched, reported) and then with it (binding returns).

- [X] T029 [US3] Add tests to `dedup.unmerge.test.ts`: without `role.assign`, every `accessChanging`
  entry is skipped as `not_authorized` and everything else is restored (FR-025); with it, they are
  applied. Cover **both** a moved binding and a re-created deleted one — moving a binding back changes
  who can sign in just as much as recreating one, so the gate is wider than "re-creation only".
- [X] T030 [US3] Add a test that a person whose binding was skipped can still sign in, re-enrolling
  against the **restored** contact — the login address returned with the undo, and enrolment is
  automatic. This is what makes skipping an acceptable response to missing authority rather than a
  lockout (research R8), so it is asserted, not assumed.
- [X] T031 [US3] Implement the gate in `unmergeService.ts` at entry level: `accessChanging` entries are
  applied only when the actor holds `role.assign`, and otherwise skipped with `not_authorized`. The route
  MUST NOT return 403 for missing `role.assign` — that would refuse the whole reversal over the one part
  that repairs itself.
- [X] T032 [US3] Surface `not_authorized` skips distinctly in the undo result in `page.tsx`: this is not
  a failure but a deliberate omission, and the text should say who can complete it.

**Checkpoint**: all three user stories complete.

---

## Phase 6: Polish & Cross-Cutting

- [X] T033 [P] Update `specs/DATA_MODEL.md` with `merge_reversals` and `merge_audit.reversal_manifest`,
  and correct the statement that a merge cannot be reversed.
- [X] T034 [P] Update the two **live** phase-8 planning documents. In
  `specs/phase-8-requirements/mel-maintenance-remaining.md`: the undo gap is closed; the held-merge
  resolution chooser UI remains open for all three reasons. In
  `specs/phase-8-requirements/merge-relink-and-unmerge.md` (lines 9 and 97): §6 Undo is feature **074**,
  not 073 — the rename consumed 073, and this doc is read forward. Leave the five "feature 073"
  references inside `specs/072-merge-relinking/` alone: those are the historical record of a shipped
  feature and were true when written, the same principle as the constitution's non-retroactivity clause.
- [X] T035 [P] Delete `src/server/domain/dedup/repairStrandedMerges.ts`, its `repairMerges.ts` entry
  point and `tests/integration/dedup.repairStranded.test.ts` — the 072 backfill is spent. **Confirmed
  2026-09-11: `runcdr_dev` is the only database in existence, and it has been repaired**, so there is no
  unrepaired database left for the routine to serve.
- [X] T036 Run the full gate suite: `pnpm db:migrate && pnpm vitest run && pnpm tsc --noEmit`, then
  `pnpm eslint src/server/domain/dedup src/app/api/dedup "src/app/(admin)/contacts"` and
  `pnpm lint:md`. Single-contributor mode (constitution v1.4.0) makes the suite the only reviewer — no
  gate may be skipped or deferred.
- [X] T037 **DONE (2026-09-12).** Walk [quickstart.md](./quickstart.md) §1–§6 by hand against the
  dev database and record the result below. Every scenario needs a signed-in staff session, and signing
  in means real Google credentials, so this cannot be done for you.

  **§1 round trip — PASSED (2026-09-12).** Zeke Smukler merged into David Smukler; the merge completed,
  the undo completed, and the emails separated correctly back onto Zeke.

  **§2 account fold — BLOCKED, not walkable.** Two independent pre-existing gaps, neither introduced by
  this feature: there is **no UI that creates a membership account** (both payment routes exist but
  nothing outside `src/app/api/` calls them, and `MembershipAccount.tsx` renders only for a contact that
  already has one), and a **`two_accounts` hold cannot be resolved in the UI** (the queue's Resolve
  button calls `openRecord()`; the chooser is unbuilt for all three reasons). Covered instead by
  `dedup.unmerge.test.ts`, which builds the same scenario — cascade-lost member included — and calls the
  same `mergeContacts(…, { survivingAccountId })` that `resolveHeldMerge` calls. Re-walk when the
  resolution chooser ships.

  **§4 sign-in gate — substitute added.** The original needs the same missing chooser. The substitute
  needs no hold: merge a contact that HAS signed in into one that has not, so the binding simply moves,
  then undo as `dedup.write` without `role.assign` and confirm it is skipped and reported.

  **§3 age and honesty — PASSED (2026-09-12).**

  **§4 sign-in gate — the undo half is still outstanding, but the walk FOUND TWO PRE-EXISTING BUGS.**
  `dempsey.peggy@gmail.com` (mailing list manager) was merged into `peggy@cdrochester.org`. The merge
  completed and behaved exactly as designed — grant, sign-in binding and both emails moved to the
  survivor — but **neither address could then sign in**, because the survivor is not a volunteer and
  `resolveSignIn` requires `is_volunteer`. Neither bug belongs to 074; both are recorded in
  `specs/phase-8-requirements/mel-maintenance-remaining.md` §2a and §2b:

  1. A merge can **silently revoke a volunteer's access**. `contacts.is_volunteer` is an attribute of the
     person but is not a foreign key, so it is outside `CONTACT_REFERENCES` and no merge has considered
     it. The result is a state `grantService` itself forbids (`grantRequiresVolunteer`) — the same class
     as 072's `EXCLUSIVE_ROLES` finding, a service invariant bypassed by a SQL relink.
  2. `listVolunteers` has **no active-contact filter**, so the merged-away contact is still listed on the
     access page, showing with no roles.

  It also corrected this feature's own reasoning: research R8 claimed a skipped sign-in restoration
  repairs itself via auto-enrolment. It does not, for the same Google account — the known-`google_sub`
  branch wins before enrolment is reached. R8 and the matching spec assumption are amended; the test was
  already asserting only the accurate, weaker claim.

  **§4 undo — PASSED (2026-09-12), and it restored access.** Undone by a `role.assign` holder;
  `skipped` was `[]`, so the sign-in entries were applied rather than declined. Peggy Dempsey came back
  live, a volunteer, holding `mailing_list_manager`, **one sign-in identity** and her gmail address;
  Peggy CDR returned to no roles, no identity and her own address only. This is also the real-world
  confirmation that undoing the merge is the recovery path for the §2a lockout.

  `restored_counts` for that single reversal: `attendance 2, role_grants 1, contact_emails 1,
  staff_identities 1, membership_members 1, membership_accounts 1` — **six of the eleven moved tables
  round-tripped in one walk**, including a membership account and its household row. So the
  non-destructive half of §2 is now covered manually after all; what remains untested outside the suite
  is only the destructive fold (two competing accounts, one discarded, the cascade-lost member).

  **§5 chains — FOUND A DEFECT IN THIS FEATURE, now fixed.** Three Burlingame contacts: Emily → Amy,
  then Amy → Jacob. All three sets of emails ended up on Jacob, but Jacob's merge history listed only
  Amy → Jacob. The Emily → Amy merge names Amy as its survivor, and Amy is retired and cannot be opened
  in the UI — so that merge was invisible and unreachable, and with it the `survivor_merged` verdict,
  which is computed and tested but had nowhere to appear. That is the same sin `contact_missing` was
  deleted for.

  It was a defect against this feature's own spec: **US2 acceptance scenario 3** requires exactly this
  case to be shown as not currently reversible with the later merge named, and **FR-026** says the merges
  that produced a contact must be visible on its record — which an indirect merge did.

  Fixed: `listMergesForContact` now walks `contacts.merged_into_id` backwards with a recursive CTE and
  lists every merge whose survivor is this contact **or any contact that has since become it**. Each
  entry carries `intoContact` and `direct`, so an indirect row says "Emily was merged into **Amy**"
  rather than claiming it went into Jacob. `UNION` rather than `UNION ALL`, so a cycle terminates instead
  of hanging the page. Two tests added; contract and data-model updated.

  Verified against the live data: Jacob's history now shows `Amy → Jacob (reversible)` and
  `Emily → Amy (survivor_merged — undo that later merge first)`.

  **§5 unwind — PASSED (2026-09-12).** Undid Amy → Jacob; Emily → Amy then showed as reversible and was
  undone in turn. Emails correctly returned to all three contacts. FR-008's LIFO rule confirmed end to
  end against real data.

  **§6 post-merge data untouched — PASSED (2026-09-12).** Dan Seppeler merged into Barb Seppeler, then
  three emails added to Barb after the merge. On undo, Dan received back **only his own** email and the
  three later additions stayed with Barb. That is FR-022 and SC-005 confirmed on live data.

  **All six sections now resolved: §1, §3, §4, §5, §6 passed; §2 blocked and covered by the suite.**

  One unrelated defect surfaced while walking §6, in **feature 066's `EmailEditor`, not this feature**:
  adding an email gives no visible confirmation, so the address appears only after the record is closed
  and re-opened. `EmailEditor` seeds `drafts` into local state once (`EmailEditor.tsx:58`) and its comment
  assumes "a key change (record re-open) remounts via the parent" — but the key is `record.id`, which
  does not change when `onChanged()` re-fetches the same record, so the component keeps its instance and
  never re-syncs from the fresh props. Delete and message-recipient changes have the same staleness. The
  writes all succeed; only the display is stale. Cost a duplicate address to be created before the cause
  was understood.

  One defect in the quickstart itself, found by walking it and now fixed: §1's verification query used
  `:restored` placeholders, which psql treats as variable substitutions and which error at the colon when
  unset. Replaced with a query that runs as pasted. §2 (the account fold with a cascade-lost member) and §3 (a pre-existing merge
  offering no action) are the two that automated tests can assert but not judge.

---

## Dependencies

```text
Phase 1 (T001)
   └── Phase 2 (T002–T013)  ← foundational; no user-visible behaviour
          ├── Phase 3 US1 (T014–T023)  ← MVP
          ├── Phase 4 US2 (T024–T028)  ← needs T013 verdict; independent of US1 otherwise
          └── Phase 5 US3 (T029–T032)  ← extends the US1 service
                 └── Phase 6 (T033–T037)
```

US2 depends on Phase 2 only, not on US1 — the history view and its verdicts are shippable before the
undo action exists, and would be honest on their own (every merge would simply show as reversible with no
control). US3 extends `unmergeService.ts` and therefore follows US1.

## Parallel opportunities

- **Phase 2**: T002 and T003 touch different files and may run together. T004/T005 (the classification)
  are independent of T006–T011 (the recording) until T007 needs `pk`.
- **Phase 3**: T015–T018 are four independent test additions and may be written in parallel; T019–T023
  are sequential, all touching `unmergeService.ts` and then the route and UI.
- **Phase 4**: T028 touches only the confirmation copy and is independent of T024–T027.
- **Phase 6**: T033, T034 and T035 touch different files.

## Implementation strategy

**MVP = Phase 1 + Phase 2 + Phase 3.** That delivers the feature's entire purpose: a mistaken merge is
recoverable. It is usable without Phase 4 (the undo is reachable from the contact record even if the
history list is thin) and without Phase 5 (the sign-in gate matters only for merges between two records
that can both sign in, which are held today anyway).

**Deliver Phase 4 next**, because an undo nobody can find is not much of a safety net, and because the
honesty requirement — never offering an action that would fail on the 36 pre-existing merges — is what
makes the feature trustworthy rather than merely present.

**Phase 5 last**, as the spec's P3 reflects: it is the one part of an undo that grants rather than
separates, and the rest is useful without it.

---

## Deviations from the plan, and why

Recorded here rather than silently, because each one is a decision a later reader would otherwise have
to re-derive.

- **`undoMergeService.ts`, not `unmergeService.ts`.** `/speckit-analyze` finding F3: the feature, every
  requirement and the route all say "undo", so the service does too.
- **No Zod schema for the undo request.** T022 called for one, but the body is empty. A schema over `{}`
  validates nothing and would exist only to match a pattern (Principle II).
- **The 409 body follows the house `ApiError` shape**, not the bespoke `{ error, verdict }` the contract
  first sketched. The verdict rides in `detail`. Every other route in the app answers
  `{ error: { code, message } }`, and one endpoint inventing its own would break the client's single
  error path for nothing. The contract was corrected to match the implementation.
- **`activitySince` counts three tables, not four.** The plan named `gate_sales` among "the tables
  carrying a plain `created_at`" — it has no timestamp of its own at all and hangs off `door_records`.
  Dropping it kept the stated rationale true instead of bolting on a join, and `attendance` already
  registers the same visit. Propagated to data-model.md, the contract and T024/T025.
- **US3's tests (T029, T030) were written before T019's implementation**, not after it, so the whole
  reversal landed in one red-green cycle rather than two. Test-first is preserved; only the task order
  moved.
- **Two extra cleanups the task list did not name**: `db:repair-merges` was removed from `package.json`
  alongside the routine T035 deletes, and the now-dangling `repairMerges.ts` entry was removed from the
  ESLint `no-console` exemption list in `eslint.config.mjs`.

## What the implementation found that the plan did not

- **A row the merge CREATES and then DESTROYS.** The account fold copies
  `(surviving_account, merged_contact)` in, and the collision drop deletes that same row immediately
  because the survivor is already on that account. The manifest faithfully records both a `create` and a
  `destroy` for one key, and a naive reverse replay RESURRECTED it — leaving the survivor holding a
  household row that never existed before the merge. `undoMergeService` now cancels matching
  create/destroy pairs before replaying: the row did not exist before the merge and does not exist
  after it, so the correct reversal is to do nothing. Caught by T015.
- **`gate_sales` has no `created_at`** — see the deviation above.
- **A pre-existing gap, NOT fixed here**: `CONTACT_DELETE_BLOCKERS` does not include merge
  participation, so a retired shell — stripped of everything by the merge — presents as bare, is offered
  for deletion, and then fails on `merge_audit`'s foreign key with a raw Postgres error instead of Mel's
  designed refusal. That is the failure class feature 069 exists to eliminate. Recorded in research R9;
  it wants its own fix.

## Gate results (T036, 2026-09-12)

```text
pnpm db:migrate    0047_merge_reversal.sql applied
pnpm vitest run    317 files, 1307 tests, all passing
pnpm tsc --noEmit  clean
pnpm eslint        clean (dedup domain, dedup API, contacts UI, audit schema, apiError, capabilities)
pnpm exec prettier clean (two files reformatted, then clean)
pnpm build         production build succeeded
pnpm lint:md       605 files, 0 errors
```

New and extended test coverage: `dedup.mergeManifest.test.ts` (11), `dedup.mergeHistory.test.ts` (12),
`dedup.unmerge.test.ts` (16), plus 4 added to `dedup.contactReferences.test.ts` — **43 tests**.

One false alarm worth recording so it is not re-diagnosed later: an interim run reported 105 failures
across 55 files with a `door_record_audit` foreign-key violation. That was **self-inflicted** — a dev
server and `pnpm build` were touching the same dev database while the suite ran. The suite passes
cleanly with nothing else attached, which is the standing hazard already recorded in memory: never run
anything against the dev database while the suite is running.
