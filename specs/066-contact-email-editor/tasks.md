# Tasks: Contact Email Editor

**Feature**: 066-contact-email-editor | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

**Scope**: surface a contact's emails as editable rows in the 063 record editor (address, purposes,
consent topics, status), with the rules made **visible**, an Active/Inactive toggle, add + soft-remove +
a super-user hard-delete, a collision → "review as duplicate" path, a marked-and-guarded login email, and
read-only telemetry. **Reuse** the existing add/patch email endpoints, the 062/064 merge flow, and the
063 modal. New backend is small: an editable **address** on patch, an enriched **collision** error, one
**hard-delete** endpoint (gated by the existing `contact.delete.unrestricted`), and a
`contactMailingWrite` flag. **No schema, no migration, no new capability.** **Test-First** (constitution I).

Contract checks C1–C15 live in [contracts/email-editor.md](./contracts/email-editor.md).

Note: `EmailEditor.tsx`, `contacts.emailEditor.test.tsx`, `contacts.emails.test.ts`, and `emailService.ts`
are each edited across several stories (sequential). Server-enforced rules that already exist (DNC
collapse on patch, login-only-on-volunteer) are locked with regression assertions, not re-implemented.

---

## Phase 1: Setup

- [X] T001 Establish a green baseline: `pnpm vitest run tests/integration/contacts.emails.test.ts tests/integration/contacts.login.test.ts tests/component/contacts.page.test.tsx && pnpm tsc --noEmit` — all pass before any change.

## Phase 2: Foundational (blocking prerequisites)

- [X] T002 Add `contactMailingWrite: actorCan(ctx.actor, "contact.mailing.write")` to `src/app/api/me/capabilities/route.ts` (UI gating for the email-edit controls). Blocks the US1+ UI.

**Checkpoint**: the editor can learn whether to offer email-edit controls.

## Phase 3: User Story 1 — See & edit a contact's emails (Priority: P1) 🎯 MVP

**Goal**: each email renders as an editable row (address/purposes/topics/status) in the record editor;
edits (including the address) persist; gated by mailing-write.

**Independent test**: open a contact with emails → rows render; edit an address + topics and save →
persists.

- [X] T003 [P] [US1] In `tests/integration/contacts.emails.test.ts`, add failing cases: `patchEmail` (and `PATCH …/emails/[emailId]`) sets a new **address** (C1); `/api/me/capabilities` returns `contactMailingWrite` per grants (C7). Run; watch fail.
- [X] T004 [US1] Add `email` (address) to `emailPatchSchema` in `src/server/validation/contacts.ts`; make `patchEmail` in `src/server/domain/contacts/emailService.ts` set the address (keeping the collision `try/catch`). Make T003's C1 pass (C7 passed via T002). (depends: T002, T003)
- [X] T005 [P] [US1] In `tests/component/contacts.emailEditor.test.tsx` (new; jsdom), add failing cases: given a contact's emails, `<EmailEditor>` renders each as a row showing address, purposes, consent topics, and status (C8); editing a field + Save issues `PATCH …/emails/[emailId]` (mock `fetch`). Run; watch fail.
- [X] T006 [US1] Create `src/app/(admin)/contacts/_components/EmailEditor.tsx` (rows: address input, purposes + consent-topic multi-selects, status control; Save → PATCH); in `src/app/(admin)/contacts/page.tsx`, capture `emails` in `openRecord`, fetch `contactMailingWrite`, and render `<EmailEditor>` in the record modal (only when `contactMailingWrite`). Add email-row styles to `contacts.module.css`. Make T005 pass. (depends: T004, T005)

**Checkpoint**: US1 MVP — a contact's emails are viewable and editable from the record.

## Phase 4: User Story 2 — Consent/purpose rules are visible (Priority: P1)

**Goal**: do-not-contact is exclusive in the control; the row can never reach zero purposes or topics.

**Independent test**: select do-not-contact → other topics clear/grey; try to remove the last purpose →
prevented.

- [X] T007 [P] [US2] In `tests/integration/contacts.emails.test.ts`, add a regression-lock case: `patchEmail` with `consentTopics` including `do_not_contact` stores exactly `{do_not_contact}` (server collapse, C3). (Already enforced by `effectiveConsentTopics` — this locks it.) Run.
- [X] T008 [US2] In `tests/component/contacts.emailEditor.test.tsx`, add failing cases: selecting **do not contact** clears/greys the other topics (C9); the control prevents reaching zero purposes or zero consent topics (C9). Run; watch fail. (same file — sequential)
- [X] T009 [US2] In `EmailEditor.tsx`, make the consent-topics control do-not-contact-exclusive (selecting it clears/greys the rest) and prevent zero purposes/zero topics. Make T008 pass. (depends: T006, T008 — same file)

**Checkpoint**: US2 — the consent rules are visible in the control, not discovered on a failed save.

## Phase 5: User Story 3 — Status, add, remove, hard-delete (Priority: P1)

**Goal**: Active/Inactive toggle (transition read-only); add an email; soft-remove = set inactive;
super-user hard-delete.

