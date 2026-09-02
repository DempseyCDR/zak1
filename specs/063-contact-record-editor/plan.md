# Implementation Plan: Contact Record Editor — Scalar Fields

**Branch**: `063-contact-record-editor` | **Date**: 2026-09-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/063-contact-record-editor/spec.md`

## Summary

Turn the read-only contact record card (feature 062) into an **editable record** for a contact's scalar
fields — first/last name, the Automatic-or-Custom display name, pronouns, phone — committed by one
explicit **Save**, plus a **read-only** `is_volunteer` and a read-only standing block (membership status,
needs-review, volunteer-approval). `is_volunteer` is read-only because its designate/clear (with
grant-cascade + approval) already lives on the access screen.

The backend already does almost all the work: `patchContact` recomputes the display name / search keys,
resets the override on a blank value, and normalizes phone; `contactPatchSchema` already carries every
field including `isVolunteer`; `GET /api/contacts/[id]` returns the full record (PII-gated). One small
server change remains: **guard `is_volunteer` at the PATCH route** — strip it from the input when the
actor lacks `role.assign`, so an unauthorized change is silently ignored (per clarification) while the
rest of the save applies. This is endpoint defense: `contact.write` is broadly held (a door attendant
creating contacts at check-in holds it), so the endpoint must not become a back door to the staff-access
gate. The remainder is UI: the edit form on the existing `RecordView`, fed by a full-record fetch on
open. **No schema change, no migration, no new capability.**

> Note: an earlier draft of this plan also exposed `roleAssign` on `/api/me/capabilities` to drive an
> in-editor volunteer toggle. That was reverted after review — the access screen owns designate/clear, so
> the editor shows the flag read-only and needs no capability check.

## Technical Context

**Language/Version**: TypeScript 5.7 (strict)

**Primary Dependencies**: Next.js 16 (App Router, `(admin)` route group), React 19, Drizzle ORM, Zod

**Storage**: PostgreSQL 16 — **no schema change** (every field already on `contacts`)

**Testing**: Vitest — real-Postgres integration tests + jsdom component tests

**Target Platform**: Web (mobile-first admin surface)

**Project Type**: Web application (single Next.js project)

**Performance Goals**: N/A beyond existing — single-record read/patch; no new hot path

**Constraints**: Mobile-first; token-driven module CSS (no new palette); reuse the 060 `RecordView`
shell and the 062 search surface (no new page/route); PII read gating (016) unchanged

**Scale/Scope**: Small — one editable record at a time; ~1 route edit, 1 route field add, 1 service
gate, 1 client screen

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Test-First (NON-NEGOTIABLE)**: PASS — the `is_volunteer` endpoint guard (honored for role-assign,
  ignored for contact-write-only), the read-only flag in the editor, and the Automatic/Custom + Save UI
  are written as failing integration and component tests first, then made green.
- **II. Simplicity / YAGNI**: PASS — reuses the existing service, schema, validation, endpoint, and
  `RecordView`; the guard is a one-line route-level strip (no new service parameter, no signature churn,
  no new capability, no migration). The flag is read-only, so no client capability plumbing is added.
- **III. Type Safety**: PASS — `ContactPatchInput` already types the payload; no `any`.
- **IV. Observability**: PASS — PII disclosure on the record read is already audited (016); the volunteer
  guard is a silent no-op that changes nothing, so it needs no new audit event.

**Result**: PASS — no violations; Complexity Tracking not required.

## Project Structure

### Documentation (this feature)

```text
specs/063-contact-record-editor/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── record-editor.md
└── tasks.md             # Phase 2 (/speckit-tasks — not created here)
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── (admin)/contacts/
│   │   ├── page.tsx                 # EDIT: read-only RecordView → modal edit form (Save/Cancel/Esc);
│   │   │                            #       full-record fetch on open; Automatic/Custom control;
│   │   │                            #       labelled fields; formatted phone; is_volunteer read-only
│   │   └── contacts.module.css      # EDIT: modal overlay + edit-form / label / context styles
│   └── api/
│       └── contacts/[id]/route.ts   # EDIT: PATCH strips isVolunteer when actor lacks role.assign
└── server/domain/contacts/
    └── contactService.ts            # UNCHANGED (patchContact already does names/override/phone)

tests/
├── integration/
│   └── contacts.volunteer.test.ts   # EXTEND: contact-write-only ignores isVolunteer; role.assign honors
└── component/
    └── contacts.page.test.tsx       # EXTEND: edit + Save; Automatic/Custom transitions;
                                     #         is_volunteer read-only (no toggle); source hidden
```

**Structure Decision**: Single Next.js web app. The edit surface lives in the existing
`(admin)/contacts/page.tsx` on the `RecordView` shell (060) reached from the 062 search — no new route.
Server enforcement of the volunteer gate lives at the PATCH route (the sole non-test caller of
`patchContact`), keeping the domain service a pure data operation.

## Complexity Tracking

> No Constitution Check violations — this section intentionally left empty.
