# Tasks: Retire Jane Austen Ball Mailing List; Free-Text Event-Group Category

**Feature**: `010-retire-jab-mailing-list` | **Plan**: [plan.md](plan.md) | **Spec**: [spec.md](spec.md)

**Stack**: TypeScript / Next.js (App Router) + PostgreSQL 16, Drizzle, Zod, pino, Vitest. Subtractive
retrofit of feature 006 (iContact export) and feature 002 (event groups). One migration
`0015_retire_jab_and_freetext_kind.sql` (0014 is latest). No new routes.

**Test-First is NON-NEGOTIABLE** (constitution Principle I): integration tests run against real
`zak1_test` (no mocking). Existing tests that assert seven lists / a fixed event-group kind are updated
to their new expectations *before* the code changes land, so the change is caught by the suite.

**Conventions**: `[P]` = parallelizable (different files, no incomplete deps). Story labels `[US1]`,
`[US2]`, `[US3]`. Paths repo-relative.

---

## Phase 1: Setup

*No setup tasks — this is a subtractive change to an existing project. Work begins at Foundational.*

---

## Phase 2: Foundational (blocking prerequisites)

The single migration is the shared foundation for US1 (mailing-list enum) and US2 (event-group kind);
both stories' integration tests need the migrated `zak1_test` schema, so it lands here rather than in a
story phase.

- [X] T001 Author migration `0015_retire_jab_and_freetext_kind.sql` in `src/server/db/migrations/`,
  with a header comment noting it performs two independent parts (A: mailing-list enum, B: event-group
  kind) (per [data-model.md](data-model.md) / [research.md](research.md)): **(A)** recreate
  the `mailing_list_id` enum without `janeaustenball` — `ALTER TYPE mailing_list_id RENAME TO
  mailing_list_id_old`; `CREATE TYPE mailing_list_id AS ENUM ('contra','english','openband',
  'specialevents','performer','member','contact_tracing')`; `ALTER TABLE mailing_list_exports ALTER
  COLUMN list_id TYPE mailing_list_id USING list_id::text::mailing_list_id` (the cast aborts if any row
  still holds `janeaustenball` — FR-003 guard); `DROP TYPE mailing_list_id_old`. **(B)** `ALTER TABLE
  event_groups ALTER COLUMN kind DROP NOT NULL`; `ALTER TABLE event_groups ALTER COLUMN kind TYPE text
  USING replace(kind::text, '_', ' ')`; `DROP TYPE event_group_kind`
- [X] T002 Apply migration `0015` to the dev DB and migrate the test DB (`zak1_test`); confirm `resetDb`
  in `tests/integration/helpers/db.ts` needs **no change** (it truncates `mailing_list_exports` /
  `event_groups`, whose table names are unchanged — only enum/column types change). Depends on T001.

**Checkpoint**: schema migrated; both stories can now be built and tested against real Postgres.

---

## Phase 3: User Story 1 — Retire the Jane Austen Ball mailing list (Priority: P1) 🎯 MVP

**Goal**: The Jane Austen Ball standing list is gone from every surface; exactly six standing lists
remain; the event-scoped contact-tracing export is unchanged (the intended JAB-augmentation path).

**Independent test**: `GET /api/exports` returns six standing lists, no `janeaustenball`, and items
carry no `note` field; the contact-tracing export on a JAB event still returns its consented attendees.

### Tests first (update existing to new expectations; MUST fail before implementation)

- [X] T003 [P] [US1] Update `tests/integration/exports.metadata.test.ts` — assert exactly six standing
  lists, `janeaustenball` absent from the listing, and listing items no longer include a `note` field
  (FR-001, FR-002, FR-004, SC-001)
- [X] T004 [P] [US1] Update `tests/integration/exports.topicLists.test.ts` — remove the `janeaustenball`
  topic-list case; keep the remaining topic lists (contra/english/openband/specialevents) green
  (FR-001, FR-003)
- [X] T005 [P] [US1] Confirm `tests/integration/exports.contactTracing.test.ts` and
  `tests/integration/exports.contactTracingZero.test.ts` remain green **unchanged** — the JAB-event
  augmentation path via contact tracing is unaffected (FR-005, SC-002); regression guard, no edit
  expected

### Implementation

- [X] T006 [US1] Remove `"janeaustenball"` from `mailingListIdEnum` in
  `src/server/db/schema/mailingListExports.ts`, from `listIdSchema` in
  `src/server/validation/exports.ts`, and its entry from `MAILING_LISTS` in
  `src/server/domain/exports/mailingLists.ts` (do together — `ListId` feeds `MailingListDef.id`, so the
  three stay type-consistent). Six standing lists remain.
- [X] T007 [US1] Delete `getMostRecentJabYear` from `src/server/domain/exports/exportService.ts`; in
  `src/app/api/exports/route.ts` drop its import and the `Promise.all` `jabYear` branch, and remove the
  `note` field from each listing item (research Decision 3). Depends on T006.
- [X] T008 [P] [US1] Update `src/app/(admin)/exports/page.tsx` to stop reading/rendering the `note`
  field (the JAB row already disappears via the shrunken `MAILING_LISTS`). Depends on T006.

**Checkpoint**: US1 independently testable — six lists, JAB gone everywhere, contact-tracing unchanged.

---

## Phase 4: User Story 2 — Free-text optional event-group category (Priority: P2)

**Goal**: An administrator can categorize an event group with any text (or none) instead of a fixed
dropdown; existing values are prettified free text.