**Independent test**: add an email; toggle Active↔Inactive; a transition row is read-only; only a
super-user can hard-delete.

- [X] T010 [P] [US3] In `tests/integration/contacts.emailDelete.test.ts` (new; file-level DB hooks), add failing cases using `makeActor`: a `contact.delete.unrestricted` holder `DELETE …/emails/[emailId]` erases the row and writes an `email.deleted` audit (C5); an actor without it is refused (C6). Run; watch fail.
- [X] T011 [US3] Add `email.deleted` to the audit-kind union in `src/server/lib/audit.ts`; add `deleteEmail(db, contactId, emailId)` to `emailService.ts` (delete the row + `recordAudit` `email.deleted`); add `DELETE` to `src/app/api/contacts/[id]/emails/[emailId]/route.ts` (`requires: contact.delete.unrestricted`). Make T010 pass. (depends: T010)
- [X] T012 [US3] In `tests/component/contacts.emailEditor.test.tsx`, add failing cases: the status control is an **Active/Inactive** toggle and a `transition` row shows status read-only (C10); **add email** issues a POST and **soft-remove** issues `PATCH { status: "inactive" }` (C11); a **hard-delete** affordance appears only with `contactDeleteUnrestricted` and issues `DELETE` (C12). Run; watch fail. (same file — sequential)
- [X] T013 [US3] In `EmailEditor.tsx`, add the status toggle (transition read-only), an add-email form, soft-remove (PATCH inactive), and a hard-delete button shown only when `contactDeleteUnrestricted`. Make T012 pass. (depends: T009, T011, T012 — same file)

**Checkpoint**: US3 — emails can be added, retired (soft), and (rarely) erased.

## Phase 6: User Story 4 — Collision → review as duplicate (Priority: P2)

**Goal**: setting an address active on another contact yields a named "review as duplicate" prompt
routing into the merge flow, not a raw error, and changes nothing.

**Independent test**: set an address active elsewhere → response names the other contact and offers a
merge; nothing changed.

