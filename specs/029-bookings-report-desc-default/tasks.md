---
description: "Task list for feature 029 — bookings report defaults to descending date (P5-R2)"
---

# Tasks: Bookings report defaults to descending date (P5-R2)

**Input**: Design documents from `specs/029-bookings-report-desc-default/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/
**Tests**: INCLUDED — the constitution (v1.3.0, Principle I) mandates test-first.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: parallelizable (different files, no dependency on an incomplete task)
- **[Story]**: US1 (the only story — from spec.md)
- Exact file paths included.

## Notes

A **default-direction flip only**: the bookings report defaults from ascending (020 US1) to **descending**
(newest-relevant-first), matching the shared event selector (025/028). **No schema, no migration, no
data-model change, no new API shape.** The change lives in three already-branching spots kept consistent — the
page's initial sort state, the service default, and the route's absent-`sort` default. Encoded **test-first**:
two existing ascending-default assertions move to the new descending expectation (Red), then the three
defaults flip (Green). Ships as **one atomic commit** once the gate is green.

⚠️ The two tests are the Red step and MUST be updated **before** the three source flips. Test files are
distinct from source files, so the two test edits are parallel to each other, and the three source edits are
parallel to each other — but all three source edits come **after** both tests.

---

## Phase 1: Setup

- [X] T001 Confirm **no infra/schema/migration** and note the exact change sites: page initial state `src/app/(admin)/bookings-report/page.tsx:106` (`useState<"asc" | "desc">("asc")`), service default `src/server/domain/bookings/reportService.ts` (`.orderBy(filters.sort === "desc" ? desc : asc)` + the `sort?: … default asc` field comment), route default `src/app/api/bookings/report/route.ts` (`sort: p.get("sort") === "desc" ? "desc" : "asc"`); and the two tests that encode the old default (`tests/integration/bookingsReport.booker.test.ts`, `tests/component/bookingsReport.test.tsx`).

---

## Phase 2: User Story 1 — Newest events first by default (P1) 🥇 MVP

**Goal**: The bookings report defaults to descending event-date order (newest first) with no interaction; the
toggle still switches both ways; nothing else changes.

**Independent Test**: Open the report with no interaction → the first row is the newest-relevant event and
rows descend by date; toggling once flips to ascending, again returns to descending.

### Tests first (Red)

- [X] T002 [P] [US1] Update `tests/integration/bookingsReport.booker.test.ts` "sorts by date asc (default) and desc": change the no-arg `assembleBookingsReport(db, {})` assertion to expect **descending** order (`["2026-06-18", "2026-06-04"]`), and add an explicit `assembleBookingsReport(db, { sort: "asc" })` assertion for the ascending order. (FR-002; fails against today's ascending default.)
- [X] T003 [P] [US1] Update `tests/component/bookingsReport.test.tsx` (the sort test): assert the **initial** report request carries `sort=desc` (no interaction), then that one sort-toggle click re-requests `sort=asc`, and a second click re-requests `sort=desc`. Remove the old "toggle re-requests desc" expectation. (FR-001 + FR-003; fails against today's ascending default.)

### Implementation (Green)

- [X] T004 [P] [US1] In `src/server/domain/bookings/reportService.ts`, flip the default order branch to descending: `.orderBy(filters.sort === "asc" ? asc(events.eventDate) : desc(events.eventDate))`; update the `sort?: "asc" | "desc"; // … (default asc)` field comment to `default desc` (feature 029).
- [X] T005 [P] [US1] In `src/app/api/bookings/report/route.ts`, default an absent/unrecognized `sort` param to descending: `sort: p.get("sort") === "asc" ? "asc" : "desc"` (feature 029; was `=== "desc" ? "desc" : "asc"`).
- [X] T006 [P] [US1] In `src/app/(admin)/bookings-report/page.tsx:106`, change the initial sort state `useState<"asc" | "desc">("asc")` → `useState<"asc" | "desc">("desc")` (feature 029). Leave the toggle button and everything else untouched.

**Checkpoint**: T002/T003 pass; the report lands descending and the toggle still reaches both orderings.

---

## Phase 3: Polish + cross-cutting

- [X] T007 Full gate (solo-maintainer mode): `pnpm exec tsc --noEmit`; `pnpm exec eslint <changed>`; `pnpm exec prettier --check <changed>`; `pnpm test` (full suite green — FR-004: no other bookings-report assertion regresses); `pnpm build`. All green.
- [X] T008 [P] Update `zak1_Phase5_Requirements.md`: mark **P5-R2 SHIPPED as feature 029** (bookings report now defaults to descending date; toggle unchanged; no migration), closing the last ascending-default surface (SC-003).

---

## Dependencies & execution order

- **Tests (T002, T003)** before the **implementation (T004, T005, T006)** — constitution I (Red→Green).
- The three source flips (T004/T005/T006) are independent of each other but should land together so the page,
  service, and route agree on descending (FR-001 + FR-002 consistency).
- **Polish (T007/T008)** last.

### Parallelizable

- **T002/T003** [P] (distinct test files). **T004/T005/T006** [P] (distinct source files, all after the
  tests). Docs **T008** [P].

## Implementation strategy

Ship as **one atomic commit** once T007 is green. Build order: update the two ordering-default tests (Red) →
flip service default → flip route default → flip page initial state (Green) → full gate → doc update. No
API/schema/migration; the only risk is inconsistency between the three default spots, which the updated
integration (service) + component (page/route path) tests together pin down.

## Summary

- **Total tasks**: 8 (Setup 1 · US1 5 · Polish 2)
- **Task count per user story**: US1 = 5 (T002–T006)
- **Test tasks**: T002, T003
- **Parallel opportunities**: T002/T003; T004/T005/T006; T008
- **MVP scope**: **US1** — the entire feature (the default flip); there is no P2/P3.
