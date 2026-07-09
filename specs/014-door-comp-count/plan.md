# Implementation Plan: Door Comp Count Feeding Paying Dancers

**Branch**: `014-door-comp-count` | **Date**: 2026-07-08 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/014-door-comp-count/spec.md`

## Summary

Add a single **`comp_count`** column to `door_records` (people admitted free — "your next dance free"
redemptions and performers' guests, one combined count), capture it in the existing door-record PATCH
API and the gate-money entry UI as a field **distinct** from `gift_card_redemption_count`, and fold it
into the organizer report's paying-dancer derivation:
`paying_dancers = attendance − distinct performers − 1 (door attendant) − comps`, floored at 0. Avg
Ticket (admission ÷ paying dancers) follows automatically. Gift-card redeemers stay counted as paying —
`gift_card_redemption_count` is untouched. Additive retrofit of feature 002 (door record + gate entry)
and feature 005 (organizer report). Supersedes BACKLOG B14.

## Technical Context

**Language/Version**: TypeScript 5.x, Node 24 (Active LTS)

**Primary Dependencies**: Next.js 15 (App Router, RSC), Drizzle ORM, Zod, pino; Vitest for tests; pnpm

**Storage**: PostgreSQL 16 (hand-authored SQL migrations via `pnpm run db:migrate`); money as integer cents

**Testing**: Vitest against a **real** `zak1_test` Postgres (no mocking); auto-migrated by `ensureSchema`, `resetDb` TRUNCATEs

**Target Platform**: Single-tenant web app (local Homebrew Postgres in dev)

**Project Type**: Web application (Next.js full-stack; server domain modules under `src/server`)

**Performance Goals**: N/A — one additive integer column and one subtraction in an existing per-event loop; no new query (reuses the door record already loaded by `computeEventGate`)

**Constraints**: `comp_count` is display-derivation only — it must not affect admission revenue, gate money, deposit, or attendance counts. Paying dancers floored at 0. No regression when comps = 0.

**Scale/Scope**: Single dance club; a handful of door operators; ~1 door record per event

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Test-First (NON-NEGOTIABLE)** — PASS (planned). A failing unit test for `payingDancers` with comps
  (subtract, floor at 0, default-0 no-op) and a failing integration test (record `comp_count` via the
  door PATCH → organizer report shows fewer paying dancers + higher Avg Ticket; gift-card redemption
  does not reduce; comps=0 no regression) are written before implementation.
- **II. Simplicity / YAGNI** — PASS. One integer column, one added (defaulted) parameter to an existing
  pure function, one new field on the existing `EventGate` read model, one UI input. No new endpoint, no
  new table, no split of comps by kind (single count per settled requirement).
- **III. Type Safety** — PASS. Column typed via Drizzle; PATCH input validated by Zod
  (`z.number().int().min(0)`) before reaching the domain; no `any`/`as`.
- **IV. Observability** — PASS. Comp edits flow through the existing `updateDoorRecord` path, which
  already writes a `door_record.updated` audit row + structured `writeAudit` log; no new production path.

**Result**: PASS — no violations, Complexity Tracking not required.

## Project Structure

### Documentation (this feature)

```text
specs/014-door-comp-count/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── door-record-patch.md   # Phase 1 output (extended PATCH contract)
├── checklists/
│   └── requirements.md  # from /speckit-specify
└── tasks.md             # /speckit-tasks (NOT created here)
```

### Source Code (repository root)

```text
src/server/
├── db/
│   ├── migrations/0019_door_comp_count.sql        # NEW — add comp_count column
│   └── schema/door.ts                             # + compCount column
├── validation/door.ts                             # doorRecordPatchSchema + compCount
├── domain/
│   ├── door/doorRecordService.ts                  # thread compCount through update + view
│   ├── gate/eventMoney.ts                         # EventGate gains compCount (from door row)
│   └── organizer/
│       ├── danceResult.ts                         # payingDancers(..., compCount = 0)
│       └── reportService.ts                       # pass gate.compCount to payingDancers
└── db/seed.ts                                      # give a sample event a comp_count (demo data)

src/app/(door)/gate/page.tsx                        # comp-count input in reconciliation section

tests/
├── unit/organizer.metrics.test.ts                 # extend: comps subtract / floor / default-0
└── integration/doorCompCount.test.ts              # NEW — report reflects comps end-to-end
```

**Structure Decision**: Existing single Next.js app with a server-side domain layer under `src/server`.
This feature is a pure additive retrofit — it introduces no new directories, routes, or endpoints. The
door-record PATCH endpoint (`/api/door-records/[id]`) and its `doorRecordPatchSchema` are extended in
place; the organizer report consumes the new count through the `EventGate` read model that
`computeEventGate` already produces (the door record is already loaded there, so no extra query).

## Complexity Tracking

> No entries — Constitution Check passed with no violations.
