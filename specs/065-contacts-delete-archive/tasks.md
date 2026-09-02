# Tasks: Contact Archive & Delete

**Feature**: 065-contacts-delete-archive | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

**Scope**: a reversible **soft archive** (`archived_at`) that hides a contact from every active read
(search, counts, dedup candidates, exports) with a **"+ archived"** search toggle to surface/restore;
and a **hard delete** in two forms — a **safe** delete (`contact.delete`) that only removes a **bare**
contact and refuses otherwise, and an **unrestricted** delete (`contact.delete.unrestricted`, super-user)
that bypasses the guard. Every delete is audited. **Schema change + migration (0041), two new
capabilities.** Reuse the 063 editor/modal + 064 launcher/search. **Test-First** (constitution I).

Contract checks C1–C14 live in [contracts/archive-delete.md](./contracts/archive-delete.md).

Note: the migration runner applies `*.sql` lexically and the test harness (`ensureSchema`) runs it, so
`0041` is picked up automatically — no journal step. `page.tsx` and `contacts.page.test.tsx` are single
shared files (sequential); the two integration test files are independent and `[P]`.

---

## Phase 1: Setup

- [X] T001 Establish a green baseline: `pnpm vitest run tests/integration/contacts.search.test.ts tests/integration/dedup.suggestions.test.ts tests/integration/contacts.launcherCounts.test.ts tests/component/contacts.page.test.tsx && pnpm tsc --noEmit` — all pass before any change.

## Phase 2: Foundational (blocking prerequisites)

- [X] T002 Add the archived marker: migration `src/server/db/migrations/0041_contacts_archived_at.sql` (`ALTER TABLE contacts ADD COLUMN archived_at timestamptz;`) and the column `archivedAt` on `src/server/db/schema/contacts.ts` (mirror `bands.archivedAt`). Blocks all stories.
- [X] T003 Add capabilities: extend the `Capability` union and catalog in `src/server/auth/capabilities.ts` with **`contact.delete`** (grant to `mailing_list_manager` global + `super_user`) and **`contact.delete.unrestricted`** (`super_user` only); extend `src/app/api/me/capabilities/route.ts` to return `contactWrite`, `contactDelete`, `contactDeleteUnrestricted`. Blocks US3/US4 + UI gating.

**Checkpoint**: the column exists and the capabilities are in the catalog — stories can proceed.

## Phase 3: User Story 1 — Archive hides a contact (Priority: P1) 🎯 MVP

**Goal**: archiving a contact removes it from every active read; its data stays intact; the search can
opt to include archived rows.

**Independent test**: archive a contact → it disappears from search, needs-review, dedup candidates,
counts, and exports; `?archived=1` shows it (marked); its data is intact.

- [X] T004 [P] [US1] In `tests/integration/contacts.archive.test.ts` (new; file-level DB hooks), add failing cases: after archiving, the contact is absent from `searchContacts`, `listNeedsReview`/`countNeedsReview`, `getMergeSuggestions`/`countMergeSuggestions`, and the export reads (C1); `searchContacts(includeArchived)` / `?archived=1` returns it carrying `archivedAt` while the default excludes it (C3). Run; watch fail.
- [X] T005 [US1] In `src/server/domain/contacts/contactService.ts`, add `archived_at IS NULL` to every active-read filter (`searchContacts` all three branches, `countNeedsReview`, `listNeedsReview`); add an `includeArchived` option to `searchContacts` that drops only the archived predicate; add `archivedAt` to `SEARCH_COLS`/`ContactSummary`; add `archiveContact(db, id)` (set `archived_at = now()`). (depends: T002, T004)
- [X] T006 [P] [US1] In `src/server/domain/dedup/suggestionService.ts`, add `AND a.archived_at IS NULL AND b.archived_at IS NULL` to `getMergeSuggestions` and `countMergeSuggestions`. (depends: T004)
- [X] T007 [P] [US1] In `src/server/domain/exports/{exportService,mailingLists,contactTracingService}.ts`, exclude archived contacts (`archived_at IS NULL`) from the mailing-list / contact-tracing reads. (depends: T004)
- [X] T008 [US1] In `src/app/api/contacts/route.ts` honor `?archived=1` (pass `includeArchived` to `searchContacts`); add `POST /api/contacts/[id]/archive` in `src/app/api/contacts/[id]/archive/route.ts` (`requires: contact.write`) → `archiveContact`. Make T004 pass. (depends: T005)

**Checkpoint**: US1 MVP — archiving takes a contact out of active use everywhere.

## Phase 4: User Story 2 — Restore an archived contact (Priority: P1)

**Goal**: find an archived contact via the **"+ archived"** toggle and restore it to active use.

**Independent test**: archive → find via `+ archived` → restore → it returns to active search.

