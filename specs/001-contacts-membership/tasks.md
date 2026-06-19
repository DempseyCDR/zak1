# Tasks: Contacts & Membership

**Feature**: `001-contacts-membership` | **Plan**: [plan.md](plan.md) | **Spec**: [spec.md](spec.md)

**Stack**: TypeScript / Next.js (App Router) + PostgreSQL 16 (`pg_trgm`), Drizzle, Zod, pino, Vitest.
Single-tenant.

**Test-First is NON-NEGOTIABLE** (constitution Principle I): for every story, the test tasks are
written first and MUST fail before the implementation tasks that satisfy them. Integration tests run
against a real PostgreSQL instance — no DB mocking (constitution + plan).

**Conventions**: `[P]` = parallelizable (different files, no incomplete deps). Story labels: `[US1]`,
`[US2]`, `[US3]`. Paths are repo-relative.

---

## Phase 1: Setup

- [X] T001 Initialize Next.js (App Router, React 19) + TypeScript project at repo root with `src/` layout per [plan.md](plan.md)
- [X] T002 Configure strict TypeScript in `tsconfig.json` (`strict: true`, `noUncheckedIndexedAccess: true`) per constitution Principle III
- [X] T003 [P] Add ESLint (typescript-eslint) + Prettier configs and `pnpm lint` / `pnpm format` scripts
- [X] T004 [P] Add Vitest config in `vitest.config.ts` with separate `test:unit` and `test:integration` scripts
- [X] T005 [P] Add Drizzle ORM + drizzle-kit config in `drizzle.config.ts` pointing at `src/server/db/schema`
- [X] T006 [P] Add `docker-compose.yml` (or Testcontainers helper) for disposable PostgreSQL 16 used by integration tests
- [X] T007 [P] Create env loader with Zod validation (`DATABASE_URL`, `LOG_LEVEL`) in `src/server/validation/env.ts`

---

## Phase 2: Foundational (blocking prerequisites)

- [X] T008 Create initial migration enabling `pgcrypto`, `pg_trgm`, and `citext` extensions in `src/server/db/migrations/`
- [X] T009 Define shared enums (`email_purpose`, `email_status`, `membership_status`, `volunteer_role`, `email_consent_topic`) in `src/server/db/schema/enums.ts`
- [X] T010 [P] Implement pino structured logger in `src/server/lib/logger.ts` (JSON in production; no `console.log`) per Principle IV
- [X] T011 [P] Implement append-only audit writer in `src/server/lib/audit.ts` (used by merges + status changes)
- [X] T012 Define `club_settings` schema (single row, `long_lapse_cycles` default 3, `cycle_definition`) in `src/server/db/schema/clubSettings.ts` and seed the single row
- [X] T013 [P] Implement request/response structured-logging wrapper for API route handlers in `src/server/lib/withLogging.ts`
- [X] T014 [P] Establish shared API error shape + helper (`{ error: { code, message } }`) in `src/server/lib/apiError.ts`
- [X] T015 [P] Create DB test harness (migrate + truncate-between-tests) for integration suites in `tests/integration/helpers/db.ts`

**Checkpoint**: project builds, lints, connects to Postgres, logger + audit + settings available.

---

## Phase 3: User Story 1 — Maintain the contact directory (Priority: P1)

**Goal**: Admin can create/edit/retrieve contacts with multiple multi-purpose emails; email uniqueness
enforced; fuzzy name search returns ranked results within 300 ms.

**Independent test**: Create a contact + email, add a second multi-purpose email, attempt a duplicate
email (rejected), and search by partial name returning ranked matches. (Maps to spec US1.)

### Tests first (MUST fail before implementation)

- [X] T016 [P] [US1] Integration test: `POST /api/contacts` creates contact (status `never`); duplicate active/transition email → 409 `EMAIL_DUPLICATE`, in `tests/integration/contacts.create.test.ts` (FR-001/003)
- [X] T017 [P] [US1] Integration test: add second email via `POST /api/contacts/:id/emails`, multi-purpose set persists, empty `purposes` → 422 `PURPOSES_REQUIRED`, default `["personal"]` when omitted, in `tests/integration/contacts.emails.test.ts` (FR-002/002a)
- [X] T018 [P] [US1] Integration test: `provider_*` fields rejected/immutable (422 `READ_ONLY_FIELD`) in `tests/integration/contacts.providerFields.test.ts` (FR-006)
- [X] T019 [P] [US1] Integration test: `is_login=true` on non-volunteer contact → 422 `LOGIN_NOT_PERMITTED`; allowed when contact is volunteer, in `tests/integration/contacts.login.test.ts` (FR-005)
- [X] T019a [P] [US1] Integration test: mark contact volunteer + assign roles via `PATCH /api/contacts/:id`; roles without `isVolunteer` → 422 `ROLES_REQUIRE_VOLUNTEER`, in `tests/integration/contacts.volunteer.test.ts` (FR-005a)
- [X] T019b [P] [US1] Integration test: per-email `consentTopics` persist independently, default `["contact_tracing"]` when omitted, empty → 422 `CONSENT_TOPICS_REQUIRED`, and `do_not_contact` is treated as exclusive/overriding, in `tests/integration/contacts.consent.test.ts` (FR-004/004a)
- [X] T020 [P] [US1] Integration test: `GET /api/contacts?q=` returns ranked fuzzy matches; assert p95 ≤ 300 ms over ~1,300 seeded rows, in `tests/integration/contacts.search.test.ts` (SC-005, perf)
- [X] T021 [P] [US1] Unit test: email normalization (lower/trim) + purpose-set de-duplication in `tests/unit/email.normalize.test.ts`

