# Implementation Plan: Organizer Report & Analytics

**Branch**: `005-organizer-report` | **Date**: 2026-07-01 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/005-organizer-report/spec.md`

## Summary

A read/analytics feature: per-series Organizer Reports (TNC incl. Community Dance; ECD separate) with
per-dance rows culminating in **Dance Net = admission + merchandise − rent − performer total − ongoing
expense − misc expenses**, quarterly summaries (Q1–Q4 + YTD + Last Year), and rolling trend charts
(shown for 12–53 weeks of data). Inputs come from features 002 (door records, gate sales, persisted
per-event attendance count), 003 (bookings/performers), plus two new per-series effective-dated
expense parameters (rent, ongoing) and per-event ad-hoc misc expenses. Paying dancers is derived
(`attendance − distinct performers − 1`). The report is a computed read-model (no report tables);
money is integer cents. Extends the existing TS/Next.js + Postgres app and reuses the admission/gate
computation from feature 004.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js LTS (24.x), strict mode (existing project)

**Primary Dependencies**: Next.js (App Router), Drizzle ORM, Zod, pino; reuses 002/003/004 data and
shared `money`/`logger`/`audit`/`withLogging`/`parseBody`. Charts rendered client-side (lightweight —
hand-rolled SVG or a small chart lib; implementation choice per spec)

**Storage**: PostgreSQL 16. New: `series_expense_parameters` (rent + ongoing, effective-dated),
`misc_expenses` (per event), and a persisted `attendance_count` on `events` (survives the 90-day purge).

**Testing**: Vitest; pure functions (Dance Net, paying dancers, quarterly aggregation, rolling window)
as unit tests; report assembly as integration tests against real `zak1_test` (no DB mocking)

**Target Platform**: Linux server (Node); organizer-facing report UI (tables + charts)

**Performance Goals**: Rolling trend charts (≤53-week window) render for a full-year series in <2 s (SC-003)

**Constraints**: Money exact (integer cents); Dance Net per FR-003; Avg Ticket = Gross Gate ÷ paying
dancers (no fee subtraction); charts only for 12 ≤ weeks ≤ 53; report is read-only (no persisted results)

**Scale/Scope**: ~1–2 series, weekly/bi-weekly events, ≤~60 events/year per series; single tenant

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Test-First (NON-NEGOTIABLE)**: PASS — Dance Net, paying-dancers, Avg Ticket, quarterly
  aggregation, and rolling-window selection are pure functions with unit tests first; report assembly
  integration-tested against real Postgres.
- **II. Simplicity / YAGNI**: PASS — report is a computed read-model (no result tables); rent + ongoing
  share one effective-dated parameter table; charts kept lightweight. Persisted per-event count is a
  single integer counter, not a snapshot table.
- **III. Type Safety**: PASS — strict TS; Zod at boundaries; integer cents; no undocumented `any`/`as`.
- **IV. Observability**: PASS — structured logging on report/parameter/expense handlers; audit on
  expense-parameter changes (mirrors 003 rate-parameter audit).

**Initial gate: PASS. No violations — Complexity Tracking left empty.**

## Project Structure

### Documentation (this feature)

```text
specs/005-organizer-report/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
└── tasks.md   # /speckit-tasks (not created here)
```

### Source Code (repository root) — additions to the existing project

```text
src/
├── app/
│   ├── (admin)/organizer/[seriesKey]/   # organizer report: rows + quarterly + charts
│   ├── (admin)/expense-parameters/      # edit rent/ongoing per-series effective-dated rates
│   └── api/
│       ├── organizer/[seriesKey]/report # GET assembled report (rows, quarterly, trends)
│       ├── expense-parameters/          # POST/GET rent + ongoing parameters
│       └── events/[id]/misc-expenses/   # POST/GET per-event ad-hoc misc expenses
├── server/
│   ├── db/
│   │   ├── schema/                      # seriesExpenseParameters, miscExpenses; +events.attendance_count
│   │   └── migrations/                  # 0009_organizer.sql
│   └── domain/
│       ├── gate/eventMoney.ts           # shared admission/merchandise/gate breakdown (extracted from 004)
│       └── organizer/                   # danceNet calc, paying-dancers, quarterly, rolling-window, report assembler
└── (reuses money.ts, logger.ts, audit.ts, bookings performer total)
```

**Structure Decision**: Continue the single Next.js project. Extract the admission/gate-breakdown
computation currently inside feature 004's `reportService` into `domain/gate/eventMoney.ts` so both the
treasurer report (004) and the organizer report (005) share one source of truth for admission and
category totals. The organizer report itself is a pure assembler over events + door records + bookings −
the new expense parameters/misc expenses + the persisted attendance count.

## Complexity Tracking

> No constitution violations — section intentionally empty.
