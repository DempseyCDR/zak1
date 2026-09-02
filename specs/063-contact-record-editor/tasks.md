# Tasks: Contact Record Editor — Scalar Fields

**Feature**: 063-contact-record-editor | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

**Scope**: turn the read-only contact `RecordView` (feature 062) into an editable record for scalar
fields — first/last name, Automatic/Custom display name, pronouns, phone — committed by one **Save**;
show `is_volunteer` **read-only** (its designate/clear lives on the access screen) plus a read-only
standing block. **Reuse** the existing `patchContact` service, `contactPatchSchema`, and
`GET/PATCH /api/contacts/[id]`. **No schema, no migration, no new capability.** **Test-First**
(constitution I).

⚠️ Server work is small: the PATCH route **strips `isVolunteer`** when the actor lacks `role.assign`
(silent-ignore per clarification) — endpoint defense, since `contact.write` is held broadly (a door
attendant holds it). The editor never sends `is_volunteer`. Everything else is UI on the existing
`(admin)/contacts/page.tsx`. Contract checks live in
[contracts/record-editor.md](./contracts/record-editor.md).

> **Post-implementation decision (2026-09-01):** `is_volunteer` was initially built as a role-assign-
> gated toggle (with a `roleAssign` field on `/api/me/capabilities`). On review, the access screen
> already owns designate/clear with grant-cascade + approval, so the editor was made **read-only** for
> the flag: the capabilities `roleAssign` field and its test were reverted; the endpoint guard stays.
> T007/T009/T010/T011 below are annotated with what actually shipped.

Note: the component tests all live in `tests/component/contacts.page.test.tsx` (one file → written
sequentially, each as its own `describe`); the two integration test files are independent and `[P]`.

---

## Phase 1: Setup

- [X] T001 Establish a green baseline: `pnpm vitest run tests/integration/contacts.volunteer.test.ts tests/component/contacts.page.test.tsx && pnpm tsc --noEmit` — all pass before any change.

## Phase 2: Foundational

None — US1 delivers the editable record shell (full-record fetch on open + form), which the later
stories layer onto. No separate shared prerequisite. Proceed to US1.

## Phase 3: User Story 1 — Edit a contact's core details (Priority: P1) 🎯 MVP

**Goal**: open a contact into an editable form (first/last/pronouns/phone), Save via one `PATCH`, Cancel
discards. Server already persists these fields; this story is the client editor.

**Independent test**: open a seeded contact, change last name + phone, Save, and confirm the record and
its search name reflect the edits; Cancel on a dirty form issues no PATCH.

- [X] T002 [P] [US1] In `tests/component/contacts.page.test.tsx`, add failing cases (mock `fetch` for `GET /api/contacts/:id`, `PATCH /api/contacts/:id`, and `/api/me/capabilities`): opening a record fetches the full contact and pre-fills first/last/pronouns/phone (C4); editing fields + **Save** issues one `PATCH /api/contacts/:id` with those fields (C5); **Cancel/Close** discards without a PATCH (C11). Run; watch fail.
- [X] T003 [US1] In `src/app/(admin)/contacts/page.tsx`, replace the read-only `RecordView` body with an edit form: on open, fetch `GET /api/contacts/:id` and populate first/last/pronouns/phone; add **Save** (PATCH the scalar fields, then re-search + refresh) and **Cancel/Close** (discard). Add form styles to `src/app/(admin)/contacts/contacts.module.css`. Make T002 pass. (depends: T002)

**Checkpoint**: US1 MVP — Mel can correct a contact's core details in one screen.

## Phase 4: User Story 2 — Automatic vs Custom display name (Priority: P1)

**Goal**: the display name is an Automatic (override `null`, read-only live preview) / Custom (pinned
override) control with one toggling button; blank custom on save = reset; editing first/last while
Custom does not move the pinned name.

