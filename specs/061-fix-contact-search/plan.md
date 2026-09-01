# Implementation Plan: Fix Contact Search (searchContacts)

**Branch**: `061-fix-contact-search` | **Date**: 2026-09-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/061-fix-contact-search/spec.md`

## Summary

Rewrite the matching in `searchContacts` so it behaves the way people type: **substring/prefix-primary,
monotonic**, matching across a contact's `name_normalized` ∪ `dedup_normalized` ∪ their (active) email —
so "cat" finds "Catherine", real first/last finds a contact whose display name is overridden, and an
email finds its owner. Keep **trigram similarity only as a thin-results "did you mean" fallback**, ranked
below exact matches. Return `{ items, truncated }` (query `limit + 1`) so surfaces can show honest
truncation. **No schema/migration** — the GIN trigram indexes (`contacts_name_trgm`,
`contacts_dedup_trgm`) accelerate `ILIKE`, and email prefix uses the existing `lower(trim(email))`
functional index. Preserve the existing **300ms p95 @ ~1,300 contacts** target.

## Technical Context

**Language/Version**: TypeScript 5.7 (strict), Node 24.

**Primary Dependencies**: Drizzle ORM + PostgreSQL 16 with `pg_trgm`. The change is confined to one
domain function (`src/server/domain/contacts/contactService.ts › searchContacts`) and its two API
callers.

**Storage**: PostgreSQL — **no schema or migration**. Uses existing indexes: `contacts_name_trgm` /
`contacts_dedup_trgm` (GIN trigram → accelerate `ILIKE '%…%'`), and `contact_emails` functional unique on
`lower(trim(email))` (btree → email **prefix**).

**Testing**: Vitest **real-Postgres integration** — `tests/integration/contacts.search.test.ts` (extend +
update), `tests/integration/door.checkin-search.test.ts`, plus the existing perf test.

**Target Platform**: Linux server.

**Project Type**: Web application (single Next.js project; server-side domain function + 2 routes).

**Performance Goals**: **300ms p95 at ~1,300 contacts** (the existing test asserts this — must still hold).

**Constraints**: Read-only (no data/authorization change, FR-006); each surface keeps its permissions and
displayed fields (the door stays PII-gated); monotonic narrowing on the **primary** matcher (FR-002).

**Scale/Scope**: One domain function rewrite + 2 route updates (return-shape) + a truncation indicator on
the door and contacts surfaces. Direct server callers of `searchContacts`: `/api/attendance/search` and
`/api/contacts` (the payments/BookingModal "searchContacts" are local client fns hitting `/api/contacts`).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Test-First (NON-NEGOTIABLE)** — PASS (planned). Extend `contacts.search.test.ts` **first** with the
  failing cases: "cat" → Catherine (fails today), the `cath`→`cathe`→`cather` subset/monotonic sequence,
  find-by-email, find-by-real-first/last-with-override, and the `truncated` flag. Update the existing
  trigram-behavior assertions to the new expectations. Watch fail, then implement.
- **II. Simplicity / YAGNI** — PASS. Substring + a thin-results fuzzy fallback + email **prefix** (no new
  email trigram index); `{ items, truncated }` via `limit + 1` (no pagination engine). One function, two
  routes, two small UI indicators.
- **III. Type Safety** — PASS. The return type changes to `{ items: ContactSummary[]; truncated: boolean }`
  — typed, and the two routes are updated to match. `q`/`limit` are existing typed params (no new Zod
  boundary).
- **IV. Observability** — PASS (unchanged). Search is read-only; the door route's `recordPiiDisclosure`
  over the results is preserved (it maps over `items`). No new audit events.

**Result: PASS — no violations.**

## Project Structure

### Documentation (this feature)

```text
specs/061-fix-contact-search/
├── plan.md · research.md · data-model.md · quickstart.md
├── contracts/search-behavior.md
└── tasks.md   # (/speckit-tasks — not created here)
```

### Source Code (repository root)

```text
src/server/domain/contacts/
└── contactService.ts        # REWRITE searchContacts: substring-primary (name∪dedup∪email-prefix),
                             #   monotonic, thin-results trigram fallback; return { items, truncated }

src/app/api/
├── contacts/route.ts        # UPDATE: GET returns { items, truncated } (was { items, total })
└── attendance/search/route.ts  # UPDATE: include `truncated`; keep PII gating + recordPiiDisclosure

src/app/(door)/checkin/           # UPDATE: show a truncation indicator ("more matches — refine")
src/app/(admin)/contacts/         # UPDATE: show the truncation indicator on the TriageList (feature 060)

tests/integration/
├── contacts.search.test.ts       # EXTEND/UPDATE: cat/monotonic/email/override/truncated (+ keep perf)
└── door.checkin-search.test.ts    # EXTEND: search improvements reflected at the door
```

**Structure Decision**: Single web-app project. The behavior change lives in one domain function; the two
API routes adapt to the new return shape; two surfaces gain a truncation indicator. The client typeahead
pickers (payments, BookingModal) read `.items` and are unaffected (they may read `.truncated` later).

## Complexity Tracking

> No Constitution violations — section intentionally empty.
