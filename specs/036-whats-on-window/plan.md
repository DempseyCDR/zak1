# Implementation Plan: What's On — Home Page Window

**Branch**: `036-whats-on-window` | **Date**: 2026-08-04 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/036-whats-on-window/spec.md`

## Summary

Widen the `/whats-on` home-page listing's lower date bound from **today** to **two calendar days ago**, so
visitors see the last two days plus everything upcoming, ascending. The order (ascending) and the public-safe
projection already match; only the default `from` bound moves. Realized by a single pure helper
`homeWindowStart(today)` (= `today − 2 days`) that `getPublicSchedule` uses as its default `from`. No new API,
no schema, no migration; public and read-only.

## Technical Context

**Language/Version**: TypeScript 5.7 (strictest flags)

**Primary Dependencies**: existing `src/server/domain/public/publicSchedule.ts` (Drizzle query over `events`);
Next.js 16 RSC page `src/app/(public)/whats-on/page.tsx`

**Storage**: reads the existing `events.event_date` (DATE) — **no** schema change, **no** migration

**Testing**: Vitest — a **unit** test for the pure `homeWindowStart` (node) + an **integration** test for the
window boundary against real Postgres (mirrors the existing `publicSchedule.test.ts`, which passes an explicit
`from`)

**Target Platform**: Web — public server-rendered page

**Project Type**: Web application (single Next.js App Router project)

**Performance Goals**: Negligible — same single query, only a wider lower bound

**Constraints**: Public, read-only; calendar-date comparison (UTC, matching the existing `today()`); the lookback
is a single named constant

**Scale/Scope**: One helper + one default change in `publicSchedule.ts`; optional empty-state wording tweak; two
tests

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Test-First (NON-NEGOTIABLE)** — PASS. `homeWindowStart` gets a unit test first (2-days-ago boundary +
  month/year rollover); the window behavior gets an integration test first (2-days-ago included, 3-days-ago
  excluded, future included, ascending) using an explicit `from`. Red → green.
- **II. Simplicity / YAGNI** — PASS. One constant + one pure function + a default-arg change. No configurability
  (fixed 2 days, per the Phase 6 decision), no new abstraction.
- **III. Type Safety** — PASS. `homeWindowStart(today: string): string`, pure and total. No new external
  boundary → no Zod.
- **IV. Observability** — PASS (N/A). No new request cycle, mutation, or external call.

**Result**: All gates pass. Complexity Tracking empty.

## Project Structure

### Documentation (this feature)

```text
specs/036-whats-on-window/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── public-schedule.md  # Phase 1 output — the (unchanged) public-schedule shape + new window rule
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks (NOT created here)
```

### Source Code (repository root)

```text
src/server/domain/public/
└── publicSchedule.ts          # EDIT — add HOME_WINDOW_LOOKBACK_DAYS + homeWindowStart(today); default
                               #        from = homeWindowStart(today()); update the doc comment
src/app/(public)/whats-on/
└── page.tsx                   # EDIT (optional) — reword the empty-state message now that recent dances show

tests/
├── unit/publicScheduleWindow.test.ts       # NEW — homeWindowStart boundary + rollover (written FIRST)
└── integration/publicSchedule.test.ts      # EDIT — add the window-boundary case (written FIRST)
```

**Structure Decision**: Single Next.js App Router project. The two-day lookback lives as a named constant +
pure helper in `publicSchedule.ts` (the one place the window is defined), keeping FR-003's "single, testable
value" literal. `getPublicSchedule` keeps its injectable `from` (so the integration test stays deterministic by
passing an explicit bound); only its **default** changes. The page and the detail path are otherwise untouched.

## Complexity Tracking

> No Constitution Check violations — table intentionally empty.