- [X] T014 [P] [US4] In `tests/integration/contacts.emails.test.ts`, add failing cases: setting an email's address to one active on another contact raises **`EMAIL_ACTIVE_ELSEWHERE`** whose detail names that contact (id + display name); neither email is changed (C2). Cover both **`addEmail`** (POST) and **`patchEmail`** (the editor's two paths). Run; watch fail.
- [X] T015 [US4] Add `EMAIL_ACTIVE_ELSEWHERE` to `src/server/lib/apiError.ts` (409, detail carrying `{ contactId, displayName }`) via an `errors.emailActiveElsewhere(contact)` factory; in `emailService.ts`, add a **pre-write lookup** used by the standalone `addEmail` and `patchEmail` — before the insert/update, query for an active/transition email with the same normalized address on **another** contact and, if found, throw `emailActiveElsewhere(thatContact)`; keep the existing `UNIQUE_VIOLATION` `try/catch` as a fallback (still `emailDuplicate`). **Scope the reframe to `addEmail`/`patchEmail`; do NOT touch `addEmailInTx`** (it runs inside `createContact`'s transaction, where a post-violation lookup would hit an aborted transaction — F1). Make T014 pass. (depends: T004, T014)
- [X] T016 [US4] In `tests/component/contacts.emailEditor.test.tsx`, add a failing case: a save that returns `EMAIL_ACTIVE_ELSEWHERE` shows "already active on [name] — review as duplicate" with a **keep-this / keep-other** choice; choosing one issues `POST /api/dedup/merge` with the chosen `{ canonicalId, mergedId }` (the survivor is Mel's choice, not a fixed direction — F2) (C13). Run; watch fail. (same file — sequential)
- [X] T017 [US4] In `EmailEditor.tsx`, handle the collision response: show the named message and **keep-this / keep-other** buttons (mirroring the 062/064 duplicates section) that merge the current ↔ colliding contact via `/api/dedup/merge` in the chosen direction, then refresh. Make T016 pass. (depends: T013, T015, T016 — same file)

**Checkpoint**: US4 — a colliding address becomes a dedup prompt, not a dead end.

## Phase 7: User Story 5 — Login email marked & guarded (Priority: P2)

**Goal**: a login email is marked "used for staff sign-in"; changing its address or deactivating it needs
a confirmation; login only on volunteers.

**Independent test**: on a volunteer's login email, the row is marked and its change is confirmed; a login
email is refused on a non-volunteer.

- [X] T018 [P] [US5] In `tests/integration/contacts.emails.test.ts`, add a regression-lock case: setting `isLogin: true` on an email of a **non-volunteer** contact is refused (login-only-on-volunteer, C4). (Already enforced by `isLoginAllowed` — this locks it.) Run.
- [X] T019 [US5] In `tests/component/contacts.emailEditor.test.tsx`, add failing cases: a login email's row is marked "used for staff sign-in" (C14); changing its address or setting it inactive requires an explicit confirmation before the request is sent (C14). Run; watch fail. (same file — sequential)
- [X] T020 [US5] In `EmailEditor.tsx`, mark the login row and require a confirmation ("this is a staff sign-in email — proceed?") before sending a login email's address-change or deactivation. Make T019 pass. (depends: T017, T019 — same file)

**Checkpoint**: US5 — the login email is visible and protected from an accidental change.

## Phase 8: User Story 6 — Delivery telemetry read-only (Priority: P3)

**Goal**: each row shows a compact read-only telemetry hint; it is never editable.

**Independent test**: an email with telemetry shows "opened ~3mo ago"-style hint, not editable.

- [X] T021 [US6] In `tests/component/contacts.emailEditor.test.tsx`, add a failing case: a row with provider telemetry shows a compact read-only hint (e.g. last opened), and no telemetry value is an editable control (C15). Run; watch fail. (same file — sequential)
- [X] T022 [US6] In `EmailEditor.tsx`, render a compact read-only telemetry hint per row from the provider fields. Make T021 pass. (depends: T020, T021 — same file)

**Checkpoint**: US6 — Mel can spot a quiet address at a glance.

## Phase 9: Polish & Cross-Cutting

- [X] T023 Regression + typecheck: `pnpm vitest run tests/component tests/integration/contacts.emails.test.ts tests/integration/contacts.emailDelete.test.ts tests/integration/contacts.consent.test.ts tests/integration/contacts.login.test.ts tests/integration/dedup.merge.test.ts tests/integration/authz.pii.test.ts && pnpm tsc --noEmit` — all green (existing email rules, merge, PII, 063/064/065 unchanged). (depends: T013, T017, T020, T022)
- [X] T024 [P] Prettier/ESLint on changed files only (`validation/contacts.ts`, `emailService.ts`, `apiError.ts`, `audit.ts`, `me/capabilities/route.ts`, `emails/[emailId]/route.ts`, `page.tsx`, `EmailEditor.tsx`, `contacts.module.css`, `contacts.emails.test.ts`, `contacts.emailDelete.test.ts`, `contacts.emailEditor.test.tsx`).
- [~] T025 Browser (auth-gated, manual) — signed in at `/contacts`: open a contact with emails; edit an address + topics; DNC clears the rest; toggle status; add + soft-remove; collide an address → review as duplicate; confirm on a login email; hard-delete as super-user; see the telemetry hint. `/contacts` is `requireStaff`-gated (no dev bypass); behavior is covered by the integration + component tests, so only the live visual confirmation remains.

---

## Dependencies

- **Setup (T001)** → **Foundational (T002)** → stories.
- **US1**: T003 → T004 (address); T005 → T006 (editor; needs T004).
- **US2**: T007 (lock) ∥; T008 → T009 (needs T006).
- **US3**: T010 → T011 (delete); T012 → T013 (needs T009 + T011).
- **US4**: T014 → T015 (collision); T016 → T017 (needs T013 + T015).
- **US5**: T018 (lock) ∥; T019 → T020 (needs T017).
- **US6**: T021 → T022 (needs T020).
- **Same-file sequential**: `EmailEditor.tsx` (T006→T009→T013→T017→T020→T022); `contacts.emailEditor.test.tsx` (T005→T008→T012→T016→T019→T021); `emailService.ts` (T004→T011→T015); `contacts.emails.test.ts` (T003→T007→T014→T018).
- **Story independence**: US1 is a viable MVP (view/edit emails). US2–US6 each layer on.

## Parallel execution examples

- **T003** (address integration) ∥ **T005** (editor component test) — different files.
- **T010** (delete integration) ∥ the component-test chain — different files.
- **T007**, **T018** (regression locks) and **T024** (lint) are `[P]`.
- Sequential (same file): the `EmailEditor.tsx`, component-test, `emailService.ts`, and
  `contacts.emails.test.ts` chains above.

## Implementation strategy

MVP = **US1** (view/edit a contact's emails). **US2** makes the consent rules visible; **US3** adds
status/add/remove/hard-delete; **US4** turns a collision into a dedup prompt; **US5** marks and guards the
login email; **US6** adds the telemetry hint. Everything reuses the existing add/patch endpoints, the
merge flow, and the 063 modal — no schema, migration, or new capability.

_Impl notes: (1) the collision reframe (F1) is a **pre-write lookup** in the standalone `addEmail` and
`patchEmail` (throws `emailActiveElsewhere` before the write); `addEmailInTx` (create flow) is untouched
and keeps `emailDuplicate`. (2) `ApiError` gained an optional structured `data` payload merged into the
error body, so `EMAIL_ACTIVE_ELSEWHERE` carries `error.other = { contactId, displayName }` for the
editor's keep-this/keep-other merge (F2). (3) a login-email refusal (`LOGIN_NOT_PERMITTED`) is **422**,
not 403 — the C4 test asserts 422. (4) email hard-delete uses the durable `recordAudit` (`email.deleted`).
Verified: 63 files / 211 tests green, tsc + Prettier + ESLint clean._
