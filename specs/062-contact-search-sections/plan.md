# Implementation Plan: Contact Maintenance Search — Two Sections + Focus

**Branch**: `062-contact-search-sections` | **Date**: 2026-09-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/062-contact-search-sections/spec.md`

## Summary

Add a **second results section** (potential duplicates) and **focus-to-search** to the feature-060
contacts maintenance surface. The single-contacts section is the existing search list (feature 061); the
duplicates section shows **candidate pairs** from the existing dedup engine — **hybrid**: query-scoped
while there's a query, the global queue when empty — each routing into the existing merge flow. Two small
reuse-based changes: extend `getMergeSuggestions` with an optional query filter (today global-only) and
its route with a `?q=`, then wire a two-section + autofocus UI on the contacts page. **No schema,
migration, or new merge logic.**

## Technical Context

**Language/Version**: TypeScript 5.7 (strict), React 19, Next.js 16.

**Primary Dependencies**: The existing dedup engine (`getMergeSuggestions` → likely-duplicate pairs via
`dedup_normalized` trigram; `/api/dedup/suggestions` GET `base`, `/api/dedup/merge` POST `dedup.write`),
the shared search (`searchContacts`, feature 061), and the 060 contacts surface / Record-Triage patterns.

**Storage**: PostgreSQL — **no schema or migration**. The query-scoped filter is an added `WHERE` clause
using the existing `contacts_name_trgm` / `contacts_dedup_trgm` indexes.

**Testing**: Vitest — real-Postgres integration (`getMergeSuggestions` query filter) + jsdom component
(the two-section layout + focus-to-search on the contacts page).

**Target Platform**: Mobile-first web (the `(admin)` contacts surface).

**Project Type**: Web application (single Next.js project).

**Performance Goals**: N/A beyond the existing suggestion query (self-join capped at `limit`, trigram-
indexed); the added ILIKE filter narrows, not widens, the scan.

**Constraints**: Search + routing only — no contact data change here (FR-009); the duplicates section is
review/merge via the **existing** `/api/dedup/merge` (gated `dedup.write`, which the mailing-list manager
holds); a viewer without that authority sees the section review-only / hidden.

**Scale/Scope**: One domain-function param (`getMergeSuggestions(q?)`), one route param (`?q=`), and the
contacts-page UI (two sections + focus). Direct reuse of the merge endpoint and 060 patterns.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Test-First (NON-NEGOTIABLE)** — PASS (planned). Write **first**: a real-Postgres test that
  `getMergeSuggestions(db, threshold, limit, q)` returns only pairs where a member matches `q`, and the
  global set when `q` is empty; a jsdom component test that the contacts page renders both sections and
  auto-focuses the search field. Watch fail, then implement.
- **II. Simplicity / YAGNI** — PASS. Extend one function with an optional filter; reuse the existing
  suggestions + merge endpoints and the 060 Triage pattern; no new merge UI logic, no schema, no
  pagination.
- **III. Type Safety** — PASS. `q?: string` on `getMergeSuggestions`; the `MergeSuggestion` type is
  unchanged and consumed as-is by the UI.
- **IV. Observability** — PASS (unchanged). Suggestions read is read-only; the merge it routes to already
  emits `contact.merge` via the existing flow. No new events.

**Result: PASS — no violations.**

## Project Structure

### Documentation (this feature)

```text
specs/062-contact-search-sections/
├── plan.md · research.md · data-model.md · quickstart.md
├── contracts/search-sections.md
└── tasks.md   # (/speckit-tasks — not created here)
```

### Source Code (repository root)

```text
src/server/domain/dedup/
└── suggestionService.ts     # ADD optional `q` to getMergeSuggestions: when set, keep only pairs where
                             #   a OR b matches q (name_normalized/dedup_normalized ILIKE); empty = global.

src/app/api/dedup/
└── suggestions/route.ts     # ADD `?q=` passthrough to getMergeSuggestions (GET stays `base`)

src/app/(admin)/contacts/
├── page.tsx                 # TWO sections: single contacts (existing TriageList) + potential-duplicate
│                            #   PAIRS from /api/dedup/suggestions?q=; each pair → merge via
│                            #   /api/dedup/merge. + focus-to-search (searchRef autofocus / refocus).
└── contacts.module.css      # styles for the duplicates section + pair rows

tests/
├── integration/dedup.suggestions.test.ts   # EXTEND/ADD: query-scoped filter + global-when-empty
└── component/contacts.page.test.tsx          # EXTEND: two sections render; search field auto-focused
```

**Structure Decision**: Single web-app project. The behavior change is one added query filter on the
dedup engine + its route; the UI grows the 060 contacts page into two sections and gains focus-to-search
(mirroring the check-in `searchRef` pattern). Candidate pairs reuse the existing `/api/dedup/merge`
(`dedup.write`) — no merge logic is duplicated.

## Complexity Tracking

> No Constitution violations — section intentionally empty.
