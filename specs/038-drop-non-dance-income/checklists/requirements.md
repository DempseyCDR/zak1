# Specification Quality Checklist: Remove the Non-Dance Income Capability

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

- A removal feature: the "value" is deleting dead weight (YAGNI). Requirements are framed at the capability level
  (no entry control, no report section, no accept-path, other figures unchanged, data safety) so they stay
  testable without prescribing the deletion mechanics.
- No `[NEEDS CLARIFICATION]`: the one design decision (retain the account-mapping catalog, drop only the
  non-dance-income mapping) is already made and recorded as an assumption/FR-007.
- Schema-destructive: FR-006 captures the backup-before-drop + idempotency safety, matching the project's
  data-migration convention. Scope is explicitly R6-only (R7/R8/R9 separate).
