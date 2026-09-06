# Specification Quality Checklist: Triage Mode — Worklists

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-05
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

- Settled with the user before drafting: the rejection lapses when `dedup_normalized` changes (i.e. a
  structured first/last name edit), which is exactly what pair proposal depends on; the contacts-view
  queue supersedes the separate duplicates page; rows need more contact data to decide from.
- Grounded in measurement rather than assumption: pairs are proposed on **name similarity alone** at a 0.4
  trigram threshold, so same-surname/different-first-name pairs (0.30–0.36) never reach the queue. What
  Mel sees are near-identical full names. This shapes FR-001 (what a row must show) and FR-003 (what
  lapses a rejection).
- All five clarify questions answered (2026-09-05 session): rejection stored **as the names judged**
  (FR-003a); a held merge is **its own item** shown in the needs-review queue (FR-014/FR-014a);
  "safely resolvable" is **derived from the row** (FR-005/FR-006); rejections are **revealable and
  undoable from the queue** (FR-004a); a pair offers **all three** resolutions (FR-015a/FR-015b).
- Applied after the first `/speckit-analyze` pass: retiring `/dedup` is not a deletion — it holds a
  hand-maintained `NAV` entry that fails feature 035's completeness guard in CI if orphaned, and two
  component suites whose coverage must be **re-pointed rather than lost**. One of them,
  `dedup.linkAsShared.test.tsx`, is the only test of the 067 guard that FR-015b requires to survive.
- Also from that pass: **FR-001a** now says what a **needs-review** row must display, so FR-005's "safe when
  the row shows everything" has a referent on both queues rather than only on pairs; **FR-016** gained
  coverage; and the vocabulary is fixed — Mel's action is **"not duplicates"**, the record it leaves is a
  **rejection**.
- These notes deliberately cite **requirements, not task numbers**. Inserting the FR-001a tasks meant
  resequencing all 38, which invalidated every prose reference to a task id — four of them, three in this
  file. Requirement ids survive a renumbering; task ids do not.
- M-R21's held merge is the highest-risk item: today two sign-in identities hit a database constraint and
  throw a raw error, so FR-011–FR-014 replace a hard failure rather than adding to working behaviour.
