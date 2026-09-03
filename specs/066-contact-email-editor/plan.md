# Implementation Plan: Contact Email Editor

**Branch**: `066-contact-email-editor` | **Date**: 2026-09-02 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/066-contact-email-editor/spec.md`

## Summary

Surface a contact's **emails** as editable rows in the feature-063 record editor: address, purposes,
consent topics, and status per row, with the consent/uniqueness/login rules made **visible**, an
Active/Inactive toggle, add + soft-remove + a super-user hard-delete, a "review as duplicate" path for a
colliding address, a marked-and-guarded login email, and a read-only glance at delivery telemetry.

The email model and most enforcement already exist (`contact_emails` carries status incl. transition,
`is_login`, and provider telemetry; `addEmail` / `patchEmail` enforce DNC-collapse, ≥1 purpose/topic,
login-only-on-volunteer, and reject a cross-contact active collision; `getContact` already returns full
email rows). So this is **largely UI** on the 063 editor. The **new backend** is small: make the **email
address editable** on patch (today `patchEmail` can't change it), turn the collision from a bare
`EMAIL_DUPLICATE` into a **dedup signal** naming the other contact, add a **hard-delete** endpoint
(gated by the existing `contact.delete.unrestricted`), and expose `contactMailingWrite` for UI gating.
**No schema change, no migration, no new capability.**

## Technical Context

**Language/Version**: TypeScript 5.7 (strict)

**Primary Dependencies**: Next.js 16 (App Router, `(admin)` group), React 19, Drizzle ORM, Zod

**Storage**: PostgreSQL 16 — **no schema change** (all email fields already exist)

**Testing**: Vitest — real-Postgres integration + jsdom component tests

**Target Platform**: Web (mobile-first admin surface)

**Project Type**: Web application (single Next.js project)

**Performance Goals**: N/A beyond existing — emails come with the record GET; per-row edits are small
writes

**Constraints**: reuse the 063 editor/modal + the existing add/patch email endpoints + the 062/064
merge flow; edits gated by `contact.mailing.write`, address reads PII-gated (016) unchanged

**Scale/Scope**: a handful of emails per contact; ~4 small backend touches + one email-editor UI
component in the record modal

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Test-First (NON-NEGOTIABLE)**: PASS — editable address + collision reframe, the hard-delete
  endpoint + authz + audit, and the UI (DNC-exclusive, ≥1 purpose/topic, status toggle, add/soft-remove,
  hard-delete gating, collision→review, login confirm, telemetry read-only) all land as failing tests
  first.
- **II. Simplicity / YAGNI**: PASS — reuses `addEmail`/`patchEmail`, the merge flow, and the 063 modal;
  new code is one schema field (`email` on the patch), a richer collision error, one delete endpoint,
  one capabilities flag, and an email-editor component. No new capability (folds under
  `contact.delete.unrestricted`), no schema/migration.
- **III. Type Safety**: PASS — the patch address, the collision error detail, and the capability flag are
  typed; no `any`.
- **IV. Observability**: PASS — an email **hard delete** is a permanent erasure, so it writes an
  `email.deleted` audit row (consistent with 065's `contact.deleted`); add/patch/soft-remove are ordinary
  mailing writes.

**Result**: PASS — no violations; Complexity Tracking not required.

## Project Structure

### Documentation (this feature)

```text
specs/066-contact-email-editor/
├── plan.md         ├── research.md      ├── data-model.md
├── quickstart.md   ├── contracts/email-editor.md   └── tasks.md  (/speckit-tasks)
```

### Source Code (repository root)

```text
src/
├── server/
│   ├── validation/contacts.ts          # emailPatchSchema gains `email` (address) — editable on patch
│   ├── domain/contacts/emailService.ts # patchEmail sets the address; the collision (add + patch) throws
│   │                                    #   a NEW emailActiveElsewhere(contact) instead of bare duplicate;
│   │                                    #   deleteEmail(contactId, emailId) hard-deletes + audits
│   ├── lib/apiError.ts                  # ADD EMAIL_ACTIVE_ELSEWHERE (carries the other contact)
│   ├── lib/audit.ts                     # ADD email.deleted audit kind
│   └── auth/... (capabilities unchanged — reuse contact.delete.unrestricted)
├── app/
│   ├── api/
│   │   ├── me/capabilities/route.ts     # ADD contactMailingWrite
│   │   └── contacts/[id]/emails/[emailId]/route.ts   # ADD DELETE (requires contact.delete.unrestricted)
│   └── (admin)/contacts/
│       ├── page.tsx                     # openRecord captures emails; renders <EmailEditor> in the modal;
│       │                                #   fetch contactMailingWrite; collision → review-as-duplicate merge
│       ├── _components/EmailEditor.tsx  # ADD: the per-contact email rows (address/purposes/topics/status/
│       │                                #   telemetry/login), add/soft-remove/hard-delete, rule visibility
│       └── contacts.module.css          # email-row styles

tests/
├── integration/
│   ├── contacts.emails.test.ts          # EXTEND: patch address; collision → EMAIL_ACTIVE_ELSEWHERE names
│   │                                    #   the other contact; DNC collapse on patch; login-only-volunteer
│   └── contacts.emailDelete.test.ts     # ADD: hard delete gated by contact.delete.unrestricted + audit
└── component/
    └── contacts.emailEditor.test.tsx    # ADD: rows render; DNC exclusive; no-zero purposes/topics;
                                         #   status toggle + transition read-only; add/soft-remove;
                                         #   hard-delete gating; collision→review; login confirm; telemetry
```

**Structure Decision**: Single Next.js web app. The email rows live in a dedicated **`EmailEditor`
client component** rendered inside the 063 record modal (page.tsx is already large; a component keeps it
manageable and independently testable). The backend reuses the existing add/patch endpoints, adds the
address to the patch, enriches the collision, and adds one delete route; the "review as duplicate" action
reuses the existing `POST /api/dedup/merge` with the current + colliding contact.

## Complexity Tracking

> No Constitution Check violations — this section intentionally left empty.
