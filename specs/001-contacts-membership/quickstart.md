# Quickstart & Validation: Contacts & Membership

End-to-end validation guide proving the feature works. Implementation details live in `tasks.md`.

## Prerequisites

- Node.js LTS (22.x), pnpm (or npm)
- Docker (for a disposable PostgreSQL 16 with `pg_trgm` + `pgcrypto`)

## Setup

```bash
pnpm install
docker run -d --name zak1-pg -e POSTGRES_PASSWORD=dev -p 5432:5432 postgres:16
# enable extensions + run migrations
pnpm db:migrate
pnpm db:seed   # loads a small contact/member fixture
```

Environment (`.env`, validated by Zod at startup): `DATABASE_URL`, `LOG_LEVEL`.

## Run

```bash
pnpm dev        # Next.js app at http://localhost:3000
```

## Validation scenarios

Map to acceptance scenarios in [spec.md](spec.md); contracts in [contracts/api.md](contracts/api.md).

1. **Create contact + email** (US1): `POST /api/contacts` → 201; re-POST same email → 409
   `EMAIL_DUPLICATE`. Confirms FR-001/002/003.
2. **Multiple emails** (US1): `POST /api/contacts/:id/emails` with type `booking` → both emails on the
   same contact; `provider_*` write rejected → 422 `READ_ONLY_FIELD`. Confirms FR-002/006.
3. **Membership status** (US2): `POST /api/memberships` (future expiry) → status `current`. Seed an
   expired membership and run `pnpm job:membership-refresh` → status `lapsed`, then `long_lapsed` past
   `long_lapse_cycles`. A contact with none → `never`, `listMember=false`. Confirms FR-007/008/009.
4. **Daily freshness** (US2): the refresh job is idempotent — running twice yields no extra
   `StatusChangeAudit` rows. Confirms SC-002.
5. **Dedup** (US3): seed two similar names → appear in `GET /api/dedup/suggestions`; `POST
   /api/dedup/merge` → related records re-linked, merged contact soft-retired, `MergeAudit` written;
   re-merge → 409 `ALREADY_MERGED`. No suggestion auto-merges. Confirms FR-010/011/012.
6. **Fuzzy perf** (US1, SC): with the seed scaled to ~1,300 contacts, `GET /api/contacts?q=...` returns
   ranked results with p95 ≤ 300 ms. Confirms the performance constraint.
7. **Audit** (FR-013): every merge and status change produces an audit row with actor/when.

## Test commands

```bash
pnpm test:unit          # Vitest unit
pnpm test:integration   # runs against the Docker Postgres (no DB mocking)
```

Expected: all green; integration suite covers uniqueness, status classification, daily-job idempotency,
and merge re-linking before the corresponding implementation (test-first).