**Independent test**: toggle Automatic→Custom, pin a name, confirm it holds when first/last change; reset
(button or blank) returns to Automatic tracking "first last".

- [X] T004 [US2] In `tests/component/contacts.page.test.tsx`, add failing cases for all four SC-003 transitions: Automatic mode shows a read-only display-name preview of "first last" with a **Set custom name** button (C6); **Set custom name** makes the field editable, prefilled with the effective name, and Save sends a non-blank `displayNameOverride` (C7); in Custom mode, **editing first/last does not change the pinned name** and Save does not send a new override for it (C12); clicking **Reset to automatic** sends `displayNameOverride: null` (C13); in Custom mode, Save with the custom field blank sends `displayNameOverride: null` (C8). Run; watch fail. (same file as T002 — sequential)
- [X] T005 [US2] In `src/app/(admin)/contacts/page.tsx`, add the Automatic/Custom control: one override input + read-only live preview of the effective name + one button toggling **Set custom name** ⇄ **Reset to automatic**; blank/whitespace custom → send `null`; **Reset to automatic** sends `null`; editing first/last must not overwrite a pinned override (the preview may reflect underlying parts, but the pinned `displayNameOverride` is unchanged until an explicit reset). Make T004 pass (C6/C7/C8/C12/C13). (depends: T003, T004 — same file)

**Checkpoint**: US2 — the display name is correctly Automatic-or-Custom.

## Phase 5: User Story 3 — Volunteer flag read-only here, guarded at the endpoint (Priority: P2)

**Goal**: the editor shows `is_volunteer` **read-only for everyone** and never sends it; the contact
save endpoint silently ignores an `is_volunteer` change from a viewer without `role.assign` (endpoint
defense, since `contact.write` is broadly held), while a `role.assign` actor's change persists.
Designate/clear proper stays on the access screen.

**Independent test**: open the record as any viewer → `is_volunteer` shows read-only, no control, and a
save never carries it; at the endpoint, a `contact.write`-only actor's `is_volunteer` change is ignored
(rest saves) while a `role.assign` actor's persists.

- [X] T006 [P] [US3] In `tests/integration/contacts.volunteer.test.ts`, add failing cases using `makeActor`: a `mailing_list_manager` (holds `contact.write`, not `role.assign`) PATCHing `{ lastName, isVolunteer: true }` on a non-volunteer → 200, last name saved, `is_volunteer` still false (C1); a `role.assign` actor (VP-also-MLM, needs `contact.write` too) toggling `isVolunteer` → persists (C2). Keep the existing super_user cases green. Run; watch fail.
- [X] ~~T007~~ **REVERTED** — capabilities `roleAssign` field is not needed once the editor shows the flag read-only; the `me.capabilities.test.ts` file was deleted with the decision above.
- [X] T008 [US3] In `src/app/api/contacts/[id]/route.ts`, before calling `patchContact`, when `!actorCan(ctx.actor, "role.assign")` delete `isVolunteer` from the parsed input (silent-ignore; the rest still saves). Make T006 pass. (depends: T006)
- [X] ~~T009~~ **REVERTED** — no `roleAssign` field on `/api/me/capabilities` (client no longer consumes it; route left at its original two fields).
- [X] T010 [US3] In `tests/component/contacts.page.test.tsx`, assert the editor shows `is_volunteer` read-only with **no** toggle (no checkbox) and that a Save never carries `is_volunteer` (C9). Run; watch fail. (same file — sequential)
- [X] T011 [US3] In `src/app/(admin)/contacts/page.tsx`, render `is_volunteer` read-only in the standing block for all viewers; the editor does not fetch capabilities and never sends `is_volunteer`. Make T010 pass. (depends: T005, T010 — same file)

**Checkpoint**: US3 — the editor shows the flag read-only; the endpoint refuses unauthorized changes.

## Phase 6: User Story 4 — Read-only standing at a glance (Priority: P3)

