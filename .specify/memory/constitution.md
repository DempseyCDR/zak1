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

Version change: 1.1.0 → 1.2.0 (2026-07-14)
Modified sections:
  - Technology Standards → Testing: split into two provisions. The no-mocking rule is retained in full
    force for databases and services the project operates; a narrow exception is added for third-party
    services the project does NOT operate.
Added sections: N/A (existing provision expanded)
Removed sections: N/A
Reason: "Real infrastructure" is already satisfied for the database by a real LOCAL Postgres, not the
  production database. Read literally, the old rule would require calling an external identity provider's
  PRODUCTION endpoints from the automated suite — the equivalent of testing against prod: rate limits,
  abuse/bot detection, credentials in CI, non-determinism, and dependence on third-party uptime. The
  rule's real intent is to forbid faking semantics we depend on (constraints, transactions, citext,
  arrays), where a mock lies to us. An IdP dependency is narrow and standardized (a signed token carrying
  a verified email claim); all logic that can genuinely break is on our side of that seam and remains
  live-tested. Driven by feature 015 (specs/015-staff-auth), which authenticates staff via Google.
Version rationale: MINOR — a provision is materially expanded; no principle removed or incompatibly
  redefined; every previously-compliant test remains compliant (the change only permits, never requires).
Templates updated (all verified this session):
  - .specify/templates/plan-template.md ✅ no change required (Constitution Check derives its gates from
    this file rather than duplicating rules)
  - .specify/templates/spec-template.md ✅ no change required (no testing/mocking references)
  - .specify/templates/tasks-template.md ✅ no change required (integration-test tasks are generic and
    state no mocking policy)
  - README.md ✅ no change required (links to the constitution generically)
Deferred TODOs: none

Version change: 1.2.0 → 1.3.0 (2026-07-23)
Modified sections:
  - Development Workflow: replaced the unconditional feature-branch + PR-review + no-self-merge rules with
    a two-mode rule — solo-maintainer mode (current reality) and multi-contributor mode (activates when a
    second contributor, e.g. Zak, begins contributing).
  - Governance → Compliance: "All PRs" wording generalized to cover solo-mode feature commits.
Added sections: N/A
Removed sections: N/A
Reason: The old text mandated feature branches, pre-merge review, and forbade self-merging. The project has
  had exactly one maintainer since inception; every feature (001–019 planning) landed as one atomic commit
  direct to main, with the full gate suite (tests, tsc, lint, format, build, plan.md Constitution Check) run
  locally. The rule as written was therefore violated by every compliant-in-spirit commit ever made — a
  standing contradiction surfaced as finding C1 in feature 019's /speckit-analyze. Review by a second person
  is not possible with one person; requiring it produced dead process, not quality. The multi-contributor
  mode is written in NOW so the discipline is pre-committed rather than negotiated later: the moment a second
  contributor lands work, branches + review become mandatory again without a further amendment.
Version rationale: MINOR — same reasoning as 1.2.0: a section's provisions are materially rewritten, no core
  principle (I–IV) is touched, and every previously-compliant behavior remains compliant (the change only
  permits, never newly requires, until the second-contributor trigger fires).
Templates updated (all verified this session):
  - .specify/templates/plan-template.md ✅ no change required (Constitution Check derives from this file)
  - .specify/templates/spec-template.md ✅ no change required (no workflow references)
  - .specify/templates/tasks-template.md ✅ no change required (no workflow references)
  - README.md ✅ no change required
Deferred TODOs: none

Version change: 1.3.0 → 1.4.0 (2026-09-11)
Modified sections:
  - Development Workflow: the branch-and-PR requirement is lifted OUT of the mode distinction and made
    unconditional. Solo-maintainer mode is renamed single-contributor mode and rewritten: it no longer
    permits committing direct to main. The only remaining difference between the modes is whether a
    second person must approve before merge.
  - Development Workflow: the one-way switch clause is REMOVED. The mode now tracks the live contributor
    count in both directions, and each transition is recorded here.
  - Governance → Compliance: both modes now land work by PR, so the parenthetical distinguishing
    "feature commit (solo-maintainer mode) or PR (multi-contributor mode)" is collapsed to "Every PR".
