# Tasks: Contact First/Last Name, Overridable Display Name, and Pronouns

**Feature**: `012-contact-name-fields` | **Plan**: [plan.md](plan.md) | **Spec**: [spec.md](spec.md)

**Stack**: TypeScript / Next.js (App Router) + PostgreSQL 16 (`pg_trgm`), Drizzle, Zod, pino, Vitest;
Node 24 + pnpm. Retrofits feature 001 (contacts model, dedup, search), 002 (check-in), 006 (export).
One migration `0017_contact_names.sql` (0016 is latest).

**Test-First is NON-NEGOTIABLE** (constitution Principle I): dedup/search are pg_trgm DB behavior,
integration-tested against real `zak1_test` (no mocking). The shared `makeContactWithEmail` factory is
made backward-compatible (a `displayName` option maps to `firstName`) so incidental contact-creating
tests keep passing without per-file edits; tests that POST a contact **body** are updated to `firstName`.

**Conventions**: `[P]` = parallelizable (different files, no incomplete deps). Story labels `[US1]`,
`[US2]`, `[US3]`. Paths repo-relative.

---

## Phase 1: Setup

_No setup tasks — retrofit of an existing project. Work begins at Foundational._

---

## Phase 2: Foundational (blocking prerequisites)

Structured columns + the derive helper + create/edit wiring are shared by all stories.

- [X] T001 Author migration `0017_contact_names.sql` in `src/server/db/migrations/` with a header
  comment: add `first_name text, last_name text, display_name_override text, pronouns text,
  dedup_normalized text` to `contacts`; backfill dev/seed rows `UPDATE contacts SET first_name =
  display_name, dedup_normalized = name_normalized WHERE first_name IS NULL` (preserves display/search/
  dedup byte-for-byte; prod loads fresh); `ALTER COLUMN first_name SET NOT NULL`, `ALTER COLUMN
  dedup_normalized SET NOT NULL`; `CREATE INDEX contacts_dedup_trgm ON contacts USING gin
  (dedup_normalized gin_trgm_ops)` (per [data-model.md](data-model.md))
- [X] T002 [P] Update `src/server/db/schema/contacts.ts` — add `firstName` (text, **notNull**),
  `lastName` (text, nullable), `displayNameOverride` (text, nullable), `pronouns` (text, nullable),
  `dedupNormalized` (text, **notNull**); keep `displayName`/`nameNormalized`
- [X] T003 [P] Add `deriveContactNames({ firstName, lastName?, displayNameOverride? })` to
  `src/server/domain/contacts/normalize.ts` → `{ displayName, nameNormalized, dedupNormalized }`:
  `displayName` = override (if non-blank) else `trim(first + " " + (last ?? ""))`; `nameNormalized` =
  `normalizeName(displayName)`; `dedupNormalized` = `normalizeName(trim(first + " " + (last ?? "")))`
- [X] T004 Update `src/server/domain/contacts/contactService.ts` — `createContact`/`patchContact` accept
  `firstName`/`lastName`/`displayNameOverride`/`pronouns` and set `displayName`/`nameNormalized`/
  `dedupNormalized`/`pronouns` via `deriveContactNames` (recompute on any name-field edit; do not disturb
  an override when editing first/last). `searchContacts` stays on `nameNormalized`. Depends on T002+T003.
- [X] T005 [P] Update `src/server/validation/contacts.ts` — `contactCreateSchema`: `firstName`
  required, `lastName`/`displayNameOverride`/`pronouns` optional (drop `displayName`);
  `contactPatchSchema`: those four all optional
- [X] T006 Door inline new-contact: `src/server/validation/attendance.ts` `newContact.displayName` →
  `firstName` (+ optional `lastName`); `src/server/domain/attendance/attendanceService.ts` new-contact
  insert uses `deriveContactNames`. Depends on T003.
- [X] T007 Apply migration `0017` to dev + test DBs; update the `makeContactWithEmail` factory in
  `tests/integration/helpers/factories.ts` to set `first_name`/`dedup_normalized` via `deriveContactNames`,
  keeping a **backward-compatible `displayName` option that maps to `firstName`** and adding
  `firstName`/`lastName` options. Depends on T001+T002+T003.

**Checkpoint**: structured columns exist; contacts create/edit and the door flow set derived names;
factory-based tests still pass (a `displayName` becomes `firstName`, so display/search/dedup are
unchanged for them).

---

## Phase 3: User Story 1 — Structured names, overridable display, pronouns, override-immune dedup (Priority: P1) 🎯 MVP

**Goal**: Capture required first + optional last name, an overridable display name, and pronouns; dedup
matches structured first+last (override-immune) while search still matches the shown name.

**Independent test**: Create contacts with first/last (and one blank last, one override, one with
pronouns); confirm display/override/pronouns behavior; confirm same-first+last contacts are flagged as
duplicates despite a different override; confirm search finds a contact by its override.

### Tests first (MUST fail before implementation)

- [X] T008 [P] [US1] Integration test — first "Robert"+last "Frost" → display "Robert Frost"; override
  "Bob Frost" changes only the display; editing last keeps the override; clearing returns to first+last;
  first "Jane"+no last → display "Jane" (no trailing space); pronouns recorded; **and the effective
  display name is what a contact read-back / the contacts directory returns** (readers see the
  materialized `display_name` — no-regression guard), in `tests/integration/contactNames.test.ts`
  (FR-001..FR-005, FR-010, SC-001, SC-004, SC-005)
- [X] T009 [P] [US1] Integration test — two contacts both first "Robert" last "Frost" (one with override
  "Bob Frost") surface as a merge suggestion; two first-only "Jane" contacts surface (dedup keys on
  first alone), in `tests/integration/dedup.structuredNames.test.ts` (FR-006, SC-006)