**Goal**: show `membership_status`, `needs_review`, and volunteer-approval fields read-only; never show
`source`; no membership/list-member editor.

**Independent test**: open a contact and confirm the context block renders the standing fields read-only
and that `source` is absent.

- [X] T012 [US4] In `tests/component/contacts.page.test.tsx`, add a failing case: the record shows a read-only context block with membership status, needs-review, and volunteer-approval, and does **not** render `source` (C10). Run; watch fail. (same file — sequential)
- [X] T013 [US4] In `src/app/(admin)/contacts/page.tsx`, add the read-only context block (`membership_status`, `needs_review`, `volunteer_approved_at` / `_by`); do not render `source`; no membership/list-member control. Make T012 pass. (depends: T011 — same file)

**Checkpoint**: US4 — standing is visible without being editable.

## Phase 6b: User Story 1 refinement — field labels + phone formatting (Priority: P1)

**Goal** (FR-018/FR-019): every editable field carries a **visible label**, and the phone is shown in the
human-readable dashed form (`formatPhone`) while Save re-canonicalizes via the existing server-side
`normalizePhone` (untouched phone round-trips unchanged).

**Independent test**: open a record and confirm each edit field shows a visible label and the phone reads
`585-555-1234`; save an untouched record and confirm the stored phone is unchanged.

- [X] T017 [US1] In `tests/component/contacts.page.test.tsx`, update the editor stub record's phone to the stored canonical form (`+15855551234`) and add failing cases: each editable field is reachable by its **visible label** (First name / Last name / Display name / Pronouns / Phone) — assert the label text renders (C14); the phone field displays `585-555-1234` (C15). Adjust the existing C4 phone assertion to the formatted value. Run; watch fail.
- [X] T018 [US1] In `src/app/(admin)/contacts/page.tsx`, add a visible `<label>` for each editable field, and populate the phone field with `formatPhone(record.phone)` on open (importing `formatPhone` from `@/server/domain/contacts/phone`); Save sends the field value, which the endpoint re-normalizes. Add label styles to `contacts.module.css`. Make T017 pass. (depends: T013 — same file)

**Checkpoint**: US1 refinement — the form is labelled and the phone is readable.

## Phase 6c: User Story 1 refinement — open the editor as a modal (Priority: P1)

**Goal** (FR-020): the opened record editor appears as a **modal overlay in front of** the results lists
(not inline below them), labeled by the contact, focus moved in on open; it closes on Save and Cancel
(Escape cancels) and returns focus to the search field. Backdrop click does not close it.

**Independent test**: open a record → a dialog appears over the lists; Save and Cancel and Escape each
close it; on open, focus is inside the dialog; on close, focus returns to search.

- [X] T019 [US1] In `tests/component/contacts.page.test.tsx`, add failing cases: opening a record renders a `role="dialog"` labeled by the contact that contains the edit form (C16); pressing **Escape** closes it with no PATCH (C17); on open, focus is on the first field (C18). Run; watch fail. (same file — sequential)
- [X] T020 [US1] In `src/app/(admin)/contacts/page.tsx`, wrap the `RecordView` in a fixed backdrop + `role="dialog"` `aria-modal` panel (labeled by `record.displayName`); focus the first field on open (effect), handle Escape → cancel, and return focus to search on Cancel. Add `.backdrop` / `.modalPanel` styles to `contacts.module.css`. Make T019 pass. (depends: T018 — same file)

**Checkpoint**: US1 refinement — the editor is a focused modal, not a below-the-fold inline form.

## Phase 7: Polish & Cross-Cutting

- [X] T022 Read-only flags layout (FR-012 refinement): the yes/no context flags (`is_volunteer`,
  `list_member`, `needs_review`) were collapsed from three stacked `dt/dd` rows into one wrapping
  `.flags` row (`page.tsx` + `contacts.module.css`); the variable-length values (membership status,
  volunteer-approval date) stay as stacked pairs. Updated the C9 assertion to the flag structure.
