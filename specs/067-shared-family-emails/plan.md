# Implementation Plan: Shared / Family Emails (ownership + reference)

**Branch**: `067-shared-family-emails` | **Date**: 2026-09-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/067-shared-family-emails/spec.md`

## Summary

Model a legitimate household email share without weakening the active-email uniqueness rule. One contact
**owns** an address (an unchanged `contact_emails` row); other household members **reference** it through a
single nullable pointer on `contacts`. Because the reference lives on the contact and not on an email row,
uniqueness, staff sign-in, and `is_login` ownership are preserved **by construction** — this feature adds
no constraint changes and no sign-in changes (M-R24 / M-R25, both marked VERIFIED in the source doc and
re-confirmed against `signIn.ts` during specify).

Three behavioral additions ride on that pointer: (1) a **"link as shared"** resolution offered wherever a
same-address collision surfaces, standing beside "merge" and never chosen automatically; (2) **recipient
resolution in every export** — a contact with no owned address resolves to its referenced address, output
is deduped by resolved address, and each row carries the **owner's** name so the provider file format is
untouched; (3) **lifecycle** — gaining an owned address clears the reference, and removing or deactivating
a referenced address clears every referrer's pointer and flags them `needs_review`.

## Technical Context

**Language/Version**: TypeScript 5.7 (strict), Node 24

**Primary Dependencies**: Next.js 16 (App Router, `(admin)` route group), React 19, Drizzle ORM, Zod

**Storage**: PostgreSQL 16 (citext, partial unique indexes, enum arrays); hand-written SQL migrations in
`src/server/db/migrations/` applied lexically by `runMigrations`. Next migration: **0042**.

**Testing**: Vitest — integration suites against a real local Postgres (`zak1_test`, schema built by
`ensureSchema`) plus jsdom component tests for React surfaces.

**Target Platform**: Web (admin/volunteer surfaces + CSV export downloads)

**Project Type**: Web application (single Next.js app; server domain + API routes + React surfaces)

**Performance Goals**: Not a hot path. Exports are small batch jobs (club-scale: thousands of contacts, not
millions); recipient resolution must not turn a single list query into per-contact N+1 queries.

**Constraints**: The provider-facing CSV **column format must not change** (clarify answer 4). Active-email
uniqueness, sign-in matching, and `is_login` semantics must remain untouched (FR-006–FR-008).

**Scale/Scope**: One new nullable column + FK, one migration, ~4 export call sites gaining resolution, 2
new API endpoints, and 3 UI surfaces (record editor reference block, 066 collision path, dedup page).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment | Status |
|---|---|---|
| **I. Test-First (NON-NEGOTIABLE)** | Every requirement is expressible as an integration test against real Postgres (pointer lifecycle, export resolution/dedupe, uniqueness + sign-in regression guards) or a jsdom component test (link-as-shared affordance, reference block). Tests are written before implementation, per phase. | ✅ PASS |
| **II. Simplicity / YAGNI** | Single nullable pointer — no reference-type email row, no consent duplication, no household entity (all three explicitly rejected in the source doc). One shared recipient-resolution helper is justified because it is needed at **four** call sites (three list kinds + contact tracing), exceeding the "three or more places" bar. | ✅ PASS |
| **III. Type Safety** | Pointer is a typed nullable `uuid` FK in the Drizzle schema; request bodies validated with Zod at the API boundary and converted to typed domain values; no casts or `any` planned. | ✅ PASS |
| **IV. Observability** | Linking, unlinking, and lifecycle clearing are durable audit rows via `recordAudit` (the pattern established in 065/066), not log-only, so "why did this contact lose its address?" is answerable. | ✅ PASS |

**Testing standard**: integration tests run against a real local Postgres — the FK `ON DELETE SET NULL`,
the partial unique index, and citext comparison are all exercised for real, never faked. No third-party
service is involved, so the 1.2.0 external-IdP exception is not invoked.

**Workflow**: multi-contributor mode (feature branch `067-shared-family-emails` + reviewed PR, no
self-merge), per constitution 1.3.0 and the standing project convention.

**Post-Phase-1 re-check**: ✅ PASS — the design below adds no speculative abstraction, no schema beyond the
single pointer, and no new capability (`contact.mailing.write` is already global for `mailing_list_manager`
from feature 059, so the clarify answer requires **no catalog change**).

## Project Structure

### Documentation (this feature)

```text
specs/067-shared-family-emails/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── shared-emails.md # Phase 1 output
├── checklists/
│   └── requirements.md  # From /speckit-specify
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
src/server/db/
├── migrations/0042_contacts_message_recipient.sql   # NEW: pointer column + FK + index
└── schema/contacts.ts                                # messageRecipientEmailId

src/server/domain/
├── contacts/
│   ├── referenceService.ts        # NEW: link / unlink / clearReferencesTo
│   ├── emailService.ts            # patchEmail + deleteEmail call clearReferencesTo; addEmail clears own
│   └── contactService.ts          # getContact projects messageRecipient + sharedWith
├── exports/
│   ├── recipients.ts              # NEW: shared resolved-recipient SQL used by all export paths
│   ├── exportService.ts           # member / performer / topic lists resolve + dedupe
│   └── contactTracingService.ts   # attendance export resolves + dedupes
└── dedup/mergeService.ts          # unchanged (references follow the email row by id)

src/app/api/contacts/[id]/message-recipient/route.ts  # NEW: PUT (link) / DELETE (unlink)

src/app/(admin)/contacts/
├── _components/MessageRecipient.tsx   # NEW: reference block + owner roster
├── _components/EmailEditor.tsx        # collision gains "link as shared"
└── page.tsx                           # renders the reference block in the record modal

src/app/(admin)/dedup/page.tsx         # pair resolution gains "link as shared"

tests/
├── integration/
│   ├── contacts.sharedEmail.test.ts       # NEW: link/unlink, guards, invariants
│   ├── contacts.sharedLifecycle.test.ts   # NEW: M-R27 transitions
│   └── exports.sharedRecipients.test.ts   # NEW: resolution + dedupe across all lists
└── component/contacts.messageRecipient.test.tsx  # NEW: reference block + link-as-shared
```

**Structure Decision**: Existing single-app layout, unchanged. The one genuinely new module is
`src/server/domain/exports/recipients.ts` — the shared resolution used by all four export paths, which is
what keeps this feature from being copy-pasted into each list query.

## Complexity Tracking

> No Constitution Check violations. Table intentionally empty.
