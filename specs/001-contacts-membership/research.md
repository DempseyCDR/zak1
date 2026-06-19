# Phase 0 Research: Contacts & Membership

All Technical Context items were resolved during build-stack selection (TS/Next.js + Postgres,
single-tenant). This document records the key technical decisions and the alternatives weighed.

## Decision 1 — Fuzzy name matching

- **Decision**: PostgreSQL `pg_trgm` (trigram) with a GIN index on a normalized name column, ranked
  by `similarity()`, threshold-filtered, returning top-N candidates.
- **Rationale**: Meets the 300 ms p95 requirement at CDR's scale (~1,300 contacts) directly in the
  database with no extra service; supports both the door check-in lookup (feature 002) and the dedup
  suggestion queue. The spec mandates ranked results, not a specific algorithm — trigram satisfies it.
- **Alternatives considered**: Application-side Jaro-Winkler (more code, loses DB index acceleration);
  external search engine such as OpenSearch (operational overhead unjustified at this scale — YAGNI).

## Decision 2 — Materialized membership status

- **Decision**: Store `membership_status` as a column on Contact, recomputed (a) synchronously in the
  membership service whenever a Membership is created/changed, and (b) by a daily job that re-evaluates
  expiry vs. `long_lapse_cycles` for time-based transitions (current→lapsed→long_lapsed).
- **Rationale**: Reads are frequent (every export, list view, report); recomputing on read is wasteful
  and time-based transitions need a clock-driven sweep. Service-layer recompute keeps logic in one
  testable place rather than a DB trigger, aiding the constitution's type-safety and test-first goals.
- **Alternatives considered**: DB trigger + `pg_cron` (logic split across SQL, harder to unit-test);
  compute-on-read view (fails the "materialized field" expectation and adds per-query cost).

## Decision 3 — Email uniqueness enforcement

- **Decision**: Partial unique index on `lower(trim(email))` covering rows where status ∈
  {active, transition}; application validates and surfaces a friendly error before insert.
- **Rationale**: The spec requires global uniqueness across active+transition only (inactive may repeat
  historically). A DB-level partial unique index is the authoritative guard; app-side check gives UX.
- **Alternatives considered**: App-only uniqueness (race conditions, not authoritative).

## Decision 4 — Daily refresh runner

- **Decision**: In-process `node-cron` scheduled task (`src/jobs/membership-refresh.ts`) for build 1.
- **Rationale**: Single tenant, single deployment — an external queue/worker is premature (YAGNI).
  Job is idempotent so re-runs are safe.
- **Alternatives considered**: External scheduler (cron + CLI entrypoint) — viable later; deferred.

## Decision 5 — Merge re-linking strategy

- **Decision**: Transactional merge: choose canonical Contact, re-point all FK references
  (ContactEmail, Membership, future attendance/bookings) to it, soft-retire the non-canonical record,
  write an audit entry capturing both IDs and the actor.
- **Rationale**: Spec requires admin-confirmed, auditable, no-auto merges with all related records
  re-linked. Soft-retire (not hard delete) preserves the audit trail and reversibility-by-record.
- **Alternatives considered**: Hard delete of the non-canonical record (loses audit/reversibility).

## Decision 6 — Tenancy posture

- **Decision**: Single-tenant data model for build 1; club-level settings (`long_lapse_cycles`) live in
  a `club_settings` row so the value is configurable without code change.
- **Rationale**: Matches the chosen build approach; avoids multi-tenant complexity now while keeping
  the configurable-threshold requirement satisfiable.
- **Alternatives considered**: tenant_id columns now / schema-per-tenant (deferred — YAGNI).

**Output**: No NEEDS CLARIFICATION remain.