**Independent test**: `POST /api/event-groups` with an arbitrary `kind` (e.g., "double dance") saves it;
`kind` omitted saves null; the events admin form shows a free-text input, not a dropdown.

### Tests first (MUST fail before implementation)

- [X] T009 [P] [US2] Update `tests/integration/event-groups.test.ts` — creating a group with an
  arbitrary `kind` string persists it verbatim; creating a group with `kind` omitted persists null; no
  fixed value set is enforced (FR-006, FR-007, SC-003, SC-006)

### Implementation

- [X] T010 [US2] Change `eventGroups.kind` from `eventGroupKindEnum("kind").notNull()` to
  `text("kind")` (nullable) in `src/server/db/schema/events.ts`; remove `eventGroupKindEnum` and the
  `EventGroupKind` type from `src/server/db/schema/enums.ts` (and the schema barrel `index.ts` if
  re-exported). Leave `emailConsentTopicEnum` (incl. `jane_austen_ball`) untouched.
- [X] T011 [US2] Change `eventGroupCreateSchema.kind` from `z.enum([...])` to
  `z.string().trim().min(1).optional()` in `src/server/validation/door.ts`; confirm `createEventGroup`
  in `src/server/domain/events/eventService.ts` passes the nullable `kind` through unchanged. Depends
  on T010.
- [X] T012 [US2] Replace the event-group kind `<select>` with a free-text optional `<input>` in
  `src/app/(admin)/events/page.tsx`; **label/placeholder it "Category (optional)" for the user** (the
  underlying field/state stays `kind` — see spec Assumptions and finding T1); change the `groupKind`
  state default from `"double_dance"` to `""` (empty → omitted). Depends on T010.

**Checkpoint**: US2 independently testable — category is optional free text; existing values prettified.

---

## Phase 5: User Story 3 — Preserve Jane Austen Ball opt-in consent (Priority: P3)

**Goal**: The `jane_austen_ball` email consent topic is unchanged — the one JAB-named concept kept.

**Independent test**: set and read the `jane_austen_ball` consent topic on a contact email after the
change; behavior is identical to before.

### Tests first (guardrail — proves non-regression)

- [X] T013 [P] [US3] Extend `tests/integration/contacts.consent.test.ts` — assert the `jane_austen_ball`
  consent topic is still settable and readable on a contact email after this feature, and remains a
  valid `email_consent_topic` value (FR-009, FR-010, SC-005)

**Checkpoint**: US3 independently testable — consent topic intact. No implementation tasks: nothing
about the consent model changes; this story is a non-regression guard that the removals did not touch it.

---

## Phase 6: Polish & Cross-Cutting

- [X] T014 [P] Update `src/server/db/seed.ts` — remove the "most recent JAB year" seed comment/intent;
  set the "Jane Austen Ball 2026" event group's `kind` to the free-text value "jane austen ball"; **keep**
  the JAB consent-topic seed contact; ensure the seed compiles against the nullable `text` kind and the
  six-value `mailing_list_id` enum
- [X] T015 [P] Verify all [quickstart.md](quickstart.md) scenarios end-to-end, including the manual
  migration-safety property: confirm no `mailing_list_exports` row holds `janeaustenball` (so the
  `USING` cast succeeds), run `0015`, then confirm the exports listing shows six lists and existing
  event-group categories are prettified
- [X] T016 [P] Constitution compliance pass: strict types with no dangling `EventGroupKind` /
  `janeaustenball` references, no undocumented `any`/`as`, real-Postgres integration tests throughout,
  `no-console` lint clean on changed files; confirm the dev route index
  (`src/app/dev/routes/page.tsx`) needs no update (no routes added or removed)

---

## Dependencies & Execution Order

- **Foundational (T001 → T002)** must complete before any story (both stories' tests need the migrated
  `zak1_test`).
- **US1 (P1)**: tests T003–T005 → impl T006 → T007 (route depends on the registry change) and T008
  (page depends on the registry change). T003/T004/T005 are parallel (different files).
- **US2 (P2)**: test T009 → impl T010 (schema) → T011 (validation) and T012 (UI), both depending on
  T010.
- **US3 (P3)**: T013 depends only on Foundational (the consent enum is untouched; the test simply
  proves it).
- **Polish (T014–T016)** after the stories it verifies.

## Parallel Opportunities

- After Foundational, the three stories are independent and their test tasks (T003–T005, T009, T013)
  can be written in parallel — they touch different files.
- Within US1, T003/T004/T005 run in parallel; in implementation, T008 can proceed in parallel with T007
  once T006 lands.
- US2 (T009–T012) and US3 (T013) can proceed entirely in parallel with US1.
- Polish tasks T014/T015/T016 are independent files/checks and can run in parallel.

## Implementation Strategy

1. **MVP = Foundational + US1** — the JAB mailing list is retired, six lists remain, and the
   contact-tracing augmentation path is proven intact. This is the core of P2-1.
2. Add **US2** — free-text optional event-group category (independent of US1).
3. Add **US3** — a small non-regression guard confirming the consent topic survived untouched.
4. Polish — seed cleanup, full quickstart verification (incl. the manual migration-safety check),
   constitution pass.

## Format validation

All tasks use `- [X] T### [P?] [US#?] description + file path`. Setup/Foundational/Polish carry no story
label; US phases carry `[US1]`/`[US2]`/`[US3]`. 16 tasks total.
