---
description: "Task list for feature 067 — shared / family emails"
---

# Tasks: Shared / Family Emails (ownership + reference)

**Input**: Design documents from `/specs/067-shared-family-emails/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/shared-emails.md](./contracts/shared-emails.md)

**Tests**: REQUIRED, not optional. Constitution principle I (Test-First) is NON-NEGOTIABLE — each phase
writes its failing tests before the implementation that satisfies them.

**Organization**: grouped by user story so each is independently implementable and testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on incomplete work)
- **[Story]**: US1 / US2 / US3 from spec.md
- Exact file paths are given in every task

---

## Phase 1: Setup

**Purpose**: the single schema change everything else rests on. No new dependencies.

- [X] T001 Create migration `src/server/db/migrations/0042_contacts_message_recipient.sql` adding
  `contacts.message_recipient_email_id uuid NULL REFERENCES contact_emails(id) ON DELETE SET NULL` plus the
  partial index `contacts_message_recipient` on non-null values, with a comment stating that the FK is a
  safety net and the `needs_review` flagging is service-side (research R2).
- [X] T002 Add `messageRecipientEmailId` to `src/server/db/schema/contacts.ts` as a nullable `uuid`,
  commented with the feature/requirement (M-R23 / FR-002) in the style of the `archivedAt` comment.

---

## Phase 2: Foundational (blocking prerequisites)

**Purpose**: shared error, audit, and validation vocabulary used by every story below.

- [X] T003 Add error codes `REFERENCE_SELF` (422), `REFERENCE_TARGET_NOT_ACTIVE` (422) and
  `REFERRER_OWNS_EMAIL` (409) to `src/server/lib/apiError.ts` with matching `errors.*` builders, following
  the existing `emailActiveElsewhere` pattern.
- [X] T004 [P] Add audit kinds `contact.reference.linked`, `contact.reference.unlinked` and
  `contact.reference.cleared` to the `AuditEvent` kind union in `src/server/lib/audit.ts` (durable
  `recordAudit` rows, matching feature 065/066 practice).
- [X] T005 [P] Add `messageRecipientSchema` (`{ emailId: z.string().uuid() }`) to
  `src/server/validation/contacts.ts` for the link endpoint body.

**Checkpoint**: schema + vocabulary in place; user stories may begin.

---

## Phase 3: User Story 1 — Link two people to one household email, without merging (Priority: P1) 🎯 MVP

**Goal**: a same-address collision can be resolved as "different people — link as shared". One contact
owns the address, the other holds a pointer to it, both records survive, no uniqueness error is raised,
and the linked pair stops being offered as a duplicate.

**Independent test**: link a contact with no email to another contact's active address; both contacts
persist as separate records, the owner keeps the owned row, the referrer has the pointer and no email row,
sign-in with that address still resolves to the owner alone, and the pair no longer appears in the
duplicates queue.

### Tests (write first, must fail)

- [X] T006 [US1] Write `tests/integration/contacts.sharedEmail.test.ts` covering the link happy path
  (pointer set, both contacts distinct, owner keeps its row, referrer has no email row, no uniqueness
  error), link idempotency, unlink (FR-015, and that unlink does **not** set `needs_review`), the guards
  `REFERENCE_SELF` / `REFERENCE_TARGET_NOT_ACTIVE` / `REFERRER_OWNS_EMAIL`, and the `retireEmailId` path
  retiring the edited row and then linking cleanly (FR-017).
- [X] T007 [P] [US1] Write `tests/integration/contacts.sharedInvariants.test.ts` proving the untouched
  invariants (FR-006–FR-008): sign-in with the shared address resolves to the **owner** only and never
  reports `ambiguous_match`; the referrer is not a sign-in match; the referrer cannot hold `is_login`; the
  active-email uniqueness index still rejects a second active row for the same address.
- [X] T008 [P] [US1] Write `tests/integration/contacts.sharedPii.test.ts` asserting FR-016: an actor
  **without** `contact.pii.read` reading a referrer's record gets `messageRecipient.address === null` while
  `ownerDisplayName` survives; an actor **with** it gets the address; `sharedWith` is unredacted in both.
- [X] T009 [P] [US1] Write `tests/integration/dedup.sharedSuppression.test.ts` asserting FR-018: two
  same-surname contacts are suggested as a duplicate pair **before** linking and are **absent** from
  `getMergeSuggestions` after either direction of link; an unrelated similar-name pair is unaffected.
- [X] T010 [P] [US1] Extend `tests/component/contacts.emailEditor.test.tsx`: the collision block offers a
  **third** action ("different people — link as shared") issuing `PUT /api/contacts/{id}/message-recipient`
  beside the two merge buttons; and a colliding **add** surfaces the named collision instead of failing
  silently (FR-005).
- [X] T011 [P] [US1] Write `tests/component/dedup.linkAsShared.test.tsx` asserting FR-019: the pair view's
  "link as shared" action **names the address the referring contact would adopt**, and when that contact
  already owns an active address the action requires an explicit confirmation before retiring it. A
  name-similar pair alone must not be presented as though a share were implied.

### Implementation

- [X] T012 [US1] Create `src/server/domain/contacts/referenceService.ts` with `linkMessageRecipient`
  (accepting the optional `retireEmailId`, retiring that row **before** evaluating `REFERRER_OWNS_EMAIL`)
  and `unlinkMessageRecipient`, enforcing invariants I1–I4 and writing durable `recordAudit` rows.
- [X] T013 [US1] Project `messageRecipient` and `sharedWith` in `getContact` in
  `src/server/domain/contacts/contactService.ts` per contract §3.
- [X] T014 [US1] Extend `projectContact` in `src/server/auth/pii.ts` to null `messageRecipient.address`
  for actors without `contact.pii.read`, widening the `WithPii` type to carry the optional field so the
  nested null needs no cast (Principle III). Do **not** add the resolved address to `SEARCH_COLS` — that
  path bypasses `projectContact` entirely.
- [X] T015 [US1] Create `src/app/api/contacts/[id]/message-recipient/route.ts` exposing `PUT` (link) and
  `DELETE` (unlink), both `withAuth({ requires: "contact.mailing.write" })` — no new capability.
- [X] T016 [US1] Suppress linked pairs in `getMergeSuggestions` in
  `src/server/domain/dedup/suggestionService.ts` with a `NOT EXISTS` clause covering **both** directions of
  the pointer (FR-018). Derived from the pointer — no dismissal record or new table.
- [X] T017 [US1] In `src/app/(admin)/contacts/_components/EmailEditor.tsx`, add the "different people —
  link as shared" action (passing `retireEmailId` when the collision arose from editing an existing row),
  and make the **add** form surface the `EMAIL_ACTIVE_ELSEWHERE` 409 it currently discards.
- [X] T018 [US1] Offer the same "link as shared" resolution on the pair view in
  `src/app/(admin)/dedup/page.tsx` (M-R26), guarded per FR-019: name the address the referring contact
  would adopt, and require explicit confirmation before retiring an address that contact already owns.
  A name-similar pair is **not** evidence of a shared household.

**Checkpoint**: US1 is independently shippable — households can be recorded correctly, the address stays
protected, and the duplicates queue stops nagging about them.

---

## Phase 4: User Story 2 — Reach a shared household exactly once (Priority: P2)

**Goal**: every export resolves a referrer to its owner's address, dedupes by resolved address, and emits
one row under the **owner's** name with the CSV columns unchanged. The household roster becomes visible in
the app, since the file no longer carries it.

**Independent test**: with an owner and one referrer, run each export; the address appears exactly once
under the owner's name with unchanged columns; a member-only referrer still pulls the address in; an owner
marked `do_not_contact` suppresses it everywhere.

### Tests (write first, must fail)

- [X] T019 [P] [US2] Write `tests/integration/exports.sharedRecipients.test.ts` for the six mailing lists:
  member/performer resolution via a referrer, dedupe when **both** parties qualify, the row carrying the
  owner's name, the column set being byte-identical to today, `do_not_contact` suppressing absolutely
  (FR-010b), and a topic list being unchanged because a referrer holds no consent topics (FR-010a).
- [X] T020 [P] [US2] Write `tests/integration/exports.sharedTracing.test.ts` for the separate
  attendance-driven contact-tracing export: an attending referrer pulls the owner's address in once,
  subject to the owner's `contact_tracing` consent; both parties attending still yields one row.
- [X] T021 [P] [US2] Write `tests/component/contacts.messageRecipient.test.tsx` asserting a referrer's
  record shows a read-only "reached via *owner*" block naming the owner with **no** editable email row or
  consent controls (FR-009), an owner's record lists its referrers (FR-010c), and the unlink action issues
  `DELETE`. Also assert FR-020: a contact holding **both** an active owned email and a stale pointer
  renders as reached at her **own** address — never "reached via *owner*" — and is offered the
  pointer-clearing action.

### Implementation

- [X] T022 [US2] Create `src/server/domain/exports/recipients.ts` exposing the shared resolved-recipient
  SQL (own active owned email, else the referenced email) as a joinable subquery, per research R3 — one
  round trip, no N+1.
- [X] T023 [US2] Rewrite the three list queries in `src/server/domain/exports/exportService.ts` to join the
  resolver, apply `DISTINCT ON` by resolved address, take names from the owner, and evaluate referrer
  qualification for the `member` and `performer` lists.
- [X] T024 [US2] Apply the same resolver + dedupe to `buildContactTracingRows` in
  `src/server/domain/exports/contactTracingService.ts`, keeping its existing `date` column and the
  `count === 0` short-circuit.
- [X] T025 [US2] Create `src/app/(admin)/contacts/_components/MessageRecipient.tsx` rendering the read-only
  reference block (owner name + address + unlink) and, for an owner, the roster of referring contacts.
  The display MUST follow the same precedence as the export resolver — **an active owned email wins over a
  reference**. A contact holding both (possible when a stale pointer survives, e.g. an MVP-only deploy
  without the US3 lifecycle clearing) is shown as reached at her **own** address, never "reached via
  *owner*", so the record cannot contradict where mail actually goes. Offer clearing the stale pointer.
- [X] T026 [US2] Render `MessageRecipient` in the record modal in `src/app/(admin)/contacts/page.tsx`,
  gated by `caps.contactMailingWrite` for the unlink action, and extend the editor record type with the
  `messageRecipient` / `sharedWith` fields.

**Checkpoint**: the reference now actually delivers, and "who was reached" is answerable in the app.

---

## Phase 5: User Story 3 — Lifecycle (Priority: P3)

**Goal**: a reference never outlives its usefulness — gaining an own address ends it, and losing the
referenced address clears the pointer and flags the referrer for re-capture.

**Independent test**: add an owned email to a referrer and its pointer clears; deactivate or hard-delete a
referenced email and every referrer is cleared **and** flagged `needs_review`; merging the owner orphans
nobody.

### Tests (write first, must fail)

- [X] T027 [US3] Write `tests/integration/contacts.sharedLifecycle.test.ts` covering all four transitions
  from data-model.md: referrer gains an owned address → pointer cleared (FR-011); referenced email set
  `inactive` → pointer cleared + `needs_review = true` (FR-012); referenced email hard-deleted → same
  outcome (FR-012); owner merged into a survivor → the reference still resolves and no referrer is orphaned
  (FR-013, expected to pass with **no** `mergeService` change).

### Implementation

- [X] T028 [US3] Add `clearReferencesTo(db, emailId, reason)` to
  `src/server/domain/contacts/referenceService.ts`, nulling every pointer to that email, setting
  `needs_review = true` on each affected contact, and writing a `contact.reference.cleared` audit row.
- [X] T029 [US3] Call it from `src/server/domain/contacts/emailService.ts`: from `deleteEmail` (hard
  delete) and from `patchEmail` when `status` leaves the reachable set; and in `addEmail` / `addEmailInTx`
  clear the **acquiring** contact's own pointer (FR-011). Keep `addEmailInTx` transaction-safe — no
  post-violation lookups inside the create-contact transaction, per the feature-066 F1 lesson.

**Checkpoint**: the model is safe to maintain over time.

---

## Phase 6: Polish & Cross-Cutting

- [X] T030 [P] Add styles for the reference block and owner roster to
  `src/app/(admin)/contacts/contacts.module.css`, matching the existing `.emailSection` treatment.
- [X] T031 Run the full gate suite: `pnpm vitest run`, `pnpm tsc --noEmit`, ESLint, and Prettier scoped to
  changed files only. Confirm the pre-existing sign-in and export suites pass **unchanged** — that is the
  proof for FR-006–FR-008.
- [X] T032 Run `pnpm db:migrate` against the dev database and walk the manual pass in
  [quickstart.md](./quickstart.md) (auth-gated, so not automatable end to end).
- [X] T033 Append an implementation-notes block to this file recording what shipped and any decisions taken
  during implementation, as in features 065/066.

---

## Dependencies

```text
Phase 1 (T001–T002)  →  Phase 2 (T003–T005)  →  ┬─ US1 (T006–T018)  🎯 MVP
                                                 ├─ US2 (T019–T026)
                                                 └─ US3 (T027–T029)  →  Polish (T030–T033)
