# Specification Quality Checklist: Membership Accounts

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-04
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

- Settled with the user before drafting: the level is chosen directly by the FS (no dues price table,
  because tiers change and cheques bundle donations); the **existing** `member` mailing list is the one
  whose definition changes; PayPal is deferred until deployment exists.
- Three items carried as **assumptions** rather than clarification markers, each with a reasonable default
  but worth confirming in `/speckit-clarify`:
  1. **Renewal extends an existing account** rather than opening a second one — the alternative would mean
     re-attaching the household every year.
  2. **The most generous account wins** when several cover one contact.
  3. *(Resolved in clarification.)* Status is **derived at the point of use** plus a one-off backfill
     (FR-015 / FR-015a) — no scheduler assumed.
- The migration question for the 17 contact-less payers is **resolved** by FR-021: match by name, else
  create the contact and flag it for review.
- *(Resolved in clarification.)* The orphaning mechanism is closed: deleting a contact who owns an account
  is refused (FR-009), so FR-021's cleanup cannot be undone by the same path that caused it.
