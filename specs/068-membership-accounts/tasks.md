---
description: "Task list for feature 068 — membership accounts"
---

# Tasks: Membership Accounts

**Input**: Design documents from `/specs/068-membership-accounts/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/membership-accounts.md](./contracts/membership-accounts.md)

**Tests**: REQUIRED. Constitution principle I (Test-First) is NON-NEGOTIABLE — each phase writes its
failing tests before the code that satisfies them.

**Organization**: grouped by user story so each is independently implementable and testable. The migration
is deliberately split (0043 DDL → testable data move → 0044 drop) so that no phase leaves the suite red.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on incomplete work)
- **[Story]**: US1 / US2 / US3 / US4 from spec.md
- Exact file paths are given in every task

---

## Phase 1: Setup — new structures beside the old

**Purpose**: bring the account model into existence without disturbing anything that reads the old one.
After this phase both models coexist and every existing test still passes.

- [X] T001 Create migration `src/server/db/migrations/0043_membership_accounts.sql`: `membership_accounts`
  (payer contact, level, expiry, last payment date; unique on payer; **no `ON DELETE` on the payer FK** so
  the database refuses an ownerless account per FR-009) and `membership_members` (account ↔ contact,
  cascading both ways), plus `gate_sales.membership_level` (nullable). **DDL only — no data move, no
  drops.**
- [X] T002 Add `membershipAccounts` and `membershipMembers` to `src/server/db/schema/memberships.ts`,
  leaving the existing `memberships` and `payers` definitions in place for now.
- [X] T003 [P] Add `membershipPaymentSchema` (`level`, `paymentDate`), `accountMemberSchema` (`contactId`)
  and `accountLevelSchema` (`level`) to `src/server/validation/memberships.ts`.

**Checkpoint**: schema exists; nothing reads it yet; full suite still green.

---

## Phase 2: Foundational (blocking prerequisites)

**Purpose**: the vocabulary and the single derivation every story below depends on.

- [X] T004 Add error codes `LEVEL_CAPACITY_EXCEEDED` (422), `LEVEL_ADMITS_NO_MEMBERS` (409),
  `PAYER_NOT_DETACHABLE` (409) and `ACCOUNT_NOT_FOUND` (404) to `src/server/lib/apiError.ts`, with builders
  that name the displaced people rather than counting them.
- [X] T005 [P] Add audit kinds `membership.payment_recorded`, `membership.level_changed`,
  `membership.member_attached`, `membership.member_detached` to `src/server/lib/audit.ts`.
- [X] T006 Write `tests/integration/membership.derivedStatus.test.ts` — the derivation is the load-bearing
  idea, so it is specified first: status from the **most generous** covering account (FR-010), level only
  for the account a contact **pays for** (FR-013), `is_member` from attachment (FR-011), a boundary passing
  changes the answer with **no write**, and a deliberately-wrong `contacts.membership_status` is ignored.
- [X] T007 Create `src/server/domain/membership/membershipStatus.ts` exposing the coverage derivation as
  one joinable SQL fragment (status / level / expiry / is-member), reusing `classifyMembership` for the
  status rule. This is the only place status is derived; every read path joins it.

**Checkpoint**: status can be derived from accounts; user stories may begin.

---

## Phase 3: User Story 1 — Record a dues payment as an account (Priority: P1) 🎯 MVP

**Goal**: the FS records one payment — payer, level, date — and the system opens or renews that payer's
account, deriving the validity itself.

**Independent test**: record a payment for a contact with no account; an account exists at that level with
a correctly derived expiry and the payer attached. Record a second payment; the same account moves forward.

### Tests (write first, must fail)

- [X] T008 [P] [US1] Write `tests/integration/membership.accounts.test.ts`: opening an account (FR-001,
  FR-002, FR-007), renewal moving the expiry on the **same** account without touching members (FR-004),
  renewal changing the level (FR-024), and the renewal no-op when already covered beyond the target.
- [X] T009 [P] [US1] Write `tests/integration/membership.deleteGuard.test.ts`: deleting a contact who owns
  an account is refused, the refusal names *"a membership account"* in human wording (FR-009, FR-009a), and
  the super-user force path still succeeds.
- [X] T010 [P] [US1] Write `tests/integration/gate.membershipLevel.test.ts`: a gate membership line carries
  a level, the level is required on membership lines and rejected elsewhere, and the **amount is
  independent of the level** (FR-003, FR-005) with the money reconciliation unchanged.

### Implementation

- [X] T011 [US1] Create `src/server/domain/membership/accountService.ts` with `recordDuesPayment` —
  open-or-renew keyed on the payer, expiry from `grantedMembershipExpiry`, payer attached on create
  (FR-007), level applied per FR-024, durable audit row.
- [X] T012 [US1] Add account ownership to `CONTACT_DELETE_BLOCKERS` and a `BLOCKER_LABELS` entry
  (*"a membership account"*) in `src/server/domain/contacts/contactService.ts` — it is a plain contact
  column, so it rides the generic blocker list.
- [X] T013 [US1] Carry `membershipLevel` through the gate save: `src/server/validation/door.ts` (required
  on `membership` lines, as `contactId` already is) and `src/server/domain/door/doorRecordService.ts`
  (pass it to `recordDuesPayment`, keeping the existing renewal no-op).
- [X] T014 [US1] Add the level selector to the membership line in `src/app/(door)/gate/page.tsx`.
- [X] T015 [US1] Create `src/app/api/contacts/[id]/membership/payment/route.ts` (`POST`, requires
  `membership.write`) per contract §1 — this is the out-of-door path for a posted cheque (FR-006),
  recording membership only, with no financial record.

**Checkpoint**: dues can be recorded through both channels; the MVP is shippable.

---

## Phase 4: User Story 2 — Attach the household (Priority: P2)

**Goal**: an account covers a household, maintained from the payer's contact record, within the capacity
its level allows.

**Independent test**: attach a second contact to a family account and see them covered; attach to an
individual account and be refused; lower a level that would displace members and be refused by name.

### Tests (write first, must fail)

- [X] T016 [P] [US2] Write `tests/integration/membership.capacity.test.ts`: `individual` and `student`
  admit the payer alone (FR-003a), `family`/`supporter` admit others, lowering a level that would displace
  members is refused **naming them** (FR-023), and the payer cannot be detached (FR-007/FR-009).
- [X] T017 [P] [US2] Write `tests/integration/contacts.membershipProjection.test.ts`: a member's record
  names the payer (FR-018), a payer's record lists the other members (FR-019), a contact who both pays and
  is covered shows both, and the block carries **names and ids only** — no address or phone — so
  `projectContact` needs no new redaction (contract §4).
- [X] T018 [P] [US2] Write `tests/component/contacts.membershipAccount.test.tsx`: the account block renders
  for payer and member, add/remove and level controls appear only with membership-write authority
  (FR-017), a capacity refusal is shown, and the block is **labelled distinctly from the 067 shared-email
  block** (FR-020).

### Implementation

- [X] T019 [US2] Add `attachMember`, `detachMember` and `changeLevel` to
  `src/server/domain/membership/accountService.ts` (FR-008, FR-022), enforcing the capacity rule on both
  edges and refusing with the displaced people named. Attachments are untouched by renewal (FR-008).
- [X] T020 [US2] Project the `membership` block (`status`, `expiryDate`, `asPayer`, `asMember`) in
  `getContact` in `src/server/domain/contacts/contactService.ts`, sourcing status from
  `membershipStatus.ts` rather than the stored column.
- [X] T021 [US2] Create `src/app/api/contacts/[id]/membership/members/route.ts` (`POST`/`DELETE`) and
  `src/app/api/contacts/[id]/membership/route.ts` (`PATCH` level), both requiring `membership.write`
  (FR-022, FR-023).
- [X] T022 [US2] Create `src/app/(admin)/contacts/_components/MembershipAccount.tsx` — the account block:
  payer view with members and controls, member view naming the payer, capacity refusals surfaced.
- [X] T023 [US2] Render it in `src/app/(admin)/contacts/page.tsx`, visually and textually distinct from the
  shared-email block (FR-020), with write controls gated on membership-write authority.
- [X] T024 [US2] [P] Add styles for the account block to
  `src/app/(admin)/contacts/contacts.module.css`, distinguishable from `.sharedSection`.

**Checkpoint**: households are maintained where they are seen.

---

## Phase 5: User Story 3 — Segment the member mailing list (Priority: P3)

**Goal**: the member list is built from attachment, carries the payer's level, and keeps lapsed members so
the reminder can reach them.

**Independent test**: with accounts at differing levels and validity, **download** the member list; every
member appears with the account's level and their status, lapsed included.

### Tests (write first, must fail)

- [X] T025 [P] [US3] Write `tests/integration/exports.memberList.test.ts`: membership follows attachment
  and not `contacts.list_member` (FR-011), lapsed members are still listed (FR-012), the `membership_level`
  column carries the **payer's** level and is blank for a member who pays for nothing (FR-013),
  `do_not_contact` still suppresses (FR-014), the other columns are unchanged, and feature 067's
  shared-address dedupe still yields one row per resolved address. **Assert on the CSV the route returns,
  not only on `buildListRows`** — the column list lives in the route, so a service-only test would pass
  while the download silently lacked the new column.

### Implementation

- [X] T026 [US3] Rewrite the `member` list query in `src/server/domain/exports/exportService.ts` to join
  attachments and `membershipStatus.ts` instead of `contacts.list_member` / `contacts.membership_status`,
  adding the `membership_level` value while preserving the existing columns and the 067 resolver.
- [X] T027 [US3] Add `membership_level` to `COLUMNS.member` in `src/app/api/exports/[listId]/route.ts`.
  `rowsToCsv(columns, rows)` projects **only** the listed keys, so without this the value produced by T026
  never reaches the file (FR-013).

**Checkpoint**: the thank-you, reminder and we-miss-you sends are all derivable from one downloaded export.

---

## Phase 6: User Story 4 — Statuses stay true (Priority: P4)

**Goal**: status reflects today wherever it is read, and the rows that went stale at the 1 September
rollover are corrected once.

**Independent test**: with the stored column deliberately wrong, every surface — record, search, export —
still reports the status implied by the account's expiry.

### Tests (write first, must fail)

- [X] T028 [P] [US4] Write `tests/integration/membership.backfill.test.ts`: the one-off correction brings
  the stored cache into line with today, writes an audit row only for statuses that actually **changed**
  (FR-015a), and is safe to run twice.
- [X] T029 [P] [US4] Extend `tests/integration/membership.derivedStatus.test.ts` to cover every read
  surface with the stored column deliberately wrong: the contact record, **contact search**, and any count
  or roster reporting status must all agree with the derivation.

### Implementation

- [X] T030 [US4] Replace `refreshAllStatuses` in `src/server/domain/membership/membershipService.ts` with a
  backfill over the account model, recording only genuine changes, and retire `createMembership` in favour
  of `accountService`. Maintain `contacts.list_member` from **attachment** (FR-011) rather than from
  `isListMember(status)`, which encodes the old "has any history" rule.
- [X] T031 [US4] Re-point every remaining status reader at `membershipStatus.ts`: `SEARCH_COLS` /
  `searchContacts` in `src/server/domain/contacts/contactService.ts` (the contacts list and check-in search
  read the stored columns directly — re-pointing the page alone would leave them stale),
  `src/server/domain/dedup/suggestionService.ts`, `src/app/(admin)/contacts/page.tsx`,
  `src/app/(door)/checkin/page.tsx` and `src/app/(admin)/dedup/page.tsx`.
- [X] T032 [US4] Update `src/server/domain/paypal/captureService.ts` to record dues through
  `accountService`. Two call sites with different status: the **dormant** webhook enrolment (out of scope,
  must keep compiling and behaving), and `linkParkedNotification`, which is **reachable today** from
  `/payments` and must keep working. Replay protection remains `paypal_notifications.provider_event_id`.

**Checkpoint**: the stale-status bug class is gone from every surface, not just the record.

---

## Phase 7: Getting real data onto the model

**Purpose**: move the club's existing memberships, and re-point the import that created them. Separate
phase because it is the riskiest work and must run only once every read path is account-aware.

- [X] T033 Write `tests/integration/membership.migration.test.ts`: seed old-shape rows (multi-member payer
  groups, a contact-less payer, a contact with two rows), run the move, and assert every member is still
  covered at the same level to the same date (FR-016), a contact-less payer is matched by name **else** a
  contact is created and flagged `needs_review` (FR-021), no account is ownerless (SC-007), and running it
  twice is safe. This test **depends on `memberships`/`payers` still existing**, which is why the drop is
  deferred (see Deferred below) — it is a permanent regression guard, not scaffolding.
- [X] T034 Create `src/server/domain/membership/migrateToAccounts.ts` — group `memberships` by payer into
  one account each (level from the group, expiry from `MAX`), attach every distinct member contact plus the
  payer, resolving contact-less payers per FR-021. Report what it created and flagged.
- [X] T035 Run the move against the dev database and reconcile against the "before" numbers in
  [quickstart.md](./quickstart.md) — 154 rows → 115 accounts, 152 members covered, levels
  58/51/38/7 preserved.
- [X] T036 Update `tests/integration/contactLoad.membership.test.ts` to expect the **account model**: the
  CDR workbook load produces one account per payer group at the group's level and expiry, with every
  covered member attached, and those members are visible to the derivation and the member export. Today it
  asserts one `memberships` row per covered person.
- [X] T037 Re-point the contact load at the account model:
  `src/server/domain/contactLoad/buildMemberships.ts` (which already groups by payer with a shared expiry
  and level — that **is** the account shape, so the planning stage needs reshaping rather than rethinking)
  and the payer/membership insert block in `src/server/domain/contactLoad/execute.ts`, which currently
  writes `payers` and one `memberships` row per member. Left as-is, a re-run of the load would import
  members into tables nothing reads — silently invisible to the member list, status and every record,
  which is the exact failure this feature exists to remove.

**Checkpoint**: the real data lives on the new model, and the path that imports it does too. The old tables
remain, unread, as a safety net.

---

## Phase 8: Polish & Cross-Cutting

- [X] T038 Run the full gate suite: `pnpm vitest run`, `pnpm tsc --noEmit`, ESLint, and Prettier scoped to
  changed files. `tests/integration/gate.membership.test.ts` must pass — but **not** for the reason first
  predicted here. Its failure was a **time-dependent fixture**, not a stale cache: it hard-coded a
  2026-06-18 dance and expected `current`, and broke on 1 September when real time crossed the boundary and
  that coverage (expiring 2026-08-31) genuinely lapsed. Deriving status does not rescue an assertion about
  a past date; the fixture is dated relative to today instead.
- [X] T039 Walk the manual pass in [quickstart.md](./quickstart.md), including the mailing-list-manager
  check that the account block is visible but not editable (FR-017), and confirm the downloaded member CSV
  carries `membership_level`.
- [X] T040 Append an implementation-notes block to this file recording what shipped and the decisions taken
  during implementation, as in features 065–067.

---

## Deferred to a follow-up

**Dropping `memberships` and `payers`** (originally planned as migration 0044) is deliberately **not** in
this feature. `ensureSchema` applies every migration to the test database, so the moment the drop lands,
T033 — which seeds old-shape rows to prove no coverage was lost — can no longer run. Shipping the drop here
would end the feature by deleting the guard on its riskiest work.

The old tables cost nothing once unread: after Phase 7 no code writes or reads them, and they remain the
rollback position for the data move. Retiring them is a small, self-contained follow-up once the account
model has run in anger — at which point T033 can be retired with them, deliberately.

## Dependencies

```text
Phase 1 (T001–T003) → Phase 2 (T004–T007) → ┬─ US1 (T008–T015)  🎯 MVP
                                             ├─ US2 (T016–T024)
                                             ├─ US3 (T025–T027)
                                             └─ US4 (T028–T032)
                                                      ↓
                                    Phase 7 data + import (T033–T037)
                                                      ↓
                                    Phase 8 polish (T038–T040)