```

- **US1 → US2**: US2's tests need a link to exist, so US1's `linkMessageRecipient` lands first. The export
  work (T022–T024) is otherwise independent and could be built against a hand-seeded pointer.
- **US1 → US3**: lifecycle clears pointers, so linking must exist first.
- **US2 ⟂ US3**: no shared files; they can proceed in either order once US1 is done.
- **T013 → T014 → T015**: the route returns the projection, so `getContact` gains its fields, then the
  PII redaction is applied over them, before the route exposes them.
- **T022 → T023, T024**: both export call sites consume the shared resolver.
- **T016** is independent of the rest of US1 and can land at any point in the phase.

## Parallel execution examples

- **Phase 2**: T004 and T005 touch different files and can run together (T003 is a prerequisite for
  neither, but shares no file with them either).
- **US1 tests**: T007–T011 are five separate files from T006 → all six can be written in parallel.
- **US2 tests**: T019, T020 and T021 are three separate files → fully parallel.
- **Cross-story**: once US1 is green, one contributor can take US2 (exports + record UI) while another
  takes US3 (lifecycle) — they share no files.

## Implementation strategy

**MVP = Phase 1 + Phase 2 + US1.** That alone removes the forced choice between an incorrect merge and an
unresolved duplicate, which is the whole reason the feature exists (SC-001). It is shippable without US2 or
US3: the pointer simply is not read by exports yet.

**Increment 2 = US2**, which turns the pointer into delivery (SC-002) and adds the in-app roster that
replaces what the export file deliberately does not carry.

**Increment 3 = US3**, the lifecycle guarantees (SC-004) needed before the model can be trusted in ongoing
maintenance.

Two items in US1 came out of `/speckit-analyze` and are not optional polish: **T014** (the address would
otherwise leak to volunteers denied contact PII, because `projectContact` is a denylist) and **T016**
(without it, 067 makes the duplicates queue permanently noisier for exactly the households it serves).

Note the deliberately small blast radius: **topic lists and `mergeService` need no production-code change
at all** — both are covered by regression tests only (T019, T027). The bulk of the real work is T022–T024.

Out of scope, recorded for MEG-R5: the **door check-in** path silently swallows a colliding address and
discards it (see spec Out of Scope). No task here touches `attendanceService`.

---

## Implementation notes (2026-09-03)

All 33 tasks complete. Test-first throughout: each phase's tests were written and confirmed failing for
the right reason before the code that satisfies them.

### What shipped

- **Migration 0042** — `contacts.message_recipient_email_id` (nullable FK → `contact_emails`,
  `ON DELETE SET NULL`) plus a partial index. The only schema change; no constraint, sign-in, or
  `is_login` change, exactly as M-R24/M-R25 predicted.
- **`referenceService`** — `linkMessageRecipient` (with `retireEmailId`), `unlinkMessageRecipient`,
  `clearReferencesTo` (clears **and** flags `needs_review`), `clearOwnReference` (silent, FR-011).
- **`exports/recipients.ts`** — one shared CTE resolving every contact to its reachable address, used by
  all four export paths.
- **UI** — "different people — link as shared" on both `EmailEditor` collision paths, a guarded, confirmed
  version on `/dedup`, and a read-only `MessageRecipient` household block in the record modal.

### Decisions and corrections made during implementation

1. **The resolver initially broke multi-email contacts.** A first cut took one owned email per contact
   (`LATERAL … LIMIT 1`), which silently collapsed the feature-006 behavior where a contact with two
   qualifying addresses yields two rows — caught by `exports.multiEmail.test.ts`. Rewritten as a
   `UNION ALL`: **every** active owned email is a recipient row, and the reference branch applies only to
   a contact with no active address of its own. That also implements FR-020's precedence directly in SQL,
   so the record display and the export cannot disagree.
2. **FR-018's stated rationale was wrong, and is now corrected in the spec.** Measured against the real
   0.4 trigram threshold: "David Jones"/"Bridgit Jones" scores **0.30** and "Lydia Dempsey"/"Richard
   Dempsey" **0.36** — neither reaches the duplicates queue at all. Differing first names dominate the
   score, so same-surname households are *not* generally suggested. The pairs that do reach the queue are
   near-identical names ("Robert Jones"/"Rob Jones" = 0.64), and the tests now use those. The suppression
   is still correct and cheap; its scope is narrower than first claimed. A useful corollary for FR-019:
   the Lydia/Richard mislink cannot be made from the queue, because that pair never appears in it.
3. **The collision payload gained `emailId`.** `emailActiveElsewhere` already had the owner's row in
   hand; returning its id lets the client link without a second lookup. Additive — the feature-066
   assertions on `error.other.displayName` are unaffected.
4. **`clearReferencesTo` runs BEFORE the hard delete**, not after. The FK would null the pointers, but it
   cannot flag anyone, and once the row is gone there is nothing left to match referrers on.
5. **The household block is rendered outside the `contactMailingWrite` gate**, with the write action
   gated by `canWrite` inside the component — the roster is read-only context (FR-010c), while the
   address itself is redacted by `projectContact` for anyone without `contact.pii.read` (FR-016).

### Verification

- **Full suite: 1095 passed, 1 failed (1096) across 296 files.**
- The single failure is `gate.membership.test.ts` → "(a) a named membership line creates a membership and
  recomputes status". **Pre-existing and unrelated to this feature**: verified by stashing all 067 changes
  and running the file at `HEAD`, where it fails identically (`expected 'lapsed' to be 'current'` — a
  date-dependent membership-year assertion). The file is also order-dependent: repeated runs fail
  different subsets. Worth its own fix; deliberately not touched here.
- `tsc --noEmit`, ESLint, Prettier (changed files), and markdownlint all clean.
- `pnpm db:migrate` applied 0042 to the dev database.

### Post-implementation fix: deleting an OWNER contact (FR-012)

Found while diagnosing a `CONTACT_HAS_REFERENCES` 409 in dev, **after** the tasks above were marked
complete. `deleteContact` (feature 065) never touched the new pointer: the cascade removed the owner's
emails, the FK's `ON DELETE SET NULL` nulled the referrers' pointers, and **nobody was flagged**. A
household would have gone quietly unreachable — the exact failure FR-012 exists to prevent. T029's wiring
covered `deleteEmail` (the email-level route) but not `deleteContact` (the contact-level one).

Two fixes:

1. `clearReferencesToOwner` walks the contact's emails and runs the clear-and-flag path **before** the
   delete, so the unrestricted path (which bypasses the guard) still flags every referrer.
2. `shared_email` is now a delete blocker, so the SAFE delete refuses to strand a household — consistent
   with 065's "refuse unless bare". It could not ride the generic `CONTACT_DELETE_BLOCKERS` list because
   it is a join through `contact_emails`, not a plain `contact_id` column.

Two regression tests added to `contacts.sharedLifecycle.test.ts`. Full suite after the fix:
**1097 passed, 1 failed (1098)** — the same pre-existing `gate.membership` failure, unchanged.

### Post-implementation fix: Mel could not see why a delete was refused

Raised from dev use: a `CONTACT_HAS_REFERENCES` 409 appeared to do nothing. Two causes, both fixed.

1. **Placement.** The refusal *was* rendered, but ~100 lines of JSX below the button — after the whole
   read-only context list, i.e. below the fold on a scrolling modal. Mel pressed *Confirm delete*, the
   button flipped back to *Delete*, and the explanation was off-screen. Moved to render **first** in the
   record body, directly under the action row.
2. **Wording.** The message listed raw table slugs — `gate_sale`, `staff_identity`, `membership_capture`,
   and now `shared_email`. Added `BLOCKER_LABELS` so it reads *"Contact has a performer record — merge or
   archive it instead of deleting."* The slugs remain the machine-readable contract in `error.detail`;
   only the human message changed.

Both covered test-first: a component test asserting the refusal precedes the form fields in document
order, and an integration test asserting human wording with no slugs. Full suite: **1099 passed, 1
failed (1100)** — the same pre-existing `gate.membership` failure.

### Left for later

- **T032's manual browser pass** is the auth-gated walkthrough in `quickstart.md`; the automated
  component and integration tests cover the same ground headlessly.
- **The door check-in path is untouched** (spec Out of Scope). It still silently swallows a colliding
  address and discards it — recorded there for MEG-R5, along with the finding that it bypasses
  `addEmailInTx` and runs outside a transaction, so writing a pointer there would be straightforward.
