# Specification Quality Checklist: Remove the GL-Account-Per-Line Mapping

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-08-05
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

- A removal feature (bigger than 038's single-row drop): the whole GL-account-per-line annotation is dead, so the
  entire `account_mapping` catalog goes. Requirements are framed at the capability level (no GL code on any line,
  no Accounts editor, no accept-path, class/customer + series-QBO retained, data safety).
- **The load-bearing boundary** is FR-002 + FR-007: **keep `series_qbo_map`** (customer + class) and the report's
  class/customer — only the GL-account column is removed. Called out explicitly so the purge can't over-reach.
- No `[NEEDS CLARIFICATION]`: every decision (drop the whole catalog, retain series_qbo_map + mapping_audit, R7
  scope only) is pre-made and recorded as FRs/assumptions.
- Schema-destructive (FR-006): backup-before-drop + idempotency, matching the project's data-migration convention.