### Implementation

- [X] T022 [US1] Define `contacts` table schema (id, display_name, name_normalized, membership_status, list_member, status_recomputed_at, is_volunteer, volunteer_roles enum[] with roles-only-if-volunteer CHECK, merged_into_id, timestamps) + GIN trigram index in `src/server/db/schema/contacts.ts`
- [X] T023 [US1] Define `contact_emails` table schema (citext email, `purposes` enum[] non-empty CHECK, `consent_topics` enum[] non-empty CHECK default `{contact_tracing}`, status, is_login, provider_* read-only, partial unique index on active/transition) + GIN on purposes and consent_topics in `src/server/db/schema/contactEmails.ts`
- [X] T024 [US1] Generate + apply migration for contacts and contact_emails in `src/server/db/migrations/`
- [X] T025 [P] [US1] Zod boundary schemas for contact + email create/patch (purpose set non-empty/default personal, consent topics non-empty/default contact_tracing with do_not_contact override, volunteer-role-requires-volunteer rule, reject provider_*) in `src/server/validation/contacts.ts`
- [X] T026 [US1] Contact domain service (create, get-with-emails, patch incl. volunteer flag + roles, fuzzy search via `similarity()`) in `src/server/domain/contacts/contactService.ts`
- [X] T027 [US1] Email domain service (add/patch email, uniqueness check, login-requires-volunteer rule, purpose-set + consent-topic handling incl. do_not_contact exclusivity) in `src/server/domain/contacts/emailService.ts`
- [X] T028 [P] [US1] Route handlers `GET/POST /api/contacts` and `GET/PATCH /api/contacts/:id` in `src/app/api/contacts/`
- [X] T029 [P] [US1] Route handlers `POST /api/contacts/:id/emails` and `PATCH .../emails/:emailId` in `src/app/api/contacts/[id]/emails/`
- [X] T030 [US1] Admin UI: contact list + search and contact detail with email management (purpose multi-select default "personal", consent-topic multi-select default "contact tracing" with do_not_contact handling, volunteer flag + role multi-select) in `src/app/(admin)/contacts/`

**Checkpoint**: US1 independently testable and demoable — directory CRUD + multi-purpose emails + fuzzy search.

---

## Phase 4: User Story 2 — Track membership status automatically (Priority: P1)

**Goal**: Recording a membership sets status `current`; time-based transitions to `lapsed`/`long_lapsed`
happen via service recompute + idempotent daily job; `never` when no membership. Every change audited.

**Independent test**: Record a membership → `current`; advance clock + run job → `lapsed` then
`long_lapsed`; no-membership contact → `never`/`listMember=false`. (Maps to spec US2.)

### Tests first (MUST fail before implementation)

- [ ] T031 [P] [US2] Unit test: status classification pure function across boundaries (current/lapsed/long_lapsed/never, respecting `long_lapse_cycles`) in `tests/unit/membership.classify.test.ts` (FR-007/008)
- [ ] T032 [P] [US2] Integration test: `POST /api/memberships` sets `current` synchronously + writes `StatusChangeAudit` in `tests/integration/membership.create.test.ts` (FR-009/013)
- [ ] T033 [P] [US2] Integration test: daily refresh job transitions expired memberships and is idempotent (second run = no new audit rows) in `tests/integration/membership.refresh.test.ts` (FR-009, SC-002)
- [ ] T034 [P] [US2] Integration test: `GET /api/contacts/:id/membership-status` returns status/listMember/recomputedAt in `tests/integration/membership.status.test.ts`

### Implementation

