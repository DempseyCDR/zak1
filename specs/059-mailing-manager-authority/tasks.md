# Tasks: Mailing-List Manager Authority to Maintain Contacts

**Feature**: 059-mailing-manager-authority | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

**Scope**: authorization-policy change only — grant `mailing_list_manager` two capabilities in
`src/server/auth/capabilities.ts` (`contact.write: "global"`; `contact.mailing.write` `scoped → global`).
No schema, no endpoints, no UI. **Test-First is mandatory** (Constitution I): every implementation task is
preceded by failing assertions.

⚠️ **Do not confuse two capabilities.** `mailing_list.write` (managing a series' list) **stays `scoped`**
and its existing assertion in `authz.can.test.ts` must remain green. This feature changes
**`contact.mailing.write`** (editing a contact's emails/consent) to `global`.

---

## Phase 1: Setup

- [ ] T001 Create branch `059-mailing-manager-authority` off `main` for this change (per the no-self-merge convention), separate from `docs/data-model-refresh`.
- [X] T002 Establish a green baseline: run `pnpm vitest run tests/unit/authz.can.test.ts tests/integration/authz.*.test.ts` and `pnpm tsc --noEmit`; confirm all pass before any edit.

## Phase 2: Foundational

No shared prerequisites — the MLM grant fixture (`mlmOfEcd`) already exists in `tests/unit/authz.can.test.ts`, and the gated endpoints and `can()` evaluator already exist unchanged. Proceed to the user stories.

## Phase 3: User Story 1 — Maintain the contact record (Priority: P1) 🎯 MVP

**Goal**: `mailing_list_manager` gains `contact.write` (club-wide), so an MLM-only holder can create/edit a contact record.

**Independent test**: `can(mlm, "contact.write")` is `true` (incl. a series-scoped MLM grant); an MLM-only session may `POST /api/contacts` and `PATCH /api/contacts/[id]`; boundary capabilities stay refused.

- [X] T003 [P] [US1] In `tests/unit/authz.can.test.ts`, add failing assertions: `can(mlmOfEcd, "contact.write", { seriesId: TNC })` → `true` and `can([{ role: "mailing_list_manager", seriesId: null, groupId: null }], "contact.write")` → `true` (a series-scoped MLM confers `contact.write` everywhere — `global`). Run; watch fail.
- [X] T004 [P] [US1] Governance-boundary assertions (MLM allowed `contact.write`, still refused `role.assign` / `membership.write` / `gate.write`, C3). **Consolidated into `tests/unit/authz.can.test.ts`** (pure `can()` — deterministic, no DB; the endpoints' enforcement is already covered by the existing generic auth tests) rather than a new endpoint test in `authz.boundaries.test.ts`.
- [X] T005 [US1] In `src/server/auth/capabilities.ts`, add `"contact.write": "global"` to the `mailing_list_manager` map. Re-run T003 + T004; both pass. (depends: T003, T004)

**Checkpoint**: US1 is a viable MVP — the mailing-list manager can now maintain contact records.

## Phase 4: User Story 2 — Maintain mailing permissions club-wide (Priority: P2)

**Goal**: `mailing_list_manager`'s `contact.mailing.write` becomes `global`, so email/consent edits work on any contact regardless of series.

**Independent test**: `can(mlmOfEcd, "contact.mailing.write", { seriesId: TNC })` → `true` (previously the series scope could filter it out), while `mailing_list.write` stays scoped.

- [X] T006 [P] [US2] In `tests/unit/authz.can.test.ts`, add a failing assertion: `can(mlmOfEcd, "contact.mailing.write", { seriesId: TNC })` → `true` (global). **Leave the existing `mailing_list.write` scoped assertion unchanged.** Run; watch fail.
- [X] T007 [P] [US2] Scope assertion: a series-scoped `mailing_list_manager` grant confers `contact.mailing.write` outside its series (`can(mlmOfEcd, "contact.mailing.write", { seriesId: TNC })` → `true`). **Consolidated into `tests/unit/authz.can.test.ts`** (same rationale as T004) rather than `authz.scope.test.ts`.
- [X] T008 [US2] In `src/server/auth/capabilities.ts`, change `mailing_list_manager`'s `"contact.mailing.write"` from `"scoped"` to `"global"`. Re-run T006 + T007; both pass. (depends: T006, T007, and T005 — same file as T005)

**Checkpoint**: US2 complete — email/consent editing works club-wide.

## Phase 5: Polish & Cross-Cutting

- [X] T009 Run the full authorization suite + typecheck (`pnpm vitest run tests/unit/authz.can.test.ts tests/integration/authz.*.test.ts` and `pnpm tsc --noEmit`); confirm **zero regressions** across all roles (C4) and that C1–C4 are green. (depends: T005, T008)
- [X] T010 [P] Run Prettier/ESLint on the changed files only (`src/server/auth/capabilities.ts`, `tests/unit/authz.can.test.ts`, `tests/integration/authz.boundaries.test.ts`, `tests/integration/authz.scope.test.ts`).

---

## Dependencies

- **Setup (T001–T002)** before everything.
- **US1**: T003, T004 (test-first) → T005 (impl).
- **US2**: T006, T007 (test-first) → T008 (impl). T008 also **after T005** (same file: `capabilities.ts`). T006 also **after T003** (same file: `authz.can.test.ts`).
- **Polish**: T009 after T005 + T008; T010 after the edits it formats.
- **Story independence**: US1 delivers value alone (MVP). US2 is additive; both edit `capabilities.ts`, so their impl tasks are sequential, not parallel.

## Parallel execution examples

- **US1 tests**: T003 (`authz.can.test.ts`) and T004 (`authz.boundaries.test.ts`) are different files → run in parallel.
- **US2 tests**: T006 (`authz.can.test.ts`) and T007 (`authz.scope.test.ts`) are different files → run in parallel.
- **Never parallel**: T005 and T008 (both edit `capabilities.ts`).

## Implementation strategy

MVP = **US1 only** (add `contact.write: "global"`): ship the ability to maintain contact records. US2
(the `contact.mailing.write` global flip) is a clean follow-on in the same file. The whole feature is one
~2-line production edit gated behind test-first assertions.
