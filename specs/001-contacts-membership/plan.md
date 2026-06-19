# Implementation Plan: Contacts & Membership

**Branch**: `001-contacts-membership` | **Date**: 2026-06-18 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-contacts-membership/spec.md`

## Summary

Build the foundational people layer of the CDR platform: a Contact directory (~1,300 records) where
each Contact has one-to-many ContactEmails with independent type/status/consent flags, a materialized
membership status (current / lapsed / long_lapsed / never) kept accurate on every membership change
and at least daily, and an admin-confirmed fuzzy deduplication queue. Technical approach: a
TypeScript Next.js application backed by PostgreSQL, using `pg_trgm` for fuzzy name matching, Zod for
boundary validation, structured logging, and an append-only audit log for merges and status changes.
Single-tenant for this build (CDR only); tenant-scoped settings such as `long_lapse_cycles` remain
configurable.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js LTS (22.x), strict mode

**Primary Dependencies**: Next.js (App Router, React 19), Drizzle ORM, Zod, pino (logging), a job
runner for the daily refresh (node-cron in-process for build 1)

**Storage**: PostgreSQL 16 with `pg_trgm` and `uuid-ossp`/`pgcrypto` extensions

**Testing**: Vitest (unit) + integration tests against a real PostgreSQL instance (Testcontainers or
a disposable Docker Postgres); no mocking of the database, per constitution

**Target Platform**: Linux server (Node runtime); admin UI in a modern browser

**Project Type**: Web application (single Next.js project: server + React UI)

**Performance Goals**: Fuzzy name search returns a ranked pick list within 300 ms p95; everyday admin
list/detail operations under 1 s for the full directory

**Constraints**: Email uniqueness across active+transition records enforced at the database; merges
must be auditable; membership status freshness ≤ 1 business day

**Scale/Scope**: ~1,300 contacts, ~152 active members, single tenant (CDR); designed so multi-tenant
scoping can be added later without data-model rework

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Test-First (NON-NEGOTIABLE)**: PASS — Vitest with Red-Green-Refactor; integration tests run
  against real PostgreSQL (no DB mocking). Email-uniqueness, status classification, and merge
  re-linking each get failing tests before implementation.
- **II. Simplicity / YAGNI**: PASS — single-tenant, single Next.js project, no premature multi-tenant
  infrastructure; in-process cron for the daily job rather than external queue. No abstractions added
  before a third use site.
- **III. Type Safety**: PASS — `strict: true` and `noUncheckedIndexedAccess: true`; Zod schemas
  validate all external boundaries (API request bodies, CSV/iContact metadata, env) and convert to
  typed domain objects. No `any`/unchecked `as` except documented escape hatches.
- **IV. Observability**: PASS — pino structured JSON logs on all request/response cycles; append-only
  audit log for contact merges and membership-status changes (who/what/when); no `console.log` in
  production paths.

**Initial gate: PASS. No violations — Complexity Tracking left empty.**

## Project Structure

### Documentation (this feature)

```text
specs/001-contacts-membership/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (API + DB contracts)
└── tasks.md             # Phase 2 output (/speckit-tasks - NOT created here)
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── (admin)/contacts/        # Admin UI: list, detail, email management
│   ├── (admin)/dedup/           # Merge review queue UI
│   └── api/
│       ├── contacts/            # CRUD + email subresource route handlers
│       ├── memberships/         # membership create + status read
│       └── dedup/               # suggestions + confirm-merge
├── server/
│   ├── db/
│   │   ├── schema/              # Drizzle table definitions
│   │   └── migrations/
│   ├── domain/
│   │   ├── contacts/            # contact + email services
│   │   ├── membership/          # status classification + daily refresh job
│   │   └── dedup/               # fuzzy suggestions + merge re-linking
│   ├── lib/
│   │   ├── logger.ts            # pino structured logger
│   │   └── audit.ts             # append-only audit writer
│   └── validation/              # Zod schemas (boundary contracts)
└── jobs/
    └── membership-refresh.ts    # nightly status recompute

tests/
├── integration/                 # against real Postgres
└── unit/
```

**Structure Decision**: Single Next.js (App Router) project — the spec describes admin-facing UI plus
server logic with shared types, so one TypeScript project with `src/app` (UI + route handlers) and
`src/server` (domain/db) keeps front/back type contracts unified without a separate backend service.
Deferred features (002–007) will add sibling route groups and domain modules in the same project.

## Complexity Tracking

> No constitution violations — section intentionally empty.
