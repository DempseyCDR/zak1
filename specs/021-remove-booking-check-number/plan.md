# Implementation Plan: Remove `bookings.check_number` — single home for check numbers

**Branch**: `021-remove-booking-check-number` (solo-maintainer mode, constitution v1.3.0 — one atomic commit
to `main`) | **Date**: 2026-07-28 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/021-remove-booking-check-number/spec.md`

## Summary

Remove the redundant `bookings.check_number` column so `performer_payments` is the **sole** store of a
performer-payment check number (correcting feature 019). The load-bearing discovery from reading the code:
the `deleteEvent` guardrail **already** blocks on a recorded performer payment (Blocker 3, added in 019), so
the booking-side check guard (Blocker 2) is **redundant** and can simply be deleted — no re-home needed. The
one real risk is data loss: the gate's `/check` route writes **only** `bookings.check_number` (never
`performer_payments`), and the 019 backfill only mirrored `pay_cents > 0` bookings, so **check numbers entered
via the gate after migration 0024 live solely on the booking**. Migration 0026 therefore does a **mandatory
reconciliation backfill** (mirror any residual `bookings.check_number` into `performer_payments`) *before*
dropping the column. Everything else is deletion: the column, the `/check` route + its Zod schema, Blocker 2,
the re-point "clear check number" step, and the gate's check-entry UI (its proper replacement on
`performer_payments` is the separate FS-payments feature — acceptable because the system is pre-rollout).

## Technical Context

**Language/Version**: TypeScript 5.7 (strictest) · Node 24 · pnpm

**Primary Dependencies**: Next.js 16.2.10 (App Router, RSC) · React 19.2 · Drizzle · Zod. **No new runtime
dependency.**

**Storage**: PostgreSQL 16. One additive migration **`0026_drop_bookings_check_number.sql`**: (1) an
idempotent **reconciliation backfill** — for any `bookings` row with `check_number IS NOT NULL` not already
represented in `performer_payments` (via `payment_bookings`), create the mirror payment; (2)
`ALTER TABLE bookings DROP COLUMN check_number`.

**Testing**: Vitest against **real Postgres** (node env). This feature is **backend/data only** — no jsdom
component tests. New/changed tests: check-number history preservation across the migration path, the
delete-guardrail now blocking via `performer_payments`, re-point no longer touching a check field, and the
bookings payload/type carrying no check number.

**Target Platform**: Web, single tenant, staff admin + door surfaces.

**Project Type**: Next.js App Router monolith; domain under `src/server/`, UI under `src/app/`.

**Performance Goals**: Admin-scale; the backfill is a one-time bounded loop over paid bookings — trivial.

**Constraints**: Money is integer cents. **No check-number history may be lost** (FR-003). The treasurer report
MUST be unaffected (already reads `performer_payments`). Public/confirmed-only display unchanged. Existing
suite stays green.

**Scale/Scope**: 1 migration; 1 column removed; ~7 code files touched (mostly deletions); a handful of test
edits.

## Constitution Check

*GATE: Must pass before Phase 0. Re-check after Phase 1.* Constitution v1.3.0 (principles I–IV).

| Principle | Verdict |
|---|---|
| **I. Test-First** | **PASS (one documented exception)** — the behavior-changing *logic* goes test-first against real Postgres: (b) `deleteEvent` still refuses an event with a recorded performer payment (Blocker 3) and no longer needs Blocker 2; (c) re-point resets status/performer with no check field involved. The one-time reconciliation **backfill (FR-003) is verified manually**, not by an automated test — post-migration the column is gone from the test schema, so a residual `bookings.check_number` cannot be seeded in Vitest. It is validated by quickstart + a `zak1_dev` before/after count assertion + the pre-migration snapshot, the same accepted treatment as the 0024/0025 backfills. No mocks. |
| **II. YAGNI** | **PASS** — almost entirely deletion. The only added logic is the minimal reconciliation backfill required for losslessness. The gate check-entry replacement is explicitly deferred to the FS-payments feature, not speculatively built here. |
| **III. Type Safety** | **PASS** — removing the column tightens `BookingRow` (no `checkNumber`); the `checkNumberPatchSchema` Zod boundary is deleted with its route. No `any`. TypeScript surfaces every stale reference at compile time. |
| **IV. Observability** | **PASS** — no new unlogged mutation. `deleteEvent`'s `writeAudit` is unchanged; the migration is a one-time DDL/data op recorded as a migration. |

**Development Workflow**: solo-maintainer mode (v1.3.0) — one atomic commit to `main`, full local gate suite
(tsc, eslint, prettier, tests, build) as the reviewer. Complies.

### Post-Design Re-Check

Re-evaluated after Phase 1: **still PASS.** No new table, no new abstraction, no escape hatch, no unlogged
write. The one data operation (reconciliation backfill) is a documented, idempotent migration step with a
conflict guard (research R1).

## Project Structure

### Documentation (this feature)

```text
specs/021-remove-booking-check-number/
├── plan.md              # This file
├── research.md          # R1..R6 (decisions)
├── data-model.md        # bookings (− check_number), performer_payments (unchanged), migration 0026
├── quickstart.md        # per-story validation
├── contracts/
│   └── removed-check-endpoint.md   # the deleted PATCH /api/bookings/[id]/check + payload change
├── checklists/requirements.md      # complete (from /speckit-specify)
└── tasks.md             # /speckit-tasks (NOT created here)
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── api/bookings/[id]/check/route.ts   REMOVE the route (writes bookings.check_number)
│   └── (door)/gate/page.tsx               REMOVE the check-number input/prefill + the /check PATCH call
├── server/
│   ├── db/
│   │   ├── schema/bookings.ts             REMOVE check_number column (KEEP requires_check)
│   │   └── migrations/0026_drop_bookings_check_number.sql   reconciliation backfill + DROP COLUMN
│   ├── domain/
│   │   ├── events/eventService.ts         REMOVE Blocker 2 (isNotNull(bookings.checkNumber)); Blocker 3 stays
│   │   └── bookings/bookingService.ts     REMOVE `checkNumber: null` from the re-point branch
│   └── validation/treasurer.ts            REMOVE checkNumberPatchSchema + CheckNumberPatchInput
└── tests/                                  see research R6 for the per-file test changes
```

**Structure Decision**: No structural change — established Next.js App Router monolith. Work is a bounded
deletion across existing files plus one additive migration. The route-index inventory is **generated from the
source tree** (`src/server/lib/routeInventory.ts`), so removing the `/check` route updates
`auth.routeInventory.test.ts` automatically — nothing to hand-maintain (per CLAUDE.md).

## Complexity Tracking

> No entries. No constitution deviation; no new architectural pattern. The feature reduces surface area.