- [X] T010 [P] [US1] Integration test — searching "Bob" finds the contact whose override is "Bob Frost"
  (search stays on the effective display name), extend `tests/integration/contacts.search.test.ts`
  (FR-006, SC-006)

### Implementation

- [X] T011 [US1] Update `src/server/domain/dedup/suggestionService.ts` — pg_trgm `%` / `similarity()` on
  `dedup_normalized` instead of `name_normalized` (both the join predicate and the score/threshold)
- [X] T012 [US1] Update the contact-create **body** tests to `firstName`:
  `tests/integration/contacts.create.test.ts`, `tests/integration/contacts.consent.test.ts`, and any
  door/attendance test that posts `newContact.displayName` → `firstName`
- [X] T013 [US1] Contacts admin UI `src/app/(admin)/contacts/page.tsx` — create/edit form fields for
  first name, last name, display-name override, and pronouns; show pronouns; send `firstName`/`lastName`/
  `displayNameOverride`/`pronouns` in the create/patch body

**Checkpoint**: US1 independently testable — structured names with overridable display + pronouns; dedup
override-immune; search by display name.

---

## Phase 4: User Story 2 — Check-in roster sorts by last name (Priority: P2)

**Goal**: The door roster can be ordered by last name (then first); member buttons show the effective
display name.

**Independent test**: With several contacts, order the roster by last name and confirm alphabetical
ordering; confirm a member button shows the effective display name.

### Tests first

- [X] T014 [P] [US2] Integration test — the roster orders by `last_name, first_name` (Frost, Hopper,
  Lovelace); a member button label equals the effective display name (including an override), in
  `tests/integration/checkin.sort.test.ts` (FR-007, FR-008, SC-002)

### Implementation

- [X] T015 [US2] Add `ORDER BY last_name, first_name` to the check-in roster query in
  `src/server/domain/attendance/attendanceService.ts` and a sort control on
  `src/app/(admin)/checkin/page.tsx` (member-button label already uses `display_name`)

**Checkpoint**: US2 independently testable — roster sortable by last name.

---

## Phase 5: User Story 3 — Mailing-list export First/Last from structured fields (Priority: P2)

**Goal**: The export emits First Name / Last Name from the structured columns, not a split of the display
name.

**Independent test**: Export a list; confirm First/Last columns match the contact's stored first/last; a
no-last-name contact exports a blank Last Name.

### Tests first

- [X] T016 [P] [US3] Integration test — a contact with first "Ada" last "Lovelace" exports with distinct
  First/Last columns from the structured fields; a no-last-name contact exports a blank Last Name, extend
  `tests/integration/exports.topicLists.test.ts` (FR-009, SC-003)

### Implementation

- [X] T017 [US3] Update `src/server/domain/exports/exportService.ts` — select `contacts.first_name` /
  `contacts.last_name` in the list queries and emit them directly; delete `splitDisplayName`; remove the
  now-obsolete unit test `tests/unit/exports.nameSplit.test.ts`

**Checkpoint**: US3 independently testable — export First/Last from real columns.

---

## Phase 6: Polish & Cross-Cutting

- [X] T018 [P] Update `src/server/db/seed.ts` — give seeded contacts real `first_name`/`last_name`
  (via `deriveContactNames` or `createContact`), including one no-last-name contact, one with a
  display-name override, and one with pronouns, so dev data exercises the model
- [X] T019 [P] Verify all [quickstart.md](quickstart.md) scenarios, including the **manual migration
  preservation** check: existing dev rows keep byte-identical display/search/dedup after `0017`
- [X] T020 [P] Constitution compliance pass: strict types with no undocumented `any`/`as`, real-Postgres
  integration tests throughout, `no-console` lint clean on changed files; confirm the dev route index
  (`src/app/dev/routes/page.tsx`) needs no change (no routes added or removed — only request bodies)

---

## Dependencies & Execution Order

- **Foundational (T001–T007)** before all stories. Within it: T001 (migration) → T007 (apply + factory);
  T002 (schema) + T003 (helper) → T004 (service); T005 (validation) [P]; T006 (door) depends on T003.
- **US1 (P1)**: tests T008–T010 → impl T011 (dedup query), T012 (body-test updates), T013 (UI).
- **US2 (P2)**: test T014 → impl T015. Depends only on Foundational.
- **US3 (P2)**: test T016 → impl T017. Depends only on Foundational.
- **Polish (T018–T020)** after the stories it verifies.

## Parallel Opportunities

- Foundational: T002, T003, T005 are different files and parallelizable; T004/T006/T007 have the deps
  noted above.
- After Foundational, the three stories are independent: US1 (T008–T013), US2 (T014–T015), US3
  (T016–T017) touch mostly different files and can proceed in parallel.
- Polish T018/T019/T020 are independent.

## Implementation Strategy

1. **Foundational is the core** — the migration/backfill (T001/T007), the derive helper (T003), and the
   create/edit + door wiring (T004/T006). The backward-compatible factory (T007) keeps the existing suite
   green through the model change.
2. **MVP = Foundational + US1** — structured names, overridable display, pronouns, and the override-immune
   dedup / display-based search that make structured names worthwhile.
3. Add **US2** (roster sort) and **US3** (export First/Last), both independent.
4. Polish: seed real names, full quickstart incl. the manual migration-preservation check, constitution
   pass.

## Format validation

All tasks use `- [X] T### [P?] [US#?] description + file path`. Setup/Foundational/Polish carry no story
label; US phases carry `[US1]`/`[US2]`/`[US3]`. 20 tasks total.