Reason: Zak has stopped contributing, returning the project to one contributor. Under 1.3.0 that switch
  was declared one-way and permanent, so honouring the fact at all required an amendment — hence this
  one. But reverting literally to 1.3.0's solo-maintainer mode would have discarded a practice that
  demonstrably earned its place: features 069–073 each landed as a reviewed PR (#31–#35), and those five
  diffs are now the only place each change is legible as a single unit. The rule that could not survive
  one contributor was never the branch or the PR — it was "self-merging is not permitted", which with one
  person is not a standard but a deadlock. So that single clause is dropped and the rest is kept and made
  unconditional. Note that Principle I already said "No feature branch may be merged unless all tests
  pass", which presumed branches even while the workflow section called them optional; that inconsistency
  is resolved here in favour of branches.
Version rationale: MINOR. No Core Principle (I–IV) is added, removed, or redefined. Unlike 1.2.0 and
  1.3.0 this amendment does NEWLY REQUIRE something — a branch and a PR, where solo-maintainer mode
  made both optional — so those amendments' "only permits, never requires" justification is explicitly
  NOT available here and is not claimed. MINOR is nonetheless correct: the scope is one section's
  procedure, not a principle, and nothing in flight is invalidated, since every feature since 069 already
  works this way. This constitution is not retroactive: work that complied with the version in force when
  it landed remains compliant, and features 001–068 are not made irregular by this change.
Templates updated (all verified this session):
  - .specify/templates/plan-template.md ✅ no change required (Constitution Check derives from this file)
  - .specify/templates/spec-template.md ✅ no change required (no workflow references)
  - .specify/templates/tasks-template.md ✅ no change required (no workflow references)
  - README.md ✅ no change required
Deferred TODOs: none
-->

# runcdr Constitution

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
- **Testing**: To be specified per build. Integration tests MUST run against **real infrastructure** —
  a real, locally-run instance of the dependency. Databases and services the project operates MUST NOT be
  mocked, stubbed, or faked in integration suites.
- **Third-party services the project does not operate** (e.g. an external identity provider) are the sole
  exception to the rule above. Automated tests MUST NOT call their production endpoints: doing so is
  unreliable (rate limits, abuse detection, availability) and is no more "real" than testing against a
  production database. Such a dependency MUST instead be exercised at its boundary via either (a) a
  conforming implementation run locally, or (b) a fixture reproducing the provider's verified contract
  (e.g. signed OIDC tokens). All of the project's own logic behind that boundary — claim validation,
  identity matching, session creation — MUST still be covered by integration tests against real
  infrastructure. This exception narrows the blast radius of an unavailable or defensive third party; it
  is NOT a licence to fake semantics the project depends on.
- **Linting / Formatting**: The standard linter and formatter for the chosen language MUST pass in CI.
- **Package / dependency manager**: To be established at build setup; MUST be consistent within a build.

## Development Workflow

These rules are unconditional, whoever is contributing:

- Work lands on `main` **only through a pull request** from a feature branch named `###-feature-name`,
  matching its spec directory (`specs/###-feature-name/`). Nothing is committed direct to `main`.
- One **atomic commit per feature**. Commits MUST be meaningful; squash "WIP" commits before opening the
  PR.
- Before opening the PR, the full gate suite MUST pass locally: tests, type check, lint, formatting,
  production build, and the `plan.md` Constitution Check sign-off.
- Every PR MUST state: passing tests, no lint errors, and a Constitution Check sign-off.
- The implementation plan (`plan.md`) Constitution Check gate MUST be reviewed before Phase 0 research and
  re-verified after Phase 1 design.

On top of that, one rule — and only one — depends on **how many people are currently contributing code**.
That is a fact about the project, not a preference:

**Single-contributor mode** (in effect while the project has exactly one contributor):

- The author merges their own PR. Self-merge is permitted **because there is no second person to ask**,
  not because review is unimportant: with one contributor, requiring approval produces deadlock, and
  1.3.0 already recorded what happens when the constitution mandates a reviewer who does not exist.
- The gate suite therefore carries the full weight. It is not optional because no one is watching — it is
  the only thing watching. A gate MUST NOT be skipped, loosened, or deferred to "fix in a follow-up".
- The PR still opens, and still stands as the reviewable record of the change even when the reviewer and
  the author are the same person.

**Multi-contributor mode** (in effect while two or more people are contributing code):

- Code review by someone other than the author is required before merging; self-merging to `main` is not
  permitted.

The mode follows the contributor count in **both directions**. It is not latched, and changing it does not
require re-litigating the workflow — but each transition MUST be recorded in the Sync Impact Report above,
with the version bumped, so the project's history says which discipline was in force when each feature
landed. Recorded transitions to date:

| Date | Mode | Trigger |
|---|---|---|
| 2026-07-23 (v1.3.0) | single contributor | one maintainer since inception |
| 2026-08-20 (feat 044) | multi-contributor | Zak began contributing |
| 2026-09-11 (v1.4.0) | single contributor | Zak stopped contributing |

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

**Compliance**: Every PR must pass the Constitution Check in `plan.md` before landing on `main`.
Exceptions require written justification in the Complexity Tracking table.

**Not retroactive**: work that complied with the version of this constitution in force when it landed
remains compliant. An amendment governs what comes after it, and never makes past features irregular.

**Version**: 1.4.0 | **Ratified**: 2026-06-16 | **Last Amended**: 2026-09-11
