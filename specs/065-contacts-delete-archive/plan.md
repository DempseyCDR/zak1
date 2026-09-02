# Implementation Plan: Contact Archive & Delete

**Branch**: `065-contacts-delete-archive` | **Date**: 2026-09-02 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/065-contacts-delete-archive/spec.md`

## Summary

Add two ways to take a contact out of active use: a **soft archive** (a reversible `archived_at` marker,
mirroring `bands.archived_at`) that hides the contact from every active read, and a **hard delete** in
two forms — a **safe** delete (new `contact.delete`, mailing-list manager) that only removes a **bare**
contact (referenced by nothing but its own emails) and refuses otherwise, and an **unrestricted** delete
(new `contact.delete.unrestricted`, super-user) that bypasses the guard. Archive/restore ride on the
existing `contact.write`. Archived contacts are surfaced only via a compact **"+ archived"** search
toggle; deletions are confirmed and audited.

This is the largest of the recent contact features: it carries a **schema change + migration** (the
`archived_at` column), **two new capabilities**, an **active-read filter** applied across every read that
already excludes merged contacts (contact search/counts, dedup candidates, mailing-list exports), and the
archive/restore + delete domain + endpoints + editor controls.

## Technical Context

**Language/Version**: TypeScript 5.7 (strict)

**Primary Dependencies**: Next.js 16 (App Router, `(admin)` group), React 19, Drizzle ORM, Zod

**Storage**: PostgreSQL 16 — **schema change**: `contacts.archived_at timestamptz NULL` (migration 0041)

**Testing**: Vitest — real-Postgres integration + jsdom component tests

**Target Platform**: Web (mobile-first admin surface)

**Project Type**: Web application (single Next.js project)

**Performance Goals**: N/A beyond existing — reads gain one more `IS NULL` predicate; a supporting partial
index is optional and deferred unless the trigram searches show regression

**Constraints**: reuse the 063 record editor + modal for the controls and the 064 launcher/search;
deletion is capability-gated and confirmed; PII gating (016) unchanged

**Scale/Scope**: hundreds of contacts; one column + migration, two capabilities, ~7 read sites filtered,
archive/restore/delete domain + endpoints, and editor + search UI

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Test-First (NON-NEGOTIABLE)**: PASS — the archive marker + active-read exclusion, the bare-record
  delete guard (refuse vs. remove), the unrestricted override, capability gating, and the UI controls all
  land as failing integration/component tests first.
- **II. Simplicity / YAGNI**: PASS — one nullable column (mirrors `bands`), one filter predicate added to
  existing reads, two capability-catalog entries, and small archive/restore/delete services. No new
  archived view (a search toggle), no supporting index unless perf needs it, no soft-delete framework.
- **III. Type Safety**: PASS — the new column, capability keys, and delete-blocker result are typed; no
  `any`.
- **IV. Observability**: PASS — every permanent deletion writes an audit event (FR-010), mirroring the
  existing `contact.merge` audit; archive/restore are ordinary `contact.write` updates.

**Result**: PASS — the schema change and new capabilities are the feature itself (M-R9–M-R12), not
gratuitous complexity; Complexity Tracking not required.

## Project Structure

### Documentation (this feature)

```text
specs/065-contacts-delete-archive/
├── plan.md         ├── research.md      ├── data-model.md
├── quickstart.md   ├── contracts/archive-delete.md   └── tasks.md  (/speckit-tasks)
```

### Source Code (repository root)

```text
src/
├── server/
│   ├── db/
│   │   ├── migrations/0041_contacts_archived_at.sql   # ADD: archived_at column
│   │   └── schema/contacts.ts                          # ADD: archivedAt
│   ├── auth/
│   │   └── capabilities.ts                             # ADD: contact.delete (+MLM), contact.delete.unrestricted (super_user)
│   └── domain/
│       ├── contacts/contactService.ts                  # active-read filter (search ×3, counts, listNeedsReview);
│       │                                               #   searchContacts gains includeArchived; ContactSummary gains archivedAt;
│       │                                               #   archiveContact / restoreContact / deleteContact / contactDeleteBlockers
│       ├── dedup/suggestionService.ts                  # active-read filter (getMergeSuggestions + countMergeSuggestions)
│       └── exports/{exportService,mailingLists,contactTracingService}.ts  # exclude archived from exports
├── app/
│   ├── (admin)/contacts/
│   │   ├── page.tsx            # "+ archived" search toggle (mark archived rows); editor Archive/Restore +
│   │   │                       #   Delete (capability-gated, confirmed, shows refusal reason)
│   │   └── contacts.module.css # toggle + destructive-action styles
│   └── api/
│       ├── me/capabilities/route.ts        # ADD: contactWrite, contactDelete, contactDeleteUnrestricted (UI gating)
│       └── contacts/
│           ├── route.ts                     # GET honors ?archived=1 (include archived in search)
│           └── [id]/
│               ├── route.ts                 # ADD DELETE (safe; ?force=1 → unrestricted, extra capability)
│               ├── archive/route.ts         # ADD POST → archiveContact
│               └── restore/route.ts         # ADD POST → restoreContact

tests/
├── integration/
│   ├── contacts.archive.test.ts   # archive hides from search/counts/dedup/exports; restore; includeArchived
│   └── contacts.delete.test.ts    # bare delete removes; referenced refuses (per category); unrestricted overrides; authz; audit
└── component/
    └── contacts.page.test.tsx     # "+ archived" toggle; editor Archive/Restore + Delete confirm + refusal + capability gating
```

**Structure Decision**: Single Next.js web app. Archive/restore/delete are small domain functions with
dedicated action routes (mirroring the 064 `reviewed` endpoint); the delete route gates the safe path on
`contact.delete` and the `?force=1` unrestricted path additionally on `contact.delete.unrestricted`. The
active-read filter is one predicate added everywhere a merged contact is already excluded. UI controls
live on the existing 063 editor + 064 search; the client learns which buttons to show from the extended
`/api/me/capabilities`.

## Complexity Tracking

> No Constitution Check violations — this section intentionally left empty.