```

- **T007 blocks everything**: the derivation is joined by US2's projection, US3's export and US4's readers.
- **US1 → US2**: attaching needs an account to attach to.
- **US2 ⟂ US3 ⟂ US4** once US1 lands — different files, no shared edits.
- **T026 → T027**: the service produces the value; the route decides whether it reaches the file. Neither
  alone satisfies FR-013.
- **T034 → T037**: the contact load and the one-off move build the same shape, so the load should reuse
  whatever grouping the move settles on rather than growing a second implementation.
- **Phase 7 after US1–US4**: both the move and the import populate a model the read paths already
  understand, so a mistake shows up as a failing test rather than a broken screen.

## Parallel execution examples

- **Phase 1**: T003 is a different file from T001/T002 and can be written alongside them.
- **US1 tests**: T008, T009 and T010 are three separate files → fully parallel.
- **US2 tests**: T016, T017 and T018 are three separate files → fully parallel; T024 (CSS) is independent
  of the rest of the phase.
- **US4 tests**: T028 and T029 are separate files → parallel.
- **Phase 7**: T033 and T036 are separate test files → parallel, though their implementations (T034, T037)
  share the grouping logic and should land in that order.
- **Cross-story**: once US1 is green, three contributors could take US2 (record surface), US3 (export) and
  US4 (status readers) without touching each other's files.

## Implementation strategy

**MVP = Phases 1–2 + US1.** That alone lets the FS record the dues sitting on her desk, through the gate or
by post, at the right level and with the right expiry — the thing the club cannot do today. It is
shippable while the old model is still in place and still readable.

**Increment 2 = US2**, which turns an account into a household and puts its maintenance where Mel and the
FS already look.

**Increment 3 = US3 + US4**, the payoff and the correctness fix. They are independent of each other.

**Increment 4 = Phase 7**, the data move and the import path that feeds it.

Three notes on sequencing. The data work is **deliberately last among the functional work**: moving 154 rows
onto a model whose read paths are already tested is far safer than migrating first and discovering the model
was wrong. The legacy tables are **not** dropped in this feature (see Deferred). And several requirements
span a service and its caller — FR-013 needs both T026 and T027, FR-015 needs both the derivation and every
reader in T031, and the account model is not really adopted until the *import* writes it too (T037) — so
none of them is done when its service change is done.

---

## Implementation notes (2026-09-05)

All 40 tasks complete. Test-first throughout. Full suite **1167 passed / 0 failed** across 307 files;
`tsc`, ESLint, Prettier and markdownlint clean.

### What shipped

- **Migration 0043** (DDL only) — `membership_accounts` (payer contact, level, expiry, last payment;
  unique on payer, **no `ON DELETE`** so the database refuses an ownerless account) and
  `membership_members`, plus `gate_sales.membership_level`.
- **`membershipStatus.ts`** — the single derivation. **`accountService.ts`** — record dues, attach/detach,
  change level, capacity. **`migrateToAccounts.ts`** — the testable data move.
- Re-pointed: the gate dues line (with a level selector), the member export (service **and** route),
  contact search, the contact record, `captureService`, and the **contact load**.

### Decisions and corrections during implementation

1. **A prediction in T038 was wrong, and is corrected there.** `gate.membership.test.ts` was not failing
   because of the stale-status bug; it hard-coded a 2026-06-18 dance and expected `current`, and broke on
   1 September when real time crossed the boundary and that coverage (expiring 2026-08-31) genuinely
   lapsed. A **time-dependent fixture**, not a stale cache. Deriving status does not rescue an assertion
   about a past date; the fixture is now dated relative to today. It does pass, but not for the stated
   reason — and it was cited as evidence when this feature was scoped, which it never was.
2. **The FK backstop broke the super-user force delete.** `payer_contact_id` deliberately has no
   `ON DELETE`, so force-delete hit a raw constraint error (500). Added `deleteAccountOwnedBy` on that
   path — the same shape as 067's `clearReferencesToOwner`.
3. **The cache needed refreshing on write.** `recordDuesPayment`, `attachMember` and `detachMember` now
   call `recomputeContactStatus` for everyone the account covers; `getMembershipStatus` derives.
4. **A test was passing for the wrong reason.** The "lapsed member is still listed" export assertion
   matched `/lapsed/` against a row containing `lapsed@example.com` — it would have passed whatever the
   status column said. Renamed the fixture and asserted the status **column**. The same fixture also used
   "two months ago", which the 2-month early-renewal grace rolls forward to *next* year — so it was never
   lapsed at all.
5. **The `source_gate_sale_id` / `source_notification_id` idempotency indexes are gone**, as research R2
   planned. Verified again in practice: the door's real guard is the renewal no-op, and PayPal replay is
   guarded by `paypal_notifications.provider_event_id`, checked before anything is created.
6. **Six legacy test files were re-pointed, not deleted** — `gate.membership`, `exports.member`,
   `exports.throughYear`, `exports.sharedRecipients`, `membership.tx`, `membership.status`,
   `membership.create`, `membership.refresh`, `paypalCapture`, `contactLoad.membership`,
   `contacts.delete`, `contacts.archive`. Their behaviours were worth keeping; only the shape changed.

### The data move (T035)

Dev database, backed up to `~/zak1_dev_pre_068.sql` first. **154 rows → 114 accounts**, reconciled:

| Check | Result |
|---|---|
| Contacts who had a membership and are now uncovered | **0** (SC-004) |
| Contacts whose expiry changed | **0** |
| Ownerless accounts | **0** (SC-007) |
| Contacts created for contact-less payers, flagged `needs_review` | **17** (FR-021) |
| Members covered | 169 = 152 existing + 17 created owners |

**114, not the predicted 115**: one contact was the payer on two legacy payer rows, so both groups resolved
to the same owner and merged into one durable account — exactly what FR-004 requires. The level counts
shifted (family 51→26, supporter 38→24) because they were per-*member* rows and are now per-*account*;
57+26+24+7 = 114. None of the 17 contact-less payers matched an existing contact by name, so all 17 became
new flagged contacts.

### Left for later

- **Dropping `memberships` and `payers`** — deliberately deferred (research R9). They are now unread and
  unwritten, and remain the rollback position.
- **T039's manual browser pass** is auth-gated; the component and integration suites cover the same ground
  headlessly.
- **PayPal** remains out of scope until the app is deployed. Both call sites compile and behave; the
  parked-payment link on `/payments` is live and works.