- [X] T021 Touch-target sizing fix (bug found in review): the 48px touch-target floor was rendering at
  **72px** because `min-block-size: var(--space-7)` stacked on top of `padding: var(--space-3)` under the
  default `content-box` (no global `box-sizing` reset). Added `box-sizing: border-box` to `.touchTarget`
  (`AdminPage.module.css`) and the `.open`/`.rowContent` rows (`TriageList.module.css`) so 48px is the
  **total** control height (padding inside). Fixes the oversized inputs/rows that pushed the modal's Save
  button below the fold. Affects all admin touch targets (shared 060 helper) — the intended 48px floor.
- [X] T014 Regression + typecheck: `pnpm vitest run tests/component tests/integration/contacts.volunteer.test.ts tests/integration/authz.pii.test.ts tests/integration/contactNames.test.ts tests/integration/contact.phoneNormalize.test.ts && pnpm tsc --noEmit` — all green (endpoint + PII gating + name/phone behavior unchanged). (depends: T013)
- [X] T015 [P] Prettier/ESLint on changed files only (`contacts/page.tsx`, `contacts.module.css`, `contacts/[id]/route.ts`, `contacts.volunteer.test.ts`, `contacts.page.test.tsx`).
- [~] T016 Browser (auth-gated, manual) — signed in at `/contacts`: open a record, correct fields + Save, run the Automatic/Custom transitions, confirm `is_volunteer` shows read-only in the standing block (no control), and confirm the context block shows standing with no `source`. `/contacts` is `requireStaff`-gated (no dev bypass); the behavior is covered by the integration + component tests, so only the live visual confirmation remains.

---

## Dependencies

- **Setup (T001)** → stories.
- **US1**: T002 (tests) → T003 (editor).
- **US2**: T004 (tests) → T005 (control; needs T003 — same file).
- **US3**: T006 → T008 (route gate); T010 → T011 (UI; needs T005). *(T007/T009 reverted.)*
- **US4**: T012 → T013 (needs T011 — same file).
- **Same-file sequential**: `contacts/page.tsx` (T003 → T005 → T011 → T013) and
  `contacts.page.test.tsx` (T002 → T004 → T010 → T012).
- **Story independence**: US1 is a viable MVP (editable core fields). US2/US3/US4 each layer on and are
  independently testable.

## Parallel execution examples

- **T006** (volunteer integration test) ∥ the component-test chain — different files.
- **T015** (lint) is `[P]`.
- Sequential (same file): the `page.tsx` chain (T003→T005→T011→T013) and the component-test chain
  (T002→T004→T010→T012).

## Implementation strategy

MVP = **US1** (editable core fields, one Save). **US2** makes the display name Automatic/Custom; **US3**
shows `is_volunteer` read-only and guards it at the endpoint; **US4** adds read-only standing. Every
story reuses the existing service, schema, validation, endpoint, and `RecordView` — no schema, no
migration, no new capability.

*Impl notes: everything landed test-first (each check red before its impl). Findings worth recording:
(1) `is_volunteer` already has a governance-complete write path on the access screen (designate/clear
with grant-cascade + approval), so the editor was made **read-only** for the flag rather than offering a
toggle — the initial `roleAssign`-on-capabilities work (T007/T009) was reverted. (2) The endpoint guard
(T008) stays and is genuinely valuable: `contact.write` is held broadly (a door attendant creating
contacts at check-in holds it), so the PATCH route must refuse an `is_volunteer` change without
`role.assign`. (3) The endpoint also requires `contact.write`, so a `role.assign` holder can change the
flag there only if they **also** hold `contact.write` — the VP-also-mailing-list-manager, which C2
models. (4) `contacts.volunteer.test.ts` gained a second `describe`, so its DB lifecycle hooks were
hoisted to file level (a single `closeDb` for the shared pool).*
