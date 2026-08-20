---

description: "Task list for Contact Load — replace contacts from iContact + membership import"
---

# Tasks: Contact Load — replace contacts from iContact + membership import

**Input**: Design documents from `specs/044-contact-load/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/contact-load-cli.md](contracts/contact-load-cli.md)

**Tests**: INCLUDED — the constitution's Test-First principle is NON-NEGOTIABLE. Every story writes its
tests first (they MUST fail before implementation). Integration tests run against real Postgres (no DB
mocking); unit tests cover pure parsers/mappers.

**Organization**: By user story, in priority order. P1 = US1 (roster/MVP), US2 (consent), US5 (safe
execution); P2 = US3 (memberships); P3 = US4 (performers).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1–US5 (story phases only)

## Path Conventions

Single project. Server code under `src/server/`; new domain module `src/server/domain/contactLoad/`;
CLI entry `src/server/db/contactLoad.ts`; tests under `tests/integration/` and `tests/unit/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Dependencies and module scaffolding.

- [x] T001 Add `csv-parse` to dependencies and a `"contacts:load": "tsx --env-file-if-exists=.env src/server/db/contactLoad.ts"` script in `package.json`; run `pnpm install`.
- [x] T002 [P] Create the `src/server/domain/contactLoad/` module directory with an `index.ts` barrel.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema change, shared types, pure parsers/mappers, and the CLI skeleton — required before any
story can run or be tested.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T003 Add migration `src/server/db/migrations/0033_membership_level.sql`: create `membership_level` enum (`individual`, `family`, `supporter`, `student`); add `memberships.level` (backfill existing rows to `individual`, then `SET NOT NULL`).
- [x] T004 [P] Add `membershipLevelEnum` + exported `MembershipLevel` type in `src/server/db/schema/enums.ts`, and the `level` column in `src/server/db/schema/memberships.ts`.
- [x] T005 [P] Define load-plan types (`IcontactRow`, `MemberRow`, `PayerRow`, `PlannedContact/Email/Membership`, `LoadPlan`, `LoadCounts`) in `src/server/domain/contactLoad/loadPlan.ts`.
- [x] T006 [P] Write **failing** unit tests for parsers + mappers in `tests/unit/contactLoad.parse.test.ts` (header validation; `setdate` vs `ic:last*` vs `Expires` date formats; comma-in-year; nameless→email-local-part + `needs_review`; combined "Hilary & Ed" single-contact + `needs_review`; consent flags `1` vs blank vs `-1`; JAB year→topic; universal `contact_tracing`).
- [x] T007 [P] Implement `src/server/domain/contactLoad/parseIcontact.ts` — `csv-parse` + zod → `IcontactRow[]` (locked header from research R2; date parsing per R10).
- [x] T008 [P] Implement `src/server/domain/contactLoad/parseMemberSheet.ts` — zod → `MemberRow[]` (name/pronouns/volunteer/payer key/email/phone; button name).
- [x] T009 [P] Implement `src/server/domain/contactLoad/parsePayerSheet.ts` — zod → `PayerRow[]` (group key, payer name, `Expires` `M/D/YY`, `Level` ∈ enum; unknown level fails validation).
- [x] T010 [P] Implement `src/server/domain/contactLoad/mapConsent.ts` — flags/JAB → `consent_topics[]`, always add `contact_tracing`, pass through provider dates (pure; covered by T006).
- [x] T011 Implement CLI skeleton `src/server/db/contactLoad.ts` — parse `--icontact/--members/--payers/--commit/--backup-dir`, `loadEnv`, dry-run default; dispatch to planner/executor stubs (safety behaviors added in US5).

**Checkpoint**: Schema migrated, files parse into validated typed rows, CLI runs (no-op).

---

## Phase 3: User Story 1 - Rebuild the roster, keep role-holders (Priority: P1) 🎯 MVP

**Goal**: Retain only role-grant holders; rebuild the roster as the iContact∪Member union (matched by
email, Member-wins for identity), dedup multi-email people by name key, set volunteer flag, flag
ambiguous rows.

**Independent Test**: With a seeded DB of role-holders + ordinary contacts, run the load and confirm
role-holders survive (grants intact), all other prior contacts are gone, and every person in the union
exists exactly once with correct name/pronouns/phone precedence.

### Tests (write first — MUST fail)

- [x] T012 [P] [US1] Integration test `tests/integration/contactLoad.roster.test.ts` — retention (role-holder + grants survive; non-role removed incl. cascaded staff identity/session per FR-018); RESTRICT handling (FR-021): a non-role contact that authored an `audit_events` row or is a surviving grant's `granted_by` is deleted with those refs **nulled** (no FK failure); a non-role contact that is a `merge_audit` party is **retained**; union membership (only-iContact, only-Member, both); Member-wins precedence; multi-email-same-person dedup by `dedup_normalized`; retained role-holder also in files updated in place (no duplicate); `needs_review` for nameless/combined rows; `is_volunteer` set from `Volunteer=Yes`.

