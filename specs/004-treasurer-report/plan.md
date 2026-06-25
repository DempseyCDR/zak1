# Implementation Plan: Treasurer Report & QBO Hand-off

**Branch**: `004-treasurer-report` | **Date**: 2026-06-24 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/004-treasurer-report/spec.md`

## Summary

Assemble a per-event, copy/paste-ready Treasurer Report with five sections — Gate Sales Summary,
Named-Customer Receipts, Performer Payments, Deposit, and Fees (informational) — from data already
captured by features 002 (door record, gate sales, POS fee, deposit) and 003 (bookings, performers,
pay). Each money line is mapped to an accounting account and class via a per-club configurable mapping;
the gate receipt is anonymous ("Contra Gate"/"English Gate") while memberships and advance tickets
become separate named-customer receipts. Revenue is reported at gross with fees shown only for
reconciliation. No accounting-system API in Phase 1 — the report is a read-model for manual entry.
Extends the existing TS/Next.js + Postgres app; money in integer cents; report generation and mapping
edits are audited.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js LTS (24.x), strict mode (existing project)

**Primary Dependencies**: Next.js (App Router), Drizzle ORM, Zod, pino; reuses features 002/003 data
and shared `money`/`logger`/`audit`/`withLogging`/`parseBody`

**Storage**: PostgreSQL 16. New config tables for account/class mapping (+ audit) and an optional
`check_number` on bookings. The report itself is computed, not persisted.

**Testing**: Vitest; integration tests against the real `zak1_test` database (no DB mocking)

**Target Platform**: Linux server (Node); treasurer-facing report UI (screen-first, laptop; printable)

**Project Type**: Web application (single Next.js project — extends existing `src/` layout)

**Performance Goals**: Report assembles in <1 s per event (small per-event data)

**Constraints**: Money exact (integer cents); revenue at gross; fees informational; gift cards →
liability; named-customer items never on the gate receipt; no accounting API (manual copy/paste)

**Scale/Scope**: One report per event; single tenant (CDR)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Test-First (NON-NEGOTIABLE)**: PASS — fee calculators (pure), account/class mapping resolution,
  and report-section assembly each get failing tests first; integration against real Postgres.
- **II. Simplicity / YAGNI**: PASS — report is a computed read-model (no report tables); reuses 002/003
  data and the door record's already-computed fee/deposit; online-fee calculator added now but applied
  only when online orders exist (feature 007).
- **III. Type Safety**: PASS — strict TS; Zod at boundaries; mapping keys as enums; integer cents.
- **IV. Observability**: PASS — audit entries for report generation and mapping edits (FR-014);
  structured logging on handlers.

**Initial gate: PASS. No violations — Complexity Tracking left empty.**

## Project Structure

### Documentation (this feature)

```text
specs/004-treasurer-report/
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
│   ├── (admin)/treasurer/[eventId]/   # printable per-event report view
│   ├── (admin)/qbo-mapping/           # edit account/class mapping
│   └── api/
│       ├── events/[id]/treasurer-report  # GET assembled report
│       ├── events/[id]/non-dance-income  # POST/GET per-event non-dance income
│       ├── qbo-mapping/                # GET/PUT account + class/customer mapping
│       └── bookings/[id]/check         # PATCH set check number (treasurer)
├── server/
│   ├── db/
│   │   ├── schema/                     # accountMapping, seriesQboMap, nonDanceIncome, mappingAudit; +bookings.check_number
│   │   └── migrations/                 # 0006_treasurer.sql
│   └── domain/
│       └── treasurer/                  # fee calculators, mapping resolver, report assembler
└── (reuses src/server/lib/money.ts, logger.ts, audit.ts)
```

**Structure Decision**: Continue the single Next.js project. The report is a pure assembly function
over existing rows; the only new persistence is configurable mapping (account per app category/kind,
class + gate-customer per series) plus a treasurer-entered `check_number` on bookings.

## Complexity Tracking

> No constitution violations — section intentionally empty.
