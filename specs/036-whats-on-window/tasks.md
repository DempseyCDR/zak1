---

description: "Task list for feature 036 — What's On home-page window"
---

# Tasks: What's On — Home Page Window

**Input**: Design documents from `specs/036-whats-on-window/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/public-schedule.md, quickstart.md

**Tests**: INCLUDED — the constitution (I. Test-First) is non-negotiable. The pure helper and the window
boundary both get tests written first.

**Organization**: One user story (US1, P1). Placement of the two-day lookback as a named constant + pure helper
keeps FR-003's "single, testable value" literal.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1 — the spec's single user story
- Every task names an exact file path

## Path Conventions

Single Next.js App Router project — `src/server/**`, `src/app/**`, `tests/**` at repo root (per plan.md).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm tooling — no install.

- [ ] T001 Confirm the node unit-test env and the real-Postgres integration env are available (see
  `tests/integration/publicSchedule.test.ts`, which seeds events and passes an explicit `from`). No dependency
  install required.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: None — this feature has no cross-story prerequisite (single story). Proceed to US1.

---

## Phase 3: User Story 1 - Visitor sees recent plus upcoming dances (Priority: P1) 🎯 MVP

**Goal**: `/whats-on` lists dances from two calendar days ago through the future, ascending — recent-past first,
then upcoming; nothing older than two days.

**Independent Test**: With events seeded around a fixed reference date, `getPublicSchedule(db,
homeWindowStart(ref))` includes ref−2 and ref−1 and future events, excludes ref−3, in ascending order; and
`homeWindowStart` returns the correct two-days-earlier date.

### Tests for User Story 1 (write FIRST — must FAIL before T004/T005)

- [ ] T002 [P] [US1] Create `tests/unit/publicScheduleWindow.test.ts` (node) for the pure helper `homeWindowStart`:
  `"2026-08-04" → "2026-08-02"`, month rollover `"2026-03-01" → "2026-02-27"`, year rollover
  `"2026-01-01" → "2025-12-30"`; and that the default lookback is 2. Confirm it FAILS (helper missing).
- [ ] T003 [P] [US1] Add a window-boundary case to `tests/integration/publicSchedule.test.ts`: seed events at
  `ref−1`, `ref−2`, `ref−3`, and a future date; call `getPublicSchedule(db, homeWindowStart(ref))`; assert
  `ref−2` and `ref−1` and the future event are returned, `ref−3` is not, ordered ascending by date. Confirm it
  FAILS (helper missing).

### Implementation for User Story 1

- [ ] T004 [US1] In `src/server/domain/public/publicSchedule.ts`, add `export const HOME_WINDOW_LOOKBACK_DAYS =
  2` and `export function homeWindowStart(today: string, lookbackDays = HOME_WINDOW_LOOKBACK_DAYS): string` —
  UTC calendar math (`new Date(`${today}T00:00:00Z`)`, `setUTCDate(-lookbackDays)`, `toISOString().slice(0,10)`).
  Makes T002 pass.
- [ ] T005 [US1] In `src/server/domain/public/publicSchedule.ts`, change `getPublicSchedule`'s default from
  `from: string = today()` to `from: string = homeWindowStart(today())`, and update the doc comment (it now
  defaults to two days ago, not today; FR-001/FR-004). Makes T003 pass. The `/whats-on` page inherits the new
  default — no page change needed.

**Checkpoint**: `/whats-on` shows recent + upcoming, ascending; MVP complete.

---

## Phase 4: Polish & Cross-Cutting Concerns

- [ ] T006 [P] (Optional) Reword the empty-state message in `src/app/(public)/whats-on/page.tsx` from
  "No upcoming dances scheduled" to fit recent + upcoming (e.g. "No dances to show"). Cosmetic only.
- [ ] T007 Run the full local gate: `pnpm exec tsc --noEmit && pnpm run lint && pnpm exec vitest run` — all
  green (scope prettier/lint to changed files if run separately).
- [ ] T008 Manual quickstart validation (`specs/036-whats-on-window/quickstart.md`) via the dev server / browser:
  `/whats-on` starts with the most recent past dance (within two days), then upcoming ascending; nothing older
  than two days; screenshot the result.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies.
- **Foundational (Phase 2)**: none.
- **US1 (Phase 3)**: after Setup. The whole feature.
- **Polish (Phase 4)**: after US1.

### Within User Story 1

- T002 and T003 (tests) are written and made to FAIL before T004/T005.
- T004 (`homeWindowStart`) before T005 (default uses it); both are in the same file, so sequential.

### Parallel Opportunities

- **T002** and **T003** are different test files → can be drafted in parallel (both RED until T004/T005).
- **T006** (page copy) is an independent file → **[P]** relative to the T007 gate.
- T004/T005 touch the same file (`publicSchedule.ts`) → sequential.

---

## Parallel Example

```bash
# The two failing tests can be written together:
Task: "T002 unit test tests/unit/publicScheduleWindow.test.ts"
Task: "T003 window-boundary case in tests/integration/publicSchedule.test.ts"
```

---

## Implementation Strategy

### MVP (User Story 1 — the whole feature)

1. Setup (T001).
2. US1: T002 + T003 (RED) → T004 (`homeWindowStart`) → T005 (default). GREEN.
3. **STOP and VALIDATE**: `/whats-on` shows recent + upcoming.
4. Polish: optional copy tweak, gate, browser check.

---

## Notes

- No database, migration, API route, or page-logic change — only the default lower date bound moves, expressed
  as one named constant + pure helper. The dance detail page is untouched.
- The trivial glue `default = homeWindowStart(today())` is not unit-tested against the real clock (consistent
  with the pre-existing untested `today()` default); the helper and the query window are each tested directly.
- Ships as one atomic commit per repo convention.
