---
description: "Task list for feature 069 — triage mode worklists"
---

# Tasks: Triage Mode — Worklists

**Input**: Design documents from `/specs/069-triage-worklists/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/triage.md](./contracts/triage.md)

**Tests**: REQUIRED. Constitution principle I (Test-First) is NON-NEGOTIABLE — each phase writes its
failing tests before the code that satisfies them.

**Organization**: grouped by user story so each is independently implementable and testable. The merge
correctness fix sits in Foundational because merging is reachable from the queue **today**, and both the
comparison story and the held-merge story build on it.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on incomplete work)
- **[Story]**: US1 / US2 / US3 / US4 from spec.md
- Exact file paths are given in every task

---

## Phase 1: Setup

**Purpose**: the two additive tables and their vocabulary. Nothing existing is altered.

- [X] T001 Create migration `src/server/db/migrations/0044_triage_worklists.sql`: the `held_merge_reason`
  enum (`two_logins`, `two_accounts`), `dedup_rejections` (pair + **the two `dedup_normalized` values as
  judged** + who/when, `CHECK (contact_a_id < contact_b_id)`, unique on the pair, cascading from contacts)
  and `held_merges` (pair, reason, who/when, `resolved_at`, partial unique on open holds).
- [X] T002 Add `dedupRejections` and `heldMerges` to a new `src/server/db/schema/dedup.ts`, exported from
  the schema index. Comment why the rejection stores names rather than a flag (FR-003a): four code paths
  write `dedup_normalized`, so a flag would need four clearing hooks and would fail silently if one were
  missed.
- [X] T003 [P] Add `rejectionSchema` (`contactAId`, `contactBId`) and `heldResolveSchema`
  (`survivingLoginEmailId` | `survivingAccountId`, exactly one) to `src/server/validation/dedup.ts`.

**Checkpoint**: tables exist, nothing reads them, full suite still green.

---

## Phase 2: Foundational — merge correctness

**Purpose**: fix what the merge already gets wrong before building on it. Merging is reachable from the
queue today, so this is not preparatory work — it is a live defect.

- [X] T004 Add error codes `HELD_MERGE_NOT_FOUND` (404) and `HELD_MERGE_REASON_MISMATCH` (422) to
  `src/server/lib/apiError.ts`, and audit kinds `dedup.pair_rejected`, `dedup.pair_unrejected`,
  `dedup.merge_held`, `dedup.merge_resolved` to `src/server/lib/audit.ts`.
- [X] T005 Write `tests/integration/dedup.mergeAccounts.test.ts`: merging a contact who **owns a
  membership account** moves the account and its attachments to the survivor; merging a contact who is
  **attached** to someone else's account moves that attachment; the survivor's derived membership reflects
  what it gained; and the merge does **not** touch the retired `memberships` / `payers` tables.
- [X] T006 Fix `src/server/domain/dedup/mergeService.ts` (FR-010): relink `membership_accounts.payer_contact_id`
  and `membership_members.contact_id` to the survivor, and **remove** the `memberships` / `payers`
  relinking that feature 068 left behind. Report what moved in `relinkedCounts`. Without this, merging an
  account owner strands that household's account on a retired contact — silently, since nothing reads it.

**Checkpoint**: a merge now moves everything it should; user stories may begin.

---

## Phase 3: User Story 1 — Decide from the row, and make a rejection stick (Priority: P1) 🎯 MVP

**Goal**: rows carry enough to judge, and a pair Mel has judged stops coming back until a name changes.

**Independent test**: reject a pair, reload, it is gone; change a first or last name on either side and it
returns; change only a display-name override and it stays gone; reveal and undo the rejection from the
queue.

### Tests (write first, must fail)

- [X] T007 [US1] Write `tests/integration/dedup.rejections.test.ts` (FR-002, FR-003, FR-004):
  rejecting suppresses the pair;
  changing either contact's **first or last name** returns it **with no write to the rejection**; changing
  only a **display-name override** does not; renaming back re-suppresses; un-rejecting returns it;
  rejecting is idempotent and accepts the two ids in either order; `SAME_CONTACT` is refused.
- [X] T008 [P] [US1] Extend `tests/integration/dedup.suggestions.test.ts`: the candidate projection carries
  record age (created/updated), membership standing and the **shared-household facts** (same address per
  067, same account per 068); `includeRejected` returns suppressed pairs with who rejected them and when;
  and the criteria that propose a pair are **unchanged** — no email or phone match creates one.
- [X] T009 [P] [US1] Write `tests/component/contacts.duplicatePair.test.tsx`: a row renders both sides with
  the facts above; rejecting calls the endpoint and removes the row; rejected pairs can be revealed and
  undone from the queue (FR-004a).

### Implementation

- [X] T010 [US1] Create `src/server/domain/dedup/rejectionService.ts` (FR-002, FR-004) — reject (recording both
  `dedup_normalized` values as they stand), un-reject, and list rejected pairs; durable audit rows.
- [X] T011 [US1] Suppress rejected pairs in `getMergeSuggestions` /
  `countMergeSuggestions` in `src/server/domain/dedup/suggestionService.ts` with a `NOT EXISTS` that
  matches **both** stored names against the current ones — evaluated in the same query, so a pair returns
  the moment a name differs, with no write anywhere. Add `includeRejected`.
- [X] T012 [US1] Extend the candidate projection in the same file with created/updated, membership
  standing and the shared-household facts (FR-001).
- [X] T013 [US1] Create `src/app/api/dedup/rejections/route.ts` (`POST` / `DELETE`, `dedup.write`) and
  extend `src/app/api/dedup/suggestions/route.ts` with `includeRejected`.
- [X] T014 [US1] Create `src/app/(admin)/contacts/_components/DuplicatePair.tsx` — the row: both sides with
  the deciding facts, and the reject action.
- [X] T015 [US1] Render it in the duplicates view in `src/app/(admin)/contacts/page.tsx`, with a control to
  reveal rejected pairs and undo one.

**Checkpoint**: the queue is finishable — this is the MVP.

---

## Phase 4: User Story 2 — Finish the safe rows in place (Priority: P2)

**Goal**: a row that shows everything the decision needs resolves in one action; one that does not sends
Mel where she can see the rest.

**Independent test**: a complete needs-review row clears in place; a sparse one offers open-to-resolve; a
plainly-distinct pair rejects in place; a conflicting one does not. Every row opens its record.

### Tests (write first, must fail)

- [X] T016 [US2] Extend `tests/integration/dedup.suggestions.test.ts` with the derived safe flags. ⚠️
  **Corrected after implementation** — this task originally said a pair "whose shown records conflict" is
  not safe to **reject**, which is backwards: a conflict is the strongest evidence a row can carry that
  these are two people, so it argues FOR rejecting. The two answers are opposites and need separate
  flags: `safeToReject` is blocked only by an address the row is not showing; `safeToMerge` is
  additionally blocked by a conflict, two sign-ins, or two membership accounts. See the implementation
  notes.
- [X] T017 [P] [US2] Write `tests/integration/contacts.needsReviewRow.test.ts` asserting FR-001a: a
  needs-review row carries **how the contact is reached** (phone and emails) and **record age** (created and
  last changed) alongside their identity. Today `listNeedsReview` selects only `SEARCH_COLS` — no phone, no
  email, no timestamps — so "complete enough to clear from the row" has nothing to judge against.
- [X] T018 [P] [US2] Extend `tests/component/contacts.duplicatePair.test.tsx` and add needs-review coverage
  to `tests/component/contacts.page.test.tsx`: a safe row offers its one action, an unsafe row offers
  **open to resolve** instead, and **every** row can open its record (FR-007).

### Implementation

- [X] T019 [US2] Derive the safe flag in `src/server/domain/dedup/suggestionService.ts` **from the fields
  the row projects**, not from a separate list — so adding a fact to the row can make a decision safe and
  removing one cannot leave a stale rule behind.
- [X] T020 [US2] Extend the needs-review projection in
  `src/server/domain/contacts/contactService.ts` (`listNeedsReview`) with the contact's phone, active
  emails and created/updated timestamps, so the row shows what FR-001a requires. Without this, the rule in
  the next task derives from fields that do not exist — the very coupling FR-005 exists to avoid.
- [X] T021 [US2] Apply the same rule to needs-review rows in
  `src/server/domain/contacts/contactService.ts`: a record complete enough to judge from the row can be
  cleared in place; a sparse one cannot.
- [X] T022 [US2] Wire the adaptive row actions in `src/app/(admin)/contacts/page.tsx` and
  `_components/DuplicatePair.tsx`: one action when safe, open-to-resolve when not, open-record always.

**Checkpoint**: a queue of dozens is workable without opening every row.

---

## Phase 5: User Story 3 — Compare properly, and retire the old page (Priority: P3)

**Goal**: a pair opens a real comparison showing every email on both sides, offers all three resolutions,
and `/dedup` goes away without taking anything with it.

**Independent test**: open a pair; both records shown with all their emails whatever the status; confirm a
survivor and the merge completes; link-as-shared and reject are also offered; `/dedup` no longer exists and
nothing it guarded has lost its coverage.

### Tests (write first, must fail)

- [X] T023 [US3] Write `tests/component/contacts.mergeCompare.test.tsx`: the comparison shows **every**
  email per candidate including inactive and transition ones, states the survivor inherits them all
  (FR-009), offers all three resolutions with merge visibly the destructive one (FR-015a), and the
  link-as-shared action **names the address to be adopted** and confirms before retiring one the contact
  already owns (FR-015b).
- [X] T024 [P] [US3] **Re-point, do not delete**, the two component suites that import the page T028
  removes: `tests/component/dedup.linkAsShared.test.tsx` and `tests/component/dedup.phoneEmail.test.tsx`.
  The first is currently the **only** coverage of feature 067's guard — name the address being adopted,
  confirm before retiring one the contact already owns — which FR-015b requires to survive the move. Delete
  them and that guard ships untested in the very feature that promises to carry it across. Aim both at the
  pair row and the comparison, keeping every behaviour they assert.

### Implementation

- [X] T025 [US3] Create `src/app/(admin)/contacts/_components/MergeCompare.tsx` (FR-008) — side-by-side records,
  all emails per side, the inheritance statement, and the three resolutions.
- [X] T026 [US3] Open the comparison from a pair in `src/app/(admin)/contacts/page.tsx`, carrying the
  link-as-shared safeguards across from the retired page.
- [X] T027 [US3] Remove the page's other references **before** deleting it: the hand-maintained
  `{ href: "/dedup", … }` entry in `src/server/auth/nav.ts` (feature 035's completeness guard fails CI on a
  nav entry with no page) and the `/dedup` mention in the operator message in
  `src/server/db/bootstrapOfficer.ts`. Note `routeInventory` needs no edit — it reads the source tree and
  regenerates.
- [X] T028 [US3] Delete `src/app/(admin)/dedup/page.tsx` (FR-015). Keep `/api/dedup/suggestions` and
  `/api/dedup/merge` — the queue already calls both.

**Checkpoint**: one place to work duplicates, offering all three answers a pair can have, with nothing the
old page guarded left uncovered.

---

## Phase 6: User Story 4 — Two people who both sign in (Priority: P4)

**Goal**: the merge stops failing hard. Two collisions of the same shape are held rather than thrown, and
land in the review queue for whoever can resolve them.

**Independent test**: merge two contacts who both sign in — held, nothing changed, task raised. As a
role-assigner, choose the surviving sign-in and it completes. Same for two account owners.

### Tests (write first, must fail)

- [X] T029 [US4] Write `tests/integration/dedup.heldMerge.test.ts`: two sign-in identities produce
  `held`/`two_logins` with **no data changed** (today this throws a raw
  `contact_emails_one_login_per_contact` error); two account owners produce `held`/`two_accounts` (the
  same shape, via the UNIQUE payer index); a `role.assign` holder resolves the login case and the merge
  completes; someone without it cannot; resolving with the wrong kind of choice is refused; a hold closes
  automatically when either contact is merged away or archived; a contact's review flag and a held merge
  are independent (FR-014a); and — separately from that — a contact who is **both** flagged for review and
  in a suggested pair keeps the other task when either one is resolved (FR-016).
- [X] T030 [P] [US4] Extend `tests/component/contacts.page.test.tsx`: the needs-review queue renders held
  merges alongside flagged contacts, each naming both contacts and its reason, and visibly not ordinary
  clean-up — Mel can see it is not hers to finish.

### Implementation

- [X] T031 [US4] Make `mergeContacts` in `src/server/domain/dedup/mergeService.ts` (FR-011, FR-013) return
  a discriminated
  outcome — `completed` / `held` / `refused` — instead of completing or throwing. Detect **both**
  collisions before writing anything, and roll back so a hold changes nothing.
- [X] T032 [US4] Create `src/server/domain/dedup/heldMergeService.ts` (FR-012, FR-014): raise a hold,
  list open holds,
  resolve one by applying the choice and completing the merge, and close a hold whose cause has gone.
- [X] T033 [US4] Create `src/app/api/dedup/held/route.ts` (`GET`) and
  `src/app/api/dedup/held/[id]/resolve/route.ts` (`POST`), gated by the authority for the reason —
  `role.assign` for a sign-in choice, `dedup.write` for an account choice — and return the outcome from
  `src/app/api/dedup/merge/route.ts` rather than throwing.
- [X] T034 [US4] Render held merges in the needs-review queue in `src/app/(admin)/contacts/page.tsx`,
  distinct from flagged contacts, with the resolve action shown only to whoever may act on it.

**Checkpoint**: no merge can fail with a raw database error.

---

## Phase 7: Polish & Cross-Cutting

- [X] T035 [P] Add styles for the pair row and the comparison to
  `src/app/(admin)/contacts/contacts.module.css`, keeping merge visually distinct from the two
  non-destructive resolutions.
- [X] T036 Run the full gate suite: `pnpm vitest run`, `pnpm tsc --noEmit`, ESLint, and Prettier scoped to
  changed files. Pay attention to the existing dedup and merge suites — this feature changes the merge's
  return shape, so any suite asserting "throws" needs re-pointing rather than deleting, as the two page
  suites did in T022.
- [X] T037 Run `pnpm db:migrate` against the dev database and walk the manual pass in
  [quickstart.md](./quickstart.md), including the two-role check (with and without `role.assign`).
  **Migration applied (0044, 2026-09-05); the walkthrough itself needs a signed-in staff session and the
  two-role switch, so it is left for the author.**
- [X] T038 Append an implementation-notes block to this file recording what shipped and the decisions taken
  during implementation, as in features 065–068.

---

## Dependencies

```text
Phase 1 (T001–T003) → Phase 2 merge correctness (T004–T006) → ┬─ US1 (T007–T015)  🎯 MVP
                                                               ├─ US2 (T016–T022)
                                                               ├─ US3 (T023–T028)
                                                               └─ US4 (T029–T034)
                                                                        ↓
                                                          Polish (T035–T038)
