<!--
SYNC IMPACT REPORT
==================
Version change: [template] → 1.0.0
Modified principles: N/A (initial ratification)
Added sections:
  - Core Principles (I–IV)
  - Technology Standards
  - Development Workflow
  - Governance
Removed sections: N/A
Templates updated:
  - .specify/templates/plan-template.md ✅ (Constitution Check section aligns)
  - .specify/templates/spec-template.md ✅ (no changes required)
  - .specify/templates/tasks-template.md ✅ (test-first tasks pattern aligns)
Deferred TODOs:
  - RATIFICATION_DATE set to today (2026-06-16); update if project predates this session.

Version change: 1.0.0 → 1.1.0 (2026-06-18)
Modified principles:
  - III. Type Safety: removed TypeScript-specific language; generalized to any language
  - IV. Observability: replaced `console.log` with language-agnostic wording
  - Technology Standards: removed TypeScript/Node.js lock-in; all stack choices deferred to per-build decisions
Reason: project will explore multiple tech stacks across different builds.
Templates updated: N/A (no template changes required)
-->

# zak1 Constitution

## Core Principles

### I. Test-First (NON-NEGOTIABLE)

TDD is mandatory across the entire codebase. Tests MUST be written before implementation
code. The Red-Green-Refactor cycle is strictly enforced:

- Write a failing test that describes the desired behavior.
- Confirm the test fails for the right reason.
- Implement the minimum code to make it pass.
- Refactor without breaking the green suite.

No feature branch may be merged unless all tests pass and new behavior is covered by tests.
Untested code is unfinished code.

### II. Simplicity / YAGNI

Build only what is required today. Speculative abstractions, unused generalization, and
premature infrastructure MUST NOT be introduced. Violations require explicit justification
in the implementation plan's Complexity Tracking table.

- Three similar lines are preferable to a premature abstraction.
- Helper utilities are created only when the same logic is needed in three or more places.
- Remove dead code immediately; do not leave it commented out.

### III. Type Safety

Use the strictest type checking available for the chosen language. Type escape hatches
(casts, `any`-equivalents, dynamic dispatch without narrowing) are banned except in narrow,
documented escape hatches. Every escape hatch MUST include a comment explaining why stricter
typing is not possible.

- Enable the strictest compiler/linter flags available for the language in use.
- External API boundaries MUST be validated with a schema/contract library and converted to
  typed domain objects before use elsewhere in the code.
- Types are the documentation; duplicating them in comments is forbidden.

### IV. Observability

Structured logging, request tracing, and error reporting MUST be built in from day one.
Observability is not optional and is not deferred to "after MVP."

- All HTTP request/response cycles MUST emit structured log entries (JSON in production).
- Errors surfacing to users MUST be logged server-side with full context (request ID,
  user ID where available, stack trace).
- Metrics for critical operations (auth, data writes, external calls) MUST be emitted via
  the chosen instrumentation library.
- No ad-hoc print/log statements in production paths; use the structured logger.

## Technology Standards

- **Language**: To be chosen per build; strict type checking MUST be enabled regardless of choice.
- **Frontend**: To be specified per feature; MUST share type contracts with the backend.
- **Backend**: To be specified per feature; REST or equivalent structured API preferred.
- **Testing**: To be specified per build; integration tests MUST run against real infrastructure
  (no mocking of databases or external services in integration suites).
- **Linting / Formatting**: The standard linter and formatter for the chosen language MUST pass in CI.
- **Package / dependency manager**: To be established at build setup; MUST be consistent within a build.

## Development Workflow

- Feature branches follow the naming convention `###-feature-name`.
- Every PR MUST include: passing tests, no lint errors, and a Constitution Check sign-off.
- Code review is required before merging; self-merging to main is not permitted.
- Commits MUST be atomic and meaningful; squash "WIP" commits before requesting review.
- The implementation plan (`plan.md`) Constitution Check gate MUST be reviewed before
  Phase 0 research and re-verified after Phase 1 design.

## Governance

This constitution supersedes all other documented practices. Where conflicts arise, this
document takes precedence.

**Amendment procedure**:
1. Propose the change with rationale and impact assessment.
2. Identify affected templates and artifacts.
3. Update the constitution and increment the version per semantic versioning rules.
4. Propagate changes to dependent templates in the same commit.
5. Record the amendment in the Sync Impact Report (HTML comment at top of this file).

**Versioning policy**:
- MAJOR — principle removal or backward-incompatible redefinition.
- MINOR — new principle or section added.
- PATCH — clarifications, wording, or typo fixes.

**Compliance**: All PRs must pass the Constitution Check in `plan.md` before merging.
Exceptions require written justification in the Complexity Tracking table.

**Version**: 1.1.0 | **Ratified**: 2026-06-16 | **Last Amended**: 2026-06-18
