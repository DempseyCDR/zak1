# Implementation Plan: Contact First/Last Name, Overridable Display Name, and Pronouns

**Branch**: `012-contact-name-fields` | **Date**: 2026-07-08 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/012-contact-name-fields/spec.md`

## Summary

Give contacts structured names (Phase 2 item P2-3). Add a **required `first_name`**, an **optional
`last_name`** (dancers may decline one), an optional **`display_name_override`**, and optional free-text
**`pronouns`**. The existing `display_name` is **kept but repurposed as a maintained, materialized
effective display name** (= override, else trimmed `first + " " + last`), so every current reader —
reports, bookings, exports, check-in member buttons — is untouched. Per the clarification, **duplicate
detection re-keys onto the structured first+last** (override-immune) via a new `dedup_normalized` column,
while **search keeps matching the effective display name** (`name_normalized`, unchanged). The
mailing-list export stops splitting the display name and reads the real first/last columns. Check-in
gains sort-by-last-name. No production backfill (fresh load at go-live); the migration preserves existing
dev/seed rows.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 24 (Active LTS), strict mode; pnpm.

**Primary Dependencies**: Next.js (App Router, RSC), Drizzle ORM, Zod, pino, PostgreSQL `pg_trgm`.
Retrofits feature 001 (contacts model, `contactService`, dedup `suggestionService`, search), feature 002
(check-in roster + inline new-contact), feature 006 (mailing-list export). No new external dependency.

**Storage**: PostgreSQL 16. `contacts` gains `first_name` (NOT NULL), `last_name` (nullable),
`display_name_override` (nullable), `pronouns` (nullable), `dedup_normalized` (NOT NULL) + a `gin_trgm_ops`
index on it. `display_name` and `name_normalized` stay (now the materialized effective display name and
its search normalization). One migration `0017_contact_names.sql` (0016 is latest).

**Testing**: Vitest against real `zak1_test` (no mocking); pg_trgm dedup/search are DB-level and
integration-tested. The `makeContactWithEmail` factory and every test that creates a contact by
`displayName` are updated to first/last.

**Target Platform**: Linux/Node server. Admin surfaces: contacts create/edit (first/last/override/
pronouns), check-in roster (sort by last name).

**Performance Goals**: None beyond today; single-club scale. Dedup/search each keep one trigram GIN
index (`dedup_normalized`, `name_normalized`).

**Constraints**: `display_name` must remain the effective display name for all existing readers
(FR-008/FR-010 — no name-display regression). Migration must not change any existing row's display,
search, or dedup outcome (production is fresh; dev/seed preserved). `first_name` required; `last_name`
may be blank (FR-001).

**Scale/Scope**: Single tenant. ~5 new columns + 1 index, one derive-names helper, retrofits to
contact create/patch, dedup query, export queries, check-in roster + inline create, contacts UI, and
test/factory updates.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Test-First (NON-NEGOTIABLE)**: PASS — integration tests (real Postgres) cover the override-immune
  dedup (same first+last flagged despite a different override), blank-last behavior (display = first
  only; dedup on first alone), search-still-by-display, export first/last from columns, and check-in
  sort. Existing contact/dedup/search/export tests + the shared factory are updated to the structured
  model, not bypassed.
- **II. Simplicity / YAGNI**: PASS — keeping `display_name` as a maintained materialized value is the
  *simplest* retrofit (no change to the many readers) and mirrors how the codebase already stores a
  derived `name_normalized`. The split dedup/search keys are required by the clarified spec, not
  speculative. No org-contact type, no bulk-import mechanism, no self-service editing (all out of scope).
- **III. Type Safety**: PASS — `first_name` NOT NULL; `last_name` nullable in both schema and Zod;
  derived values computed in one typed helper; no undocumented `any`/`as`.
- **IV. Observability**: PASS — no logging/audit change; `contact.created`/updates keep their existing
  audit path.

**Initial gate: PASS. No violations — Complexity Tracking left empty.**

## Project Structure

### Documentation (this feature)

```text
specs/012-contact-name-fields/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── api-deltas.md
├── checklists/
│   └── requirements.md  # from /speckit-specify + /speckit-clarify
└── tasks.md             # /speckit-tasks (not created here)
```

### Source Code (repository root)

```text
src/
├── app/
│   └── (admin)/
│       ├── contacts/page.tsx             # create/edit: first/last/display-override/pronouns; show pronouns
│       └── checkin/page.tsx              # roster order-by last name (member buttons already use display_name)
├── server/
│   ├── db/
│   │   ├── schema/
│   │   │   └── contacts.ts               # + first_name (NOT NULL), last_name, display_name_override, pronouns, dedup_normalized
│   │   └── migrations/
│   │       └── 0017_contact_names.sql    # NEW — add columns, backfill dev rows, NOT NULL, dedup_normalized trgm GIN index
│   ├── domain/
│   │   ├── contacts/
│   │   │   ├── normalize.ts              # + deriveContactNames({firstName,lastName,displayNameOverride}) → {displayName,nameNormalized,dedupNormalized}
│   │   │   └── contactService.ts         # create/patch set derived cols; searchContacts unchanged (name_normalized)
│   │   ├── attendance/
│   │   │   └── attendanceService.ts      # inline new-contact create uses first_name; roster sortable by last,first
│   │   ├── dedup/
│   │   │   └── suggestionService.ts      # similarity on dedup_normalized (was name_normalized)
│   │   └── exports/
│   │       └── exportService.ts          # first/last from columns; delete splitDisplayName heuristic
│   └── validation/
│       ├── contacts.ts                   # contactCreate/Patch: firstName req, lastName/override/pronouns optional (was displayName)
│       └── attendance.ts                  # new-contact (door) input gains firstName (from the door entry)
└── tests/integration/                    # new name/dedup/search/export/sort tests; updated contact tests + factory
```

**Structure Decision**: Continue the single Next.js project. The pivotal choice is to **keep
`display_name` as a maintained, materialized effective display name** rather than dropping it and
computing everywhere — this leaves every reader (reports, bookings, exports, member buttons, search
results) unchanged and is strictly less churn. All three derived values (`display_name`,
`name_normalized`, `dedup_normalized`) are produced by one `deriveContactNames` helper called wherever a
contact's name is created or edited, so they never drift. Dedup and search each keep their own trigram
key/index — the only behavioral split the clarification introduced.

## Complexity Tracking

> No constitution violations — section intentionally empty.