- [ ] T035 [US2] Define `payers` and `memberships` table schemas in `src/server/db/schema/memberships.ts` and migrate
- [ ] T036 [US2] Define `status_change_audit` table schema in `src/server/db/schema/audit.ts` and migrate
- [ ] T037 [P] [US2] Pure status classification function (most-recent expiry vs. today + cycles) in `src/server/domain/membership/classify.ts`
- [ ] T038 [US2] Membership service: create membership, synchronous status recompute, audit on change in `src/server/domain/membership/membershipService.ts`
- [ ] T039 [US2] Zod schema for membership create in `src/server/validation/memberships.ts`
- [ ] T040 [P] [US2] Route handlers `POST /api/memberships` and `GET /api/contacts/:id/membership-status` in `src/app/api/memberships/` and contact route
- [ ] T041 [US2] Daily refresh job (idempotent, recompute time-based transitions, system-actor audit) in `src/jobs/membership-refresh.ts` + `node-cron` registration + `pnpm job:membership-refresh` entrypoint

**Checkpoint**: US2 independently testable — status accurate on write and over time, fully audited.

---

## Phase 5: User Story 3 — Review and merge duplicate contacts (Priority: P2)

**Goal**: Fuzzy suggestion queue surfaces likely duplicates; admin-confirmed transactional merge
re-links all related records, soft-retires the non-canonical contact, and writes a merge audit. No
automatic merges.

**Independent test**: Seed two similar contacts → appear as a suggested pair → confirm merge →
related records re-linked, merged contact retired, audit written; re-merge → 409. (Maps to spec US3.)

### Tests first (MUST fail before implementation)

- [ ] T042 [P] [US3] Integration test: `GET /api/dedup/suggestions` returns similar-name pairs with similarity score in `tests/integration/dedup.suggestions.test.ts` (FR-010)
- [ ] T043 [P] [US3] Integration test: `POST /api/dedup/merge` re-links emails + memberships, soft-retires merged, writes `MergeAudit`; second merge → 409 `ALREADY_MERGED` in `tests/integration/dedup.merge.test.ts` (FR-011/012/013)
- [ ] T044 [P] [US3] Integration test: no automatic merge occurs from generating suggestions in `tests/integration/dedup.noAutoMerge.test.ts` (FR-011)

### Implementation

- [ ] T045 [US3] Define `merge_audit` table schema in `src/server/db/schema/audit.ts` and migrate
- [ ] T046 [US3] Dedup suggestion service (trigram-based candidate pairs above threshold) in `src/server/domain/dedup/suggestionService.ts`
- [ ] T047 [US3] Transactional merge service (choose canonical, re-link FKs, soft-retire via `merged_into_id`, write audit with relinked counts) in `src/server/domain/dedup/mergeService.ts`
- [ ] T048 [P] [US3] Zod schema for merge request in `src/server/validation/dedup.ts`
- [ ] T049 [P] [US3] Route handlers `GET /api/dedup/suggestions` and `POST /api/dedup/merge` in `src/app/api/dedup/`
- [ ] T050 [US3] Admin UI: merge review queue (pair display, confirm merge) in `src/app/(admin)/dedup/`

**Checkpoint**: US3 independently testable — admin-confirmed, audited merges.

---

## Phase 6: Polish & Cross-Cutting

- [ ] T051 [P] Seed script scaling to ~1,300 contacts / ~152 members for perf + manual validation in `src/server/db/seed.ts`
- [ ] T052 [P] Verify all [quickstart.md](quickstart.md) validation scenarios pass end-to-end
- [ ] T053 [P] Confirm structured logging on all route handlers and zero `console.log` in production paths (lint rule) per Principle IV
- [ ] T054 [P] Constitution compliance pass: strict-type check clean, no undocumented `any`/`as`, integration tests run against real Postgres
- [ ] T055 [P] README/run docs for local dev, migrations, and the refresh job

---

## Dependencies & Execution Order

- **Setup (T001–T007)** → **Foundational (T008–T015)** → user stories.
- **US1 (P1)** depends only on Foundational → this is the **MVP**.
- **US2 (P1)** depends on Foundational + the `contacts` table from US1 (T022); status field lives on Contact.
- **US3 (P2)** depends on US1 (contacts/emails to merge) and benefits from US2 entities (memberships re-link); start after US1, ideally after US2.
- Within a story: tests (write first, must fail) → schema/migration → services → routes → UI.

## Parallel Opportunities

- Setup: T003–T007 in parallel after T001–T002.
- Foundational: T010, T011, T013, T014, T015 in parallel after T008–T009.
- Each story's `[P]` test tasks can be authored together before implementation begins.
- Route-handler tasks marked `[P]` touch separate files from their services and can proceed once services exist.

## Implementation Strategy

1. **MVP = US1** (contact directory + multi-purpose emails + fuzzy search). Independently shippable.
2. Add **US2** (membership status) — completes the "P1" foundation other features (006 export) depend on.
3. Add **US3** (dedup) once there is data worth de-duplicating.
4. Polish + constitution compliance pass.

## Format validation

All tasks use `- [ ] [TaskID] [P?] [Story?] description + file path`. Setup/Foundational/Polish carry no
story label; US phases carry `[US1]/[US2]/[US3]`. 58 tasks total.
