# Implementation Plan: Contacts Page Launcher (M-R4 alteration)

**Branch**: `064-contacts-launcher` | **Date**: 2026-09-02 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/064-contacts-launcher/spec.md`

## Summary

Replace the eager, cluttered contacts page with an **uncluttered launcher**: header + search box + a
task-button row (**Add contact**, **Review queue (n)**, **Review duplicates (n)**). On load fetch only
the two counts; load a result list only when Mel chooses a task or types. The three views (search,
review queue, duplicates) are mutually exclusive; typing shows single-contact results **plus** the
query-scoped duplicate pairs (062's hybrid, retained); the create form moves into a modal.

New backend is small and query-shaped: a **needs-review filter + count**, a **duplicate-pair count**, and
two ways for `needs_review` to **clear** — auto-clear on save once the record has contact data (an email
or phone), and an explicit **"Mark reviewed"** action. `needs_review` is set today but never cleared, so
that clear logic is the one real behavioral addition. **No schema change, no migration.**

## Technical Context

**Language/Version**: TypeScript 5.7 (strict)

**Primary Dependencies**: Next.js 16 (App Router, `(admin)` group), React 19, Drizzle ORM, Zod

**Storage**: PostgreSQL 16 — **no schema change** (`needs_review` column already exists)

**Testing**: Vitest — real-Postgres integration + jsdom component tests

**Target Platform**: Web (mobile-first admin surface)

**Project Type**: Web application (single Next.js project)

**Performance Goals**: launcher load fetches two counts only (no lists); counts are bounded queries — no
new hot path or caching

**Constraints**: mobile-first, token/module-CSS; reuse the 063 modal overlay for the create form and the
063 record editor as the open target; reuse the 062 dedup/merge flow unchanged; PII gating (016) unchanged

**Scale/Scope**: hundreds of contacts; one page refactor + ~3 small endpoints + 3 domain query/clear
functions

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Test-First (NON-NEGOTIABLE)**: PASS — the needs-review filter/count, the dedup count, the
  auto-clear-on-save and Mark-reviewed clears, and the launcher UI (initial empty state, task views,
  create modal) all land as failing integration/component tests first.
- **II. Simplicity / YAGNI**: PASS — reuses `searchContacts`, the dedup/merge endpoints, the 063 modal
  overlay + record editor, and the create form; new code is query filters + counts + a one-field clear.
  No shared create-modal abstraction (deferred Feature B), no "not-a-duplicate" marker (deferred to
  triage), no browse-all.
- **III. Type Safety**: PASS — counts and list shapes typed; the needs-review filter is a typed param;
  no `any`.
- **IV. Observability**: PASS — existing request logging covers the new endpoints; `needs_review` clears
  (auto and manual) are ordinary contact writes. A dedicated `contact.reviewed` audit event is optional
  and only added if it fits the existing audit conventions cheaply.

**Result**: PASS — no violations; Complexity Tracking not required.

## Project Structure

### Documentation (this feature)

```text
specs/064-contacts-launcher/
├── plan.md            # This file
├── research.md        # Phase 0 output
├── data-model.md      # Phase 1 output
├── quickstart.md      # Phase 1 output
├── contracts/
│   └── launcher.md
└── tasks.md           # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── (admin)/contacts/
│   │   ├── page.tsx                 # EDIT (bulk): launcher (header+search+task buttons+counts);
│   │   │                            #   view state (none/search/review/duplicates), mutually exclusive;
│   │   │                            #   typing → single results + query-scoped pairs (retain 062);
│   │   │                            #   Add contact → create form in a modal (reuse 063 overlay);
│   │   │                            #   editor gains "Mark reviewed"; counts refresh after actions
│   │   └── contacts.module.css      # EDIT: task-button row styles (reuse .backdrop/.modalPanel)
│   └── api/
│       ├── contacts/route.ts        # EDIT: GET accepts ?needsReview=1 → needs-review list
│       ├── contacts/launcher-counts/route.ts   # ADD: GET → { needsReview, duplicates }
│       └── contacts/[id]/reviewed/route.ts     # ADD: POST → clear needs_review (contact.write)
└── server/domain/
    ├── contacts/contactService.ts   # EDIT: listNeedsReview + countNeedsReview; patchContact
    │                                #   auto-clears needs_review when the record has email/phone;
    │                                #   markReviewed(id) sets it false
    └── dedup/suggestionService.ts   # EDIT: countMergeSuggestions(db, threshold)

tests/
├── integration/
│   ├── contacts.needsReview.test.ts # ADD: filter + count + auto-clear-on-save + Mark reviewed
│   └── contacts.launcherCounts.test.ts # ADD: counts endpoint (needsReview + duplicates)
└── component/
    └── contacts.page.test.tsx       # EXTEND: launcher initial state, task-view switching,
                                     #   add-contact modal, mark-reviewed, count refresh
```

**Structure Decision**: Single Next.js web app. The launcher redesign lives in the existing
`(admin)/contacts/page.tsx`; the review-queue list rides the existing `/api/contacts` route via a
`?needsReview=1` param, the two counts come from one small `launcher-counts` endpoint (composing the
contacts + dedup count functions), and Mark-reviewed is a dedicated single-purpose action route. The
duplicates list reuses the existing `/api/dedup/suggestions` global path unchanged.

## Complexity Tracking

> No Constitution Check violations — this section intentionally left empty.
