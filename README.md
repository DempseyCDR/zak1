# zak1 — CDR Dance Club Management Platform

Build 1 of a multi-build exploration. This build implements **feature 001 — Contacts &
Membership** (see [specs/001-contacts-membership](specs/001-contacts-membership/spec.md)).

## Stack

TypeScript · Next.js (App Router) · PostgreSQL 16 (`pg_trgm`, `citext`) · Drizzle ORM · Zod ·
pino · Vitest. Single-tenant. Strict TypeScript and test-first against a real database per the
project [constitution](.specify/memory/constitution.md).

## Prerequisites

- Node.js LTS (22+/24)
- pnpm (`npm i -g pnpm`)
- PostgreSQL 16 running locally. With Homebrew:
  ```sh
  brew install postgresql@16 && brew services start postgresql@16
  createdb zak1_dev && createdb zak1_test
  ```

## Setup

```sh
pnpm install
cp .env.example .env        # adjust DATABASE_URL / TEST_DATABASE_URL if needed
pnpm db:migrate             # apply SQL migrations to DATABASE_URL
pnpm db:seed                # optional: ~1,300 contacts / ~152 members
```

> Note: scripts that read `.env` are run via Node's `--env-file`. If `pnpm <script>` errors on a
> dependency check, run `pnpm approve-builds` once (approve `esbuild`, `sharp`), or invoke directly:
> `node --env-file=.env --import tsx src/server/db/migrate.ts`.

## Run

```sh
pnpm dev                    # Next.js app at http://localhost:3000
```

- `/contacts` — directory: search, create, multi-purpose emails, consent topics, volunteer roles
- `/dedup` — duplicate review queue (admin-confirmed merges)
- `/events` — events management: create/list events + event groups (feature 002)
- `/checkin` — door check-in: event picker, open door record, fuzzy search, new-contact + unmatched (feature 002)
- `/gate` — gate-money entry: 7 categories × cash/card, cash reconciliation, deposit (POS fee hidden)
- `/performers` — performer directory + bio/photo (feature 003)
- `/bookings` — book performers onto an event (type rules, pay/override, per-event total)
- `/rate-parameters` — effective-dated standard caller/sound-tech pay rates
- `/treasurer/<eventId>` — printable per-event treasurer report (feature 004)
- `/qbo-mapping` — edit account/class mapping for the treasurer report
- `/organizer/<seriesKey>` — organizer report & analytics: per-dance Dance Net rows with performer drill-down, quarterly summary (YTD + last year), rolling trend charts (feature 005)
- `/expense-parameters` — effective-dated per-series rent & ongoing expenses used by the organizer report (feature 005)
- `/exports` — iContact CSV export: 7 mailing lists (per-list download, consent-gated) + a separate contact-tracing export scoped to one event, purge-aware event dropdown (feature 006)

## Tests

```sh
pnpm test                   # all (unit + integration, real Postgres on TEST_DATABASE_URL)
pnpm test:unit
pnpm test:integration
pnpm typecheck              # tsc --noEmit (strict)
pnpm lint
```

## Jobs

```sh
# daily membership-status refresh (idempotent); also schedulable via node-cron
node --env-file=.env --import tsx src/jobs/membership-refresh.ts

# daily attendance purge: roll >90-day attendance into quarterly counts, then delete (idempotent)
node --env-file=.env --import tsx src/jobs/attendance-purge.ts
```

## Layout

```
src/
  app/            # Next.js routes: (admin) UI + /api route handlers
  server/
    db/           # schema (Drizzle), SQL migrations, client, migrate runner, seed
    domain/       # contacts, membership, dedup services
    lib/          # logger, audit, api errors, request logging
    validation/   # Zod boundary schemas + env
  jobs/           # membership refresh (cron + CLI)
tests/            # unit + integration (real Postgres)
specs/            # SpecKit specs, plans, tasks
```