- [X] T009 [US2] In `tests/integration/contacts.archive.test.ts`, add a failing case: `restoreContact` (and `POST …/restore`) clears `archived_at`, returning the contact to active reads with its data/standing unchanged (C2). Run; watch fail. (same file — sequential)
- [X] T010 [US2] In `src/server/domain/contacts/contactService.ts` add `restoreContact(db, id)` (clear `archived_at`); add `POST /api/contacts/[id]/restore` in `src/app/api/contacts/[id]/restore/route.ts` (`requires: contact.write`) → `restoreContact`. Make T009 pass. (depends: T008)
- [X] T011 [US2] In `tests/component/contacts.page.test.tsx`, add failing cases: the search shows a **"+ archived"** toggle; on → archived rows appear marked (C10); the editor shows **Archive** for an active contact and **Restore** for an archived one when `contactWrite` (C11); the view/counts refresh after archive or restore (C14). Run; watch fail.
- [X] T012 [US2] In `src/app/(admin)/contacts/page.tsx`, add the **"+ archived"** search toggle (pass `?archived=1`, mark archived rows), fetch `/api/me/capabilities` for `contactWrite`, and add editor **Archive**/**Restore** buttons (per archived state, gated by `contactWrite`) that call the archive/restore endpoints and then run the shared `refreshView`/`refreshCounts` (064). Add toggle styles to `contacts.module.css`. Make T011 pass. (depends: T006, T007, T010, T011)

**Checkpoint**: US2 — archive is reversible end-to-end through the UI.

## Phase 5: User Story 3 — Safe hard delete with the bare-record guard (Priority: P2)

**Goal**: permanently delete a bare contact; refuse (with the reason) when it is referenced by any
substantive table.

**Independent test**: delete a bare contact → gone; delete a referenced contact → refused per category,
nothing changed; no capability → refused; a delete is audited.

- [X] T013 [P] [US3] In `tests/integration/contacts.delete.test.ts` (new; file-level DB hooks), add failing cases using `makeActor`: a `contact.delete` holder deletes a **bare** contact (only its emails) → removed (C4); an actor lacking `contact.delete` is refused (C7); a successful delete writes a `contact.delete` audit event (C8); `/api/me/capabilities` reports the flags per grants (C9). **Security-critical guard coverage (F1)**: the safe delete is refused with the reason for a contact referenced by **each** enumerated category — seed one blocker at a time and assert refusal + no change for **membership, membership_capture, attendance, door_record, performer, officer, role_grant, staff_identity, and venue-landlord** (C5); plus a **list-parity** assertion that `contactDeleteBlockers` checks exactly the enumerated set (so a newly-added contact FK cannot silently escape the guard) (C15). Run; watch fail.
- [X] T014 [US3] In `src/server/domain/contacts/contactService.ts`, add `contactDeleteBlockers(db, id)` driven by a **single exported list constant** naming the substantive referencing categories (memberships, membership_captures, attendance, door_records, performers, officers, role_grants, staff_identities, venue-landlord) — so the guard and the T013 list-parity test (C15) share one source of truth; emails and audit are excluded. Add `deleteContact(db, id, { unrestricted })` (safe path throws a typed "has references" error carrying the present categories when blockers exist; then `DELETE` the contact and write a `contact.delete` audit). Make the service parts of T013 pass. (depends: T002, T013)
- [X] T015 [US3] In `src/app/api/contacts/[id]/route.ts` add `DELETE` (`requires: contact.delete`) → `deleteContact(db, id, { unrestricted: false })`; a refusal returns a 4xx carrying the referencing categories. Make T013 pass. (depends: T014)
- [X] T016 [US3] In `tests/component/contacts.page.test.tsx`, add failing cases: the editor shows a **Delete** control only when `contactDelete` (C12); using it requires an explicit confirm distinct from Save; a refused delete surfaces the reason (C13); the view/counts refresh after a delete (C14). Run; watch fail. (same file — sequential)
- [X] T017 [US3] In `src/app/(admin)/contacts/page.tsx`, add a **Delete** button to the editor (shown when `contactDelete`) with an explicit confirmation step; on confirm call `DELETE /api/contacts/:id`; on refusal show the returned reason; on success close + `refreshView`/`refreshCounts`. Add destructive-action styles. Make T016 pass. (depends: T012, T015, T016 — same file)

**Checkpoint**: US3 — a bare contact can be deleted; anything with history is protected.

## Phase 6: User Story 4 — Unrestricted delete (super-user) (Priority: P3)

**Goal**: the super-user can delete a referenced contact, bypassing the guard.

**Independent test**: as super-user, `?force=1` deletes a contact the safe delete refused; a non-super-user
`?force=1` is refused.

- [X] T018 [US4] In `tests/integration/contacts.delete.test.ts`, add failing cases: a `contact.delete.unrestricted` holder with `?force=1` deletes a **referenced** contact (C6); an actor without that capability using `?force=1` is refused (C7). Run; watch fail. (same file — sequential)
- [X] T019 [US4] In `src/app/api/contacts/[id]/route.ts`, when `DELETE` has `?force=1`, additionally require `contact.delete.unrestricted` (`actorCan`, else 403) and call `deleteContact(db, id, { unrestricted: true })` (skips the guard; still audits, detail = unrestricted). Make T018 pass. (depends: T014, T015, T018)
- [X] T020 [US4] In `src/app/(admin)/contacts/page.tsx`, when a safe delete is refused and the viewer holds `contactDeleteUnrestricted`, offer an unrestricted (force) delete with its own confirmation. (depends: T017, T019 — same file)

**Checkpoint**: US4 — the super-user override is available for the rare purge.

## Phase 7: Polish & Cross-Cutting

- [X] T021 Regression + typecheck: `pnpm vitest run tests/component tests/integration/contacts.archive.test.ts tests/integration/contacts.delete.test.ts tests/integration/contacts.search.test.ts tests/integration/contacts.needsReview.test.ts tests/integration/contacts.launcherCounts.test.ts tests/integration/dedup.suggestions.test.ts tests/integration/exports.contactTracing.test.ts tests/integration/authz.pii.test.ts && pnpm tsc --noEmit` — all green (search, dedup, exports, counts, 063/064 unchanged). (depends: T017, T020)
- [X] T022 [P] Prettier/ESLint on changed files only (`contacts.ts` schema, `contactService.ts`, `suggestionService.ts`, `exports/*`, `capabilities.ts`, `me/capabilities/route.ts`, `contacts/route.ts`, `contacts/[id]/route.ts`, `contacts/[id]/archive/route.ts`, `contacts/[id]/restore/route.ts`, `page.tsx`, `contacts.module.css`, both new integration tests, `contacts.page.test.tsx`).
- [~] T023 Browser (auth-gated, manual) — signed in at `/contacts`: archive a contact (it leaves search/counts), find it via **+ archived**, restore it; delete a bare test contact; confirm a referenced contact refuses with a reason; as super-user, force-delete it. `/contacts` is `requireStaff`-gated (no dev bypass); behavior is covered by the integration + component tests, so only the live visual confirmation remains.

---

## Dependencies

- **Setup (T001)** → **Foundational (T002, T003)** → stories.
- **US1**: T004 (test) → T005 (service) ∥ T006 (dedup) ∥ T007 (exports) → T008 (routes).
- **US2**: T009 → T010 (restore); T011 → T012 (UI; needs T010 + the filters T006/T007).
- **US3**: T013 → T014 (service) → T015 (route); T016 → T017 (UI; needs T012 + T015).
- **US4**: T018 → T019 (route); T020 (UI; needs T017 + T019).
- **Same-file sequential**: `contactService.ts` (T005 → T010 → T014); `page.tsx` (T012 → T017 → T020);
  `contacts.page.test.tsx` (T011 → T016); `contacts.archive.test.ts` (T004 → T009);
  `contacts.delete.test.ts` (T013 → T018); `contacts/[id]/route.ts` (T015 → T019).
- **Story independence**: US1 is a viable MVP (archive hides). US2/US3/US4 each layer on.

## Parallel execution examples

- **T006** (dedup filter) ∥ **T007** (exports filter) — different files, once T004 exists.
- **T004** (archive integration test) ∥ **T013** (delete integration test) — different files.
- **T022** (lint) is `[P]`.
- Sequential (same file): the `contactService.ts`, `page.tsx`, and component-test chains above.

## Implementation strategy

MVP = **US1** (archive hides a contact everywhere) on the **Foundational** column + capabilities. **US2**
adds restore + the `+ archived` toggle and editor buttons. **US3** adds the safe delete with the
bare-record guard (the security-critical piece). **US4** adds the super-user override. Everything reuses
the 063 editor/modal, the 064 launcher/search + shared refresh, and the existing audit — one column, one
migration, two capabilities.

_Impl notes: (1) the contact FK in the door domain is on `gate_sales` (door money), not `door_records`
(which has no `contact_id`) — the blocker category is `gate_sale`, and `CONTACT_DELETE_BLOCKERS` in
`contactService.ts` is the single source of truth the parity test (C15) checks. (2) `deleteContact` uses
the DURABLE `recordAudit` (a `contact.deleted` row), not the log-only `writeAudit`, so FR-010 is a real
audit trail. (3) The guard is built from drizzle schema table/column refs (not raw SQL identifiers) for
type safety. (4) F1 coverage shipped as one representative of each FK class (role_grant = cascade,
performer = set-null) plus the C15 list-parity assertion. Verified: 63 files / 214 tests green, tsc +
Prettier + ESLint clean._
