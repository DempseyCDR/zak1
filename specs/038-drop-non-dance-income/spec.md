# Feature Specification: Remove the Non-Dance Income Capability

**Feature Branch**: `038-drop-non-dance-income`

**Created**: 2026-08-05

**Status**: Draft

**Input**: Phase 6 requirement **P6-R6** (`zak1_Phase6_Requirements.md`, treasurer-report rework thread) — a
YAGNI removal of the unused "treasurer enters non-dance income separate from the door" capability.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The treasurer's report and page no longer carry the unused non-dance-income feature (Priority: P1)

The Treasurer opens a dance's treasurer report and works the treasurer page. The **"Non-Dance Income"** section
and its **add-entry form** are gone — because in three years no one has ever used them (all real income is
admissions or a gate-sales category). Every other figure and action on the report and page is exactly as before;
nothing else moves.

**Why this priority**: This is the whole feature — a clean removal of dead weight (Constitution §II, YAGNI). It
is complete and demonstrable on its own.

**Independent Test**: Open a treasurer report and the treasurer page; confirm no non-dance-income section or
entry control appears, and confirm all other report figures for the same event are unchanged from before the
removal.

**Acceptance Scenarios**:

1. **Given** the treasurer page for an event, **When** it renders, **Then** there is **no** "non-dance income"
   entry form or control.
2. **Given** a treasurer report for an event, **When** it renders, **Then** there is **no** "Non-Dance Income"
   section, and every other section (gate sales, named receipts, performer payments, deposit, fees) is unchanged.
3. **Given** the removal is complete, **When** any client attempts to record non-dance income, **Then** there is
   no path that accepts it (the capability no longer exists).

### Edge Cases

- **An event that once had non-dance-income entries**: none exist in practice (zero in three years), but the
  report simply omits the section rather than erroring.
- **Re-running the destructive removal step**: it is idempotent (removing an already-removed store is a no-op).
- **The shared QBO account map**: the account-mapping catalog is retained (many other line items use it); only
  the now-unused non-dance-income mapping entry is removed. A stray leftover mapping row, if any, is harmless.
- **Existing financial data**: no other stored money or report figure is altered by the removal.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The treasurer page MUST NOT offer any control to enter "non-dance income."
- **FR-002**: The treasurer report MUST NOT include a "Non-Dance Income" section.
- **FR-003**: The system MUST NOT accept any request to record non-dance income (no endpoint, form, or path for
  it remains).
- **FR-004**: All other treasurer-report figures and actions MUST be **unchanged** by this removal — the section
  was an independent add-on, so gate sales, named receipts, performer payments, deposit, and fees are identical
  to before.
- **FR-005**: The removal MUST NOT lose or alter any **other** stored financial data; only the unused
  non-dance-income data is discarded (money remains integer cents throughout).
- **FR-006**: The destructive removal of the non-dance-income data store MUST be preceded by a **backup** of the
  affected data (per the project's data-migration safety convention), and MUST be idempotent (safe to re-run).
- **FR-007**: The shared QBO account-mapping catalog MUST be retained; only the non-dance-income line-item
  mapping is removed. A pre-existing leftover mapping row is acceptable (harmless) and requires no cleanup.

### Key Entities

- **Non-dance-income record (being removed)**: a treasurer-entered income line for an event that was **not**
  collected at the door — a description, an amount (cents), and an entry date, mapped to a single QBO income
  account. This entity and its store are removed in full; zero instances exist in practice.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The treasurer page shows **0** non-dance-income entry controls.
- **SC-002**: The treasurer report shows **0** non-dance-income sections; **100%** of the other report figures
  for a given event match their pre-removal values.
- **SC-003**: There is **no** remaining way to submit non-dance income (a former submission attempt no longer
  succeeds).
- **SC-004**: **No** other financial record is changed by the removal (verified against existing events'
  reports).
- **SC-005**: The full automated test suite passes with the capability removed — no dangling references remain.

## Assumptions

- **Zero usage**: no non-dance-income entries exist (three years, confirmed), so the removal has no user-facing
  data loss in practice.
- **Scope is P6-R6 only**: the account-mapping purge (P6-R7), the treasurer-report restructure (P6-R8), and the
  comp/gift counts (P6-R9) are **separate features**, out of scope here.
- **Account-mapping catalog retained**: only the non-dance-income mapping entry is removed; the catalog and all
  other line items stay (they are used elsewhere).
- **Data-migration safety**: a snapshot/backup of the affected data is taken before the destructive step, and
  the step is idempotent — consistent with how the project handles destructive/data migrations.
- **Report continuity**: removing the non-dance-income section changes no other report total (it was a standalone
  add-on section, never folded into another figure).
