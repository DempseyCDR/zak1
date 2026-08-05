# Feature Specification: Remove the GL-Account-Per-Line Mapping

**Feature Branch**: `039-drop-account-mapping`

**Created**: 2026-08-05

**Status**: Draft

**Input**: Phase 6 requirement **P6-R7** (`zak1_Phase6_Requirements.md`, treasurer-report rework thread) — a
YAGNI removal of the unused GL-account-code annotation (`account_mapping`), confirmed dead by tracing the code.
**`series_qbo_map` (gate customer + class) is retained** — it is a different table and the treasurer's real model.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The treasurer report and QBO-mapping page drop the dead GL-account annotation (Priority: P1)

The Treasurer opens a dance's treasurer report: each line still shows its **customer** (Contra Gate / English
Gate) and **class** and its amounts — but the **GL account code** column is gone, because nothing ever used it
(the treasurer books sales receipts and bills; QuickBooks derives the account from the customer/vendor, not from
a per-line code the report supplied, and there is no export that consumes those codes). On the QBO-mapping page,
the **"Accounts"** section is gone; the **"Series → gate customer / class"** section stays and still works. Every
computed figure on the report is unchanged.

**Why this priority**: This is the whole feature — removing a pure display annotation that has no consumer
(Constitution §II, YAGNI). It is complete and demonstrable on its own.

**Independent Test**: Open a treasurer report and the QBO-mapping page; confirm no GL account code appears on any
report line and no "Accounts" editor exists, while class + customer (report) and the series → customer/class
editor (page) remain and every other report figure is unchanged.

**Acceptance Scenarios**:

1. **Given** a treasurer report for an event, **When** it renders, **Then** **no** line shows a GL account code,
   and each line still shows its **class** and (for gate) its **customer**.
2. **Given** the same report, **When** it renders, **Then** every other figure (gate sales amounts, named
   receipts, performer payments + reconciliation, deposit, fees) is unchanged from before.
3. **Given** the QBO-mapping page, **When** it renders, **Then** there is **no** "Accounts" editor, and the
   **"Series → gate customer / class"** editor is present and still saves.
4. **Given** the removal is complete, **When** any client attempts to edit a GL account mapping, **Then** there
   is no path that accepts it.
5. **Given** a series/gate-customer/class change, **When** it is saved, **Then** it is still recorded in the
   mapping audit trail (only account-mapping edits stop being recorded).

### Edge Cases

- **Existing GL-account mappings in a live database**: dropped with the table (the whole catalog is unused). No
  orphan remains (unlike a single-row removal).
- **Historical account-mapping audit entries**: retained as history — the audit trail stays; only *new*
  account-mapping edits cease (there is no editor).
- **Re-running the destructive removal**: idempotent (removing an already-removed store is a no-op).
- **`series_qbo_map` and its editor/audit**: must keep working — the report's customer + class still come from it.
- **Other financial data**: no stored money or computed figure changes.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The treasurer report MUST NOT display a GL account code on any line.
- **FR-002**: The report MUST retain each line's **class** and, for gate lines, its **customer** — only the
  GL-account annotation is removed.
- **FR-003**: No **computed** report figure MUST change (the GL account code was display-only, never used in any
  calculation).
- **FR-004**: The QBO-mapping page MUST NOT include an "Accounts" (GL-code) editor; the **"Series → gate
  customer / class"** editor MUST remain and continue to save changes.
- **FR-005**: The system MUST NOT accept any request to create or edit a GL account mapping (no endpoint, schema,
  or path for it remains).
- **FR-006**: The account-mapping data store MUST be removed by a **destructive, idempotent** step preceded by a
  **backup** of the affected data (per the project's data-migration safety convention).
- **FR-007**: The series → gate-customer/class store (`series_qbo_map`) MUST be **retained intact** — it is the
  source of the report's customer + class and must not be touched by this removal.
- **FR-008**: The mapping **audit trail** MUST be retained: series/gate-customer/class changes are still
  recorded; only account-mapping edits stop being recorded (there is no editor).
- **FR-009**: No other stored financial data MUST be lost or altered; money remains integer cents.

### Key Entities

- **GL account mapping (being removed)**: a catalog mapping each report line-key (admission, rent, a performer
  type, deposit, fees, …) to a QuickBooks GL account code + name. Purely a per-line **display** annotation on the
  treasurer report; no calculation or export consumes it. Removed in full.
- **Series → gate customer / class (retained)**: maps each series to its gate customer (Contra Gate / English
  Gate) and QBO class — supplies the report's `customer` + `class`. **Unchanged** by this feature.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The treasurer report shows **0** GL account codes; **100%** of lines still show class (and gate
  lines still show customer).
- **SC-002**: **100%** of other report figures for a given event match their pre-removal values.
- **SC-003**: The QBO-mapping page shows **0** "Accounts" editors and the "Series → gate customer / class" editor
  still saves a change successfully.
- **SC-004**: There is **no** remaining way to submit a GL account-mapping edit.
- **SC-005**: The full automated test suite passes with the annotation removed — no dangling references remain.

## Assumptions

- **Prior step**: feature 038 already removed the single `non_dance_income` account-mapping row and its lookup;
  this feature removes the **entire** `account_mapping` catalog (the whole GL-per-line annotation is dead).
- **Scope is P6-R7 only**: the treasurer-report **restructure** into sales-receipts/bills (P6-R8) and the
  comp/gift counts (P6-R9) are **separate features**. Here the report keeps its current shape **minus** the
  GL-account column.
- **`series_qbo_map` retained**: the report keeps customer + class; only the account column is dropped.
- **`mapping_audit` table retained**: it stores both account and series-QBO edits historically; series-QBO edits
  keep writing to it; only the account-edit path is gone.
- **Data-migration safety**: a snapshot precedes the destructive drop and the drop is idempotent, consistent with
  the project's convention.
- **No figure changes**: removing the GL-account column changes no report total (it was display-only).