### Implementation

- [x] T013 [US1] Implement `src/server/domain/contactLoad/buildRoster.ts` — union by email, collapse by `dedup_normalized`, Member-wins identity, `deriveContactNames`, `normalizePhone`, `buttonName`→`display_name_override` when differing, `needs_review` flags, `is_volunteer` from Member → `PlannedContact[]` (emails via `mapConsent`).
- [x] T014 [US1] Implement `src/server/domain/contactLoad/execute.ts` roster stage — compute retained set = `SELECT DISTINCT contact_id FROM role_grants` ∪ `merge_audit.canonical_id`/`merged_id` (FR-021); for deletion-target contacts, `UPDATE audit_events SET actor_contact_id = NULL` and `UPDATE role_grants SET granted_by = NULL` before deleting; delete non-retained `contacts`; upsert retained-in-file and insert new contacts + `contact_emails`, using `normalize` + Drizzle inside the caller's transaction.
- [x] T015 [US1] Wire `buildRoster` + roster execute into `contactLoad.ts`; populate `LoadCounts` (retained/removed/contactsCreated/emailsCreated/volunteersSet/needsReview).

**Checkpoint**: The roster rebuild works end-to-end (MVP). Consent/membership/performers still pending.

---

## Phase 4: User Story 2 - Import email consent permissions (Priority: P1)

**Goal**: Each loaded email carries the correct consent topics (list flags + `contact_tracing`) and
provider engagement dates.

**Independent Test**: Load iContact rows with varied flags; confirm each email's topics exactly match
the flagged lists + `contact_tracing`, with `-1`/blank treated identically and provider dates recorded.

> **Note**: Email rows are *created* in US1 (`buildRoster` calls `mapConsent`). US2 is a **verification**
> story — it owns consent correctness; its task adds code only if US1 left a consent gap.

### Tests (write first — MUST fail)

- [x] T016 [P] [US2] Integration test `tests/integration/contactLoad.consent.test.ts` — `contra=1` present, `english=blank`/`english=-1` absent, JAB year → `jane_austen_ball`, every email has `contact_tracing`, `provider_set_date/last_open/last_click` populated, multiple emails per contact each carry their own topics.

### Implementation

- [x] T017 [US2] Verify `buildRoster.ts`/`execute.ts` attach `mapConsent` output (topics + always `contact_tracing`), `status=active`, and provider dates to every email, including multi-email contacts; add the missing handling here only if T016 reveals a gap (no duplicate email-creation path).

**Checkpoint**: US1 + US2 — contacts and their mailing permissions are correct.

---

## Phase 5: User Story 5 - Safe, previewable, all-or-nothing execution (Priority: P1)

**Goal**: Dry-run default (no writes), `pg_dump` backup before a commit, single-transaction atomicity,
printed audit summary + `audit` row, documented exit codes.

**Independent Test**: Dry-run reports counts and writes nothing; a real run backs up first and is
all-or-nothing; a forced mid-run failure leaves the DB unchanged.

### Tests (write first — MUST fail)

- [x] T018 [P] [US5] Integration test `tests/integration/contactLoad.safety.test.ts` — dry-run mutates nothing; `--commit` wraps all stages in one transaction and a forced failure rolls back to the pre-run state; an `audit` row (action `contact_load`, counts payload) is written only on successful commit.
- [x] T019 [P] [US5] Unit test `tests/unit/contactLoad.summary.test.ts` — `LoadCounts` → audit-summary text (per contract), including membership-by-level and performer buckets.

### Implementation

- [x] T020 [US5] In `contactLoad.ts`: dry-run vs `--commit` branching; run all stages inside one `db.transaction(...)`; map failures to exit codes 1/2/3 (validation/backup/rollback).
- [x] T021 [US5] Implement `pg_dump` custom-format backup to `--backup-dir` (default `tmp/`) before opening the transaction on `--commit`; abort (exit 2) if it fails; check `pg_dump` on PATH.
- [x] T022 [US5] Write the `audit` row via `writeAudit` on successful commit and print the audit summary (`LoadCounts` + ambiguous/unmatched performer lists) in both modes.

**Checkpoint**: The destructive core is guarded — previewable, backed up, atomic, audited.

---

## Phase 6: User Story 3 - Import memberships with level (Priority: P2)

**Goal**: Payers + memberships (expiry + level) loaded; family payers cover their members; payer→paying
member link; membership status recomputed.

**Independent Test**: Load payers at each level with past/future expiries; confirm each linked member's
membership has the right payer/expiry/level and recomputed status.

### Tests (write first — MUST fail)

- [x] T023 [P] [US3] Integration test `tests/integration/contactLoad.membership.test.ts` — payer→membership per linked member; family payer shared expiry across members; `level` per the four enum values; Amount/Method ignored; payer→contact link = paying member (else null, FR-020); `membership_status` recomputed from expiry.

### Implementation

