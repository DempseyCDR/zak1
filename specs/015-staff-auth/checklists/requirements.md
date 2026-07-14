# Specification Quality Checklist: Staff Authentication & Session Foundation

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-07-14
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain — resolved: self-service sign-up (gated), manual recovery
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

- **Decision history (2026-07-14).** The spec was rewritten after two findings changed its foundations:
  1. **Code review**: `contacts.is_volunteer`, `contacts.volunteer_roles`, and `contact_emails.is_login`
     already exist (feature 001) but are **dormant** — no UI writes them, and live data has **0 of 1334
     contacts as volunteers, 0 login emails**. The spec now activates that substrate (FR-014) instead of
     inventing a parallel identifier, and adds the **bootstrap** path (FR-017) without which the feature
     was unbootstrappable.
  2. **Google Workspace**: the club issues Workspace accounts to all staff, so authentication is
     **Sign in with Google** (FR-001). This superseded the earlier email+password model — removing password
     storage, policy, throttling, and the manual officer-reset wart — and made the earlier
     **officer-approval** step redundant (Google verifies identity; `is_volunteer` authorizes staff), so it
     was dropped.
- **Constitution amended to v1.2.0** (2026-07-14) to settle the IdP test strategy: automated tests must not
  call Google's production endpoints; the provider is exercised at its boundary (local conforming
  implementation or signed-OIDC-token fixture), while all logic behind the seam stays integration-tested
  against real Postgres. The database no-mocking rule is untouched.
- Deferred to `/speckit-plan`: session inactivity timeout value; whether to also restrict sign-in to the
  club's Workspace domain.
- Scope boundary (authentication only; authorization deferred to P3-2) is stated explicitly in the spec
  Overview.
