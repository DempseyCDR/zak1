# Specification Quality Checklist: Merge relinking

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-10
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

- Items marked incomplete require spec updates before `/speckit-clarify` or `/speckit-plan`.
- Table and column names were deliberately kept out of the spec; the mapping from FR-001/FR-003's
  categories to actual tables belongs in `data-model.md` at plan time. The source requirements doc
  ([merge-relink-and-unmerge.md](../../phase-8-requirements/merge-relink-and-unmerge.md)) carries the
  concrete list.
- Every FR cites its source requirement (`MRG-Rn`), so the mapping back to the pre-spec draft is
  checkable. MRG-R11–MRG-R13 (undo) are intentionally absent — they are feature 073.
- Success criteria are stated against **measured** current values (nine stranded records, seven
  unreachable performers) rather than invented targets, so SC-001 through SC-003 can be verified by
  re-running the same counts.
- **Decided 2026-09-10**: the historical repair (**FR-015**) stays in scope — it is what delivers the
  visible value, since the seven stranded performers are the reason the Booker cannot reach them today.
- **Amended 2026-09-10** (FR-011, FR-012, FR-012a, FR-012b, FR-013, US3): a colliding sign-in is **one**
  decision, not two. Feature 069 already holds such a merge, but its resolution moves only the login
  **label** and never the account binding — so the officer answering it changes nothing about who can
  sign in. FR-012a now forbids resolving the address alone. The label and the binding are permitted to
  disagree by design (feature 015, R9: a Google account can be renamed without telling us), which is
  precisely why the address can never be the thing a merge resolves. FR-013 likewise now covers **both**
  sign-in routes, not just first-time enrolment.
- **Clarified 2026-09-10** (4 questions): holds stay resolvable only by removing their cause, which
  promoted auto-close to a requirement (**FR-010a**); 072 records nothing extra for undo, per Principle II;
  the historical repair covers **all nine** stranded records, not just performers (**FR-015**); and
  FR-002's rule is made enforceable by a parity guard (**FR-002a**, **SC-008**) rather than left as an
  intention.
- Resolved without spending a question, from the schema: officer seats cannot collide (`officers` is
  unique on the seat, not the contact); attendance *can* collide, already covered by the "survivor holds
  it once" edge case; and FR-012b's "refused clearly" inherits feature 015's deliberately generic
  sign-in refusal, which reveals nothing about why — a property chosen on purpose.