- [x] T024 [P] [US3] Implement `src/server/domain/contactLoad/buildMemberships.ts` — group members by payer key; resolve `payers.contact_id` = the member whose `dedup_normalized` matches the Payer sheet `Payer Name` (null on no/multiple match, FR-020); produce planned payers + memberships (expiry, level).
- [x] T025 [US3] Add the membership stage to `execute.ts` using `createPayer`/`createMembership` (membershipService) inside the transaction, then `refreshAllStatuses`; extend `LoadCounts` with membershipsCreated + per-level counts.

**Checkpoint**: US1–US3 + US5 — people, permissions, memberships, and safety all working.

---

## Phase 7: User Story 4 - Propose performer ↔ contact links (Priority: P3)

**Goal**: After the rebuild, auto-link only unambiguous exact matches; surface ambiguous/absent for human
resolution.

**Independent Test**: Performers matching zero/one/several loaded contacts — exact single → auto-linked;
zero/multiple → reported, not applied.

### Tests (write first — MUST fail)

- [x] T026 [P] [US4] Integration test `tests/integration/contactLoad.performers.test.ts` — exact single email/`dedup_normalized` match → `performers.contact_id` set; multiple matches → left null + listed ambiguous; no match → left null + listed unmatched.

### Implementation

- [x] T027 [P] [US4] Implement `src/server/domain/contactLoad/matchPerformers.ts` — for each `performers` row with null `contact_id`, match by exact email then exact `dedup_normalized`; bucket into auto/ambiguous/unmatched.
- [x] T028 [US4] Add the performer stage to `execute.ts` (apply auto-links in the transaction) and extend `LoadCounts` + the summary with the three buckets.

**Checkpoint**: All user stories independently functional.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [x] T029 [P] Add CSV header/sample fixtures under `tests/fixtures/contactLoad/` (iContact, member, payer) used by the integration tests.
- [x] T030 [P] Verify no HTTP route was added (FR-017) — the route-inventory test (`auth.routeInventory.test.ts`) must still pass unchanged.
- [x] T031 [P] Run the [quickstart.md](quickstart.md) preview→commit→spot-check flow against a seeded DB and confirm each SC-00x check.
- [x] T032 Final gate suite before commit: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`; confirm the plan.md Constitution Check still holds (solo-maintainer mode).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (P1)** → **Foundational (P2)** blocks everything.
- **US1 (Phase 3)** is the MVP and the base the others build on (roster + `execute.ts` + `LoadCounts`).
- **US2 (Phase 4)** refines email/consent produced during US1 — small delta on the same files.
- **US5 (Phase 5)** wraps the executor with safety; testable once US1 exists.
- **US3 (Phase 6)** and **US4 (Phase 7)** each add a stage to `execute.ts` and extend `LoadCounts`.
- **Polish (Phase 8)** last.

### Within Each User Story

Tests first (must fail) → build pure module → wire executor stage → extend counts/summary.

### Parallel Opportunities

- Setup: T002 ∥ T001.
- Foundational: T004, T005, T006 (tests), T007, T008, T009, T010 are all `[P]` (distinct files); T003 (migration) and T011 (CLI skeleton) are sequential anchors.
- Each story's test task `[P]` is authored before its implementation.
- US3's `buildMemberships.ts` (T024) and US4's `matchPerformers.ts` (T027) are independent pure modules and can be built in parallel once US1's `execute.ts` exists; their executor-wiring tasks (T025, T028) touch the same `execute.ts` and are therefore sequential.

---

## Parallel Example: Foundational parsers

```bash
# After T003 (migration) + T004 (schema), author tests then parsers in parallel:
Task: "T006 failing unit tests in tests/unit/contactLoad.parse.test.ts"
Task: "T007 parseIcontact.ts"
Task: "T008 parseMemberSheet.ts"
Task: "T009 parsePayerSheet.ts"
Task: "T010 mapConsent.ts"
```

---

## Implementation Strategy

### MVP First (US1)

1. Phase 1 Setup → Phase 2 Foundational → Phase 3 US1.
2. **STOP and VALIDATE**: roster rebuild + retention correct against real Postgres.

### Incremental Delivery

US1 → US2 → US5 → US3 → US4 → Polish. The feature lands as a **reviewed PR** from `contact_load`
(multi-contributor mode): the phases are an implementation/verification order, and the full gate suite
(T032) must be green before the PR is opened for review. Merge to `main` requires review — no self-merge.

---

## Notes

- `[P]` = different files, no incomplete dependency. `execute.ts` and `contactLoad.ts` are shared anchors
  across stories — tasks touching them are intentionally **not** `[P]`.
- Reuse, don't reinvent (constitution §II): `deriveContactNames`/`normalizeName`, `normalizePhone`,
  `createPayer`/`createMembership`/`refreshAllStatuses`, `writeAudit`, `loadEnv`, `db` client.
- Verify each test fails before implementing it.
- Real PII files stay in git-ignored `tmp/`; tests use fixtures under `tests/fixtures/contactLoad/`.