```

- **Phase 2 blocks everything**: US3 and US4 both build on the merge, and the account defect is live now.
- **US1 → US2**: the safe flag is derived from what the row projects, so the rows must exist first.
- **US1 → US3**: the comparison opens from a pair row.
- **US3 ⟂ US4**: different files — the comparison is UI, the held merge is the merge's outcome shape.
- **T011 → T018**: suppression and the pair's safe flag live in the same query; suppression lands first.
- **T020 → T021**: the needs-review row must carry the deciding facts before a rule can derive from them —
  otherwise the rule invents its own criteria, which is the coupling FR-005 exists to prevent.
- **T024, T027 → T028**: the suites must be re-pointed and the nav entry removed **before** the page is
  deleted, or the build breaks on a dangling nav entry and a guard loses its only test.
- **T031 → T032, T033**: the outcome shape defines what the hold service and endpoints carry.

## Parallel execution examples

- **Phase 1**: T003 is a different file from T001/T002.
- **US1 tests**: T008 and T009 are separate files from T007 → all three in parallel.
- **US2 tests**: T016, T017 and T018 are three separate files → fully parallel.
- **US3**: T024 is independent of T023 and can be written alongside it; both must precede T028.
- **US4**: T029 and T030 are separate files; their implementations share `mergeService` and must land in
  order.
- **Cross-story**: once US1 is green, US2 (row actions), US3 (comparison) and US4 (held merges) touch
  largely different files, with `page.tsx` the one shared edit.

## Implementation strategy

**MVP = Phases 1–2 + US1.** A queue that re-presents settled judgements cannot be worked down, so the
rejection is what makes it worth opening at all. Phase 2 rides along because the merge defect is live —
merging an account owner today strands that household's account, and the queue can already merge.

**Increment 2 = US2**, which turns a readable queue into a workable one — on **both** queues: the
needs-review row gains the facts its decision depends on (T020) at the same time as the pair row's rule
lands.

**Increment 3 = US3**, the comparison and the retirement of `/dedup`.

**Increment 4 = US4**, the held merges. Last because it is rare — but it is the only part that replaces a
**hard failure**: two sign-in identities currently throw a raw constraint error, so that path has never
worked.

Four notes. The suppression rule needs **no maintenance**: a rejected pair returns the instant a name
differs from the one judged, because the comparison happens at query time rather than being cached. The two
collisions are deliberately one mechanism — a survivor may hold only one of something both parties have —
so they share a table, a queue task, and a test pattern rather than being solved twice. Retiring a page is
never just a deletion: it holds a nav entry that fails CI if orphaned, and suites whose coverage has to be
moved rather than lost. And a rule that reads "safe when the row shows everything" is only as good as what
the row projects — which is why **both** row types get their deciding facts before either rule is derived.

---

## Implementation notes (2026-09-05)

### What shipped

**Migration `0044_triage_worklists.sql`** — `held_merge_reason` enum, `dedup_rejections` (the pair plus
**both `dedup_normalized` values as they stood**), `held_merges` (partial unique index on the pair while
`resolved_at IS NULL`, so retrying a blocked merge does not pile up duplicate holds).

**The rejection is data, not a flag.** `dedup_rejections` stores the two names at the moment of judgement,
and `suggestionService` compares them to the current ones in the same query that proposes the pair. The
lapse therefore needs no maintenance and is correct through every rename path, including paths added later
— `dedup.rejections.test.ts` asserts a rename returns the pair **with the rejection row byte-identical**,
which is the property, not just the behaviour.

**A merge now has three endings.** `mergeContacts` returns `completed | held`, detecting **both**
collisions — two sign-ins (`contact_emails_one_login_per_contact`) and two membership accounts
(`membership_accounts_payer`) — *before* opening the transaction, so a hold writes nothing but the
`held_merges` row. Resolving applies the choice and completes the merge in one go.

**Feature 068's merge defect is fixed (FR-010).** `mergeService` was still relinking the retired
`memberships` / `payers` tables and did nothing with `membership_accounts` / `membership_members`. Latent
only because no merge had happened since 068 — the queues this feature builds are exactly what would have
triggered it. It also now handles both contacts being attached to the *same* account (PK collision) by
dropping the losing attachment rather than colliding.

**`/dedup` is gone.** Nav entry removed, `bootstrapOfficer`'s operator message re-pointed at
"Contacts → Review duplicates", the page deleted. Its two component suites were **re-pointed, not
deleted**: `dedup.linkAsShared.test.tsx` now drives the same guard through the queue → comparison, and
`dedup.phoneEmail.test.tsx` asserts the same display facts on the new pair row.

### Decisions taken during implementation

**The merge outcome is `completed | held`, not `completed | held | refused` as T031 sketched.** Same
contact and already-merged stay thrown `ApiError`s (422 / 409) — that is how every other route in the app
reports a bad request, and it is what the contract's own status table describes. A `refused` variant that
the route immediately converted back into an HTTP error would have been a third spelling of the same thing.

**`listNeedsReview` now derives membership standing** (`deriveSummaries`), which it never did — the search
rows have derived it since 068 while the review queue showed the cached column. Fixing it here was one line
and directly serves FR-001a: Mel should not judge a record against a status that is not true.

**Adding phone and emails to the review row put PII on a `base` route.** `projectContact` is a **denylist**,
so this was not optional — without it the queue would have handed every volunteer the addresses that
`GET /api/contacts/[id]` withholds from them. `safeToClear` is re-derived **after** projection, so the flag
describes the row *this* reader actually gets: a volunteer who cannot see the contact details is correctly
told the row is not resolvable in place. `contacts.needsReviewRow.test.ts` guards it.

**The row's two answers are derived separately, and the first attempt conflated them.** As shipped, a pair
whose phone numbers differed was refused the "not duplicates" action — using the strongest evidence a row
can carry that these are *two people* to block the very action that says so. The same mistake blocked
rejection on two sign-ins and on two membership accounts. On the club's data that was **18 of 103 pairs
wrongly sent to the comparison, and zero blocked for the one reason that was right.**

The error was reading FR-006's illustrative list ("records conflict on the fields that matter… both
contacts sign in") as reasons a pair cannot be **rejected**, when they are reasons it cannot be **merged**.
Merge and reject are opposite answers to one question, so what blocks one largely *enables* the other:

- `safeToReject` — blocked only by an address the row is not showing, which might have proved these are
  the same person. Nothing else can undermine "these are different people".
- `safeToMerge` — additionally blocked by anything making the pair look like two people (differing phones,
  two unshared membership accounts) and by a collision the row cannot resolve (two sign-ins, FR-011).
  Those go to the comparison, where the records are visible and the held-merge path exists.

`safeToClear` on a needs-review row was unaffected — it has only one answer.

**A contact reached only through a household address rendered as "No email".** The projection listed OWNED
active addresses, so the four contacts that ride someone else's address (067) showed nothing — reading as a
sparse record when it is in fact evidence of a distinct person. The row now names the owner and the
address, and `MergeSuggestionContact` carries `messageRecipient`.

**The suggestions route was leaking PII, and this feature would have made it worse.** `GET
/api/dedup/suggestions` is `requires: "base"` and had returned each candidate's phone and addresses
unprojected since feature 033 — the same class of gap fixed for the needs-review rows, and adding the
ridden household address (someone *else's* address) would have compounded exactly what 067's C1
clarification forbade. `projectSuggestion` now strips reach for a reader without `contact.pii.read`, keeps
the owner's display name, records the disclosure audit, and sets `hasUnshownAddress` — from which both
safety flags fall out on their own, with no second rule to keep in step.

**`DuplicatePair` now imports the server's projection type instead of mirroring it.** The hand-written copy
had already drifted silently; since FR-005 makes the row's actions a function of the fields it displays,
the row and the derivation must share one definition.

**`TriageList` gained `rowActions` and `rowLabel`.** The shared worklist row was entirely one open-the-record
button, with nowhere to put the row's own resolution. It stays presentation-only — the consumer supplies the
control and owns what it does.

**Held merges are read with `dedup.write` but resolved by the reason's own authority** — `role.assign` for a
sign-in, `dedup.write` for an account. Mel sees the hold and sees it is not hers to finish; the resolve
action simply is not rendered for her on the sign-in case.

### Follow-up: a merge cannot currently be undone

**Status: known gap, deliberately not fixed here — it changes `merge_audit`'s shape and deserves its own
feature.** Raised 2026-09-06 when the question "is there a way to undo a mistaken merge?" turned out to
have the answer "no, and a code comment says otherwise."

**What survives.** The retired contact's own row is intact: `merged_into_id` is set, but names, phone,
pronouns, source and timestamps are untouched. `UPDATE contacts SET merged_into_id = NULL WHERE id = …`
brings the contact back as an active record.

**What does not.** `merge_audit.relinked_counts` records COUNTS, never identifiers —
`{"contact_emails": 2, …}`. After reactivating, nothing says *which* two addresses were theirs: the emails
sit on the survivor, indistinguishable from its own. The same is true of a moved membership account or
attachment. `mergeService`'s comment claimed the soft-retirement preserved "reversibility"; the retirement
is reversible, the relinking is not. That comment is now corrected in place, as is the `mergeAudit` schema
doc, at each point where the loss actually occurs.

**Two paths are outright destructive**, both introduced by this feature:

- a `membership_members` row is DELETED when both contacts are attached to the same account (a PK
  collision on `(account_id, contact_id)`), with no record that it existed;
- resolving a `two_accounts` hold DELETES the account not chosen, taking its level, expiry and
  last-payment date. Only its attachments survive, folded onto the surviving account.

**So the only recovery for a bad merge today is a database restore.** 36 merges are already recorded in
`zak1_dev`, so this is live, not hypothetical.

**What a fix would take** (the shape of the follow-up feature):

1. Record moved row ids, not just counts — a `moved_ids` jsonb on `merge_audit`, or a child table. This is
   the migration that makes an unmerge mechanical.
2. Stop deleting. Mark the losing `membership_members` row and the unchosen `membership_accounts` row as
   superseded rather than dropping them, so a reversal has something to restore.
3. An unmerge service + endpoint, gated on `dedup.write`, that clears `merged_into_id` and walks the
   recorded ids back. Guard it: a merge whose survivor has since been merged again, or whose moved rows
   have since been edited, is not safely reversible and must say so rather than half-restore.
4. Decide the retention window. Reversibility that only holds for a while is honest and cheap; permanent
   reversibility means never hard-deleting anything a merge touched.

Only merges made *after* such a feature ships could be undone. The 36 already recorded stay
restore-only.

### Deferred / follow-ups

- Resolving a `two_accounts` hold has no dedicated picker yet: the queue's **Resolve** opens the record.
  The service and endpoint accept `survivingAccountId` and are covered by
  `dedup.heldMerge.test.ts`; wiring a chooser into the comparison is the obvious next slice.
- The `two_logins` resolution is likewise service- and endpoint-complete; the officer-facing chooser is not
  built.
- **No unmerge** — see the follow-up section above. A mistaken merge is recoverable only by restoring the
  database.
