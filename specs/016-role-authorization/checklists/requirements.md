# Specification Quality Checklist: Authorization — Role × Capability × Scope

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-07-15
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

**Status: PASS** — 16/16 items passing. Unchanged by the clarify pass (16/16 → 16/16): every answer
*tightened* existing requirements rather than opening new gaps. Ready for `/speckit-plan`.

### Validation iteration 3 — 2026-07-15 (`/speckit-clarify`)

Five questions asked and answered, plus one decision the user volunteered. Spec grew FR-016a, FR-017a/b,
FR-026a/b, FR-028a/b, FR-030a, SC-014, SC-015, and three acceptance scenarios; FR-026 and SC-012 were
**replaced** rather than duplicated.

| Q | Decision | Why it mattered |
|---|---|---|
| — (volunteered) | **Dedup review is a sanctioned bulk PII view** (VP + MLM) | FR-017 would otherwise have silently broken dedup — comparing emails *is* the task. Now FR-017a. |
| 1 | **PII-read is implicit on needs-based roles**, not separately grantable | Closed the one assumption carried out of `/speckit-specify`. Now FR-016a. |
| 2 | **Audit PII reads per request, not per contact** | Turns the accepted bulk-harvest risk from invisible into detectable. Per-contact was untenable: check-in search fires per keystroke over 20 contacts. Now FR-017b. |
| 3 | **Super-user is CLI-only** | Keeps god-mode out of the officers' weekly screen. Recorded honestly as *governance, not containment* — President + VP can still self-grant every other role. Now FR-030a. |
| 4 | **Refusals are explicit** | Cascaded into rewriting FR-026: its non-disclosure posture was written for a secrecy model this club does not have. Only PII is secret, so hiding refusal reasons bought nothing. |
| 5 | **Cascade on volunteer clear — but report grants first** | The user's amendment to the recommendation; takes the deliberateness of "block" without the busywork. Now FR-028a/b. |

**Contradiction check**: FR-026's original non-disclosure wording contradicted Q4 and was replaced, not
appended to. SC-012 likewise. The "grant names a deleted series/group" edge case was verified
**unreachable** — no DELETE path exists for series or event groups (only bookings and bands have one) — and
is now marked as a referential-integrity decision for `/speckit-plan` rather than behavior to build.

**Numbering fix**: the PII-disclosure audit was initially filed among the refusal requirements as FR-026a,
out of alphabetical order and off-topic. Moved to the Read authority section as FR-017b; the refusal trio
renumbered to FR-026/026a/026b. All cross-references updated.

### Validation iteration 4 — 2026-07-15 (officer exclusivity)

User volunteered: **President, VP, and Treasurer are mutually exclusive.** Two follow-ups asked and
answered. Added FR-005a/b, FR-029a/b, SC-016, three US2 acceptance scenarios, three edge cases; amended
FR-033 and FR-036. Still 16/16.

| Decision | Effect |
|---|---|
| **P/VP/Treasurer mutually exclusive** — hard refusal, every path incl. CLI | FR-005a, FR-033, SC-016. Rationale recorded as **separation of duties**, not "one office per person". |
| **Secretary exempt** | FR-005b. Its absence from the user's list was the tell that the rule is about authority-vs-money, not elected offices — confirmed rather than assumed. |
| **President/VP *may* hold FS — warn, don't block** | FR-029a/b, FR-036. The deliberate gap: Treasurer ⊇ FS, so FS-of-every-series reaches most of the same money authority. |

**Consequence for FR-030a**: its honesty note was **rewritten**, not left stale. The clarify pass had
recorded Super-user-CLI-only as "governance, not containment" *because* a President could self-grant
Treasurer. FR-005a closes that path, so the note now reads "real but partial" and names FS-of-every-series
as what remains. An earlier statement invalidated by a later decision — replaced, per the clarify contract.

**Pattern worth naming**: the club consistently chooses **visibility over prohibition** — advisory annual
review, accepted-but-audited PII risk, flagged FS concentration. Only the officer triad gets a hard block.
Recorded in `use-cases.md` §4 so future proposals get weighed against it.

### Validation iteration 5 — 2026-07-15 (uniqueness + the FS rationale)

Both remaining open points closed by the user. Added FR-005c; rewrote FR-029a's rationale; Assumptions
updated. Still 16/16. **The spec now carries zero open questions.**

| Decision | Effect |
|---|---|
| **Two people may hold the same office** — unlikely but permitted | **FR-005c**, stated as a prohibition on the *implementation*: no uniqueness constraint may be added. Written this way deliberately — the risk was never that someone forgets, it's that `/speckit-plan` "helpfully" adds a unique index because one-President-at-a-time feels obviously right. |
| **President-as-FS is sound because the FS reports to the Treasurer** | FR-029a rewritten. This was recorded as a *tolerated gap*; it is actually a **designed control**, and the file now says so. |

**The load-bearing insight** (FR-029a, `use-cases.md` §4): the FS gap is safe **only because** FR-005a
guarantees the Treasurer is a different person from the President. The two rules hold each other up —
weaken exclusivity and a President-as-FS would report to themselves, leaving the money unreviewed. Both
files now carry that warning, because either rule read alone looks independently negotiable.

**Zero open questions remain.** The earlier "role uniqueness" flag is resolved, not deferred.

### Validation iteration 1 — 2026-07-15

Opened 3 `[NEEDS CLARIFICATION]` markers (Organizer base read extent; who assigns delegates; Door
Attendant scope) and raised them to the user.

### Validation iteration 2 — 2026-07-15

**All 3 resolved by the user, plus two more they volunteered.** Markers removed; see the spec's
Clarifications section. Summary of what changed and why it matters:

| Decision | Effect on the spec |
|---|---|
| Read = **everything except contact PII**; **all money open incl. individual pay** | New FR-015–018. Rationale (*pay secrecy enables performer exploitation*) recorded prominently in Overview + `use-cases.md` §4 — it is counter-intuitive and a future reader would otherwise "fix" it. |
| **PII on lookup, names in bulk** | New US4 + FR-017, SC-010. Residual bulk-harvest risk explicitly accepted by the club. |
| **VP ⊇ President** | New FR-010; assignment is President + VP (FR-028–030). Also removes the "last President revoked" lockout edge case. |
| **Treasurer does NOT assign the FS** | FR-030. The "Delegated by" column is reclassified as *nomination*, not authority. |
| **Annual approval is advisory** | New FR-034–037, SC-011; new matrix row 22. |
| **Door Attendant is club-wide** | FR-038 — and **per-event (◍) scope dropped entirely** (FR-006): its only candidate user went club-wide, so it had zero users. Four granularities → **three**. |

### Corrections pushed back into `docs/use-cases.md` (the authoritative source)

The source document **contradicted the club's actual intent in two places**, both now fixed there:

1. **"Door Attendant ✗ `/gate`" was recorded as a total access denial in four places** (§2 role table,
   §3 row 12, §4 "Hard boundary (confirmed) — the one explicit deny nailed down", §5.3.10). It is a
   **write** boundary; reading gate money is open to everyone. This was the document's single most
   emphatic claim.
2. **The matrix stated read authority for almost nothing** — it was a write-owner grid throughout. The
   read rule is now stated once, at the top of §3, rather than left to inference.

### Resolved without spending a clarification

- **Deny semantics.** "✗" means *does not confer*, not *subtracts* (additive union, allow-wins).
  Deny-overrides would strip gate access from an FS who also works the door — routine per §5.2.8. Only one
  reading survives contact with the role model. Documented in Assumptions.
- **Grant storage** (role array vs. dedicated grants table). Deliberately **not** a spec question — a
  design decision for `/speckit-plan`. The spec stays storage-agnostic.

### Carried into `/speckit-clarify` as a flagged assumption

**Which grants carry the PII-read capability.** The user stated the *base* lacks it and that the Door
Attendant has it when matching; they did not enumerate the rest. The spec assumes it rides on every grant
whose use cases need it (Booker→performers, VP/MLM/Secretary→exports, Treasurer/FS→membership) and is
explicit that this is an assumption to confirm. Not a blocker: the threat model — the lapsed short-term
volunteer holding only the base — is excluded under any of the readings.

### Validation iteration 6 — 2026-07-15 (⚠️ a premise falsified during `/speckit-implement`)

**T003 checked the live database and the spec was wrong.** Still 16/16 — the spec was internally consistent
and testable; it was consistent about something untrue, which no checklist item can catch.

**The claim**: "one contact currently holds `administrator`, who becomes a Super-user on rename" (FR-013,
an edge case, an Assumption; copied into research R9, data-model §7, quickstart, plan, and T003/T005/T009).

**The reality**: **zero contacts hold any `volunteer_role`.** `bootstrapOfficer`'s `--role` flag is
optional (`src/server/db/bootstrapOfficer.ts:26`) and feature 015 bootstrapped the one volunteer without
it. The enum's two values have never had a holder.

**Provenance**: I inferred it during `/speckit-specify`. The project context only ever said "1 volunteer" —
never that they held a role. Every later artifact inherited the inference without re-checking it, which is
exactly how a plausible assumption becomes six documents' worth of fact.

**Consequence**: migration 0021's `INSERT … SELECT` moves zero rows, so after it **nobody holds any
grant** — the operator included. Left undiscovered until T009, this would have looked like a broken
migration rather than a correct one meeting an untrue expectation.

**Resolved** (user, 2026-07-15): keep the migration data-driven and **never hardcode a person**; bootstrap
the first Super-user via the CLI as a separate audited step (FR-033 requires that path regardless, and
FR-030a makes it the *only* source of a Super-user). FR-013 rewritten around the real cold start rather
than left vacuously true. Corrected in spec, research R9, data-model §7 + new §7a, quickstart, plan, and
tasks T003/T005/T009.

**Second finding, from checking the first**: T008 removes `volunteerRoles` from the schema while
`bootstrapOfficer.ts:83-86` writes it — a **compile break**. The CLI update was scheduled in Phase 4
(US2), three phases too late. Split: **T010** (role_grants writer, Phase 2, unblocks the build and the
cold start) and **T050** (FR-005a enforcement, stays in US2). Task count 75 → 77.

### Content Quality note

`is_volunteer`, `volunteer_roles`, `administrator`, and `/dev/routes` appear by name. Judged **not**
implementation leakage: each is an existing, user-visible or governance-level artifact this feature must
act on (activate, rename, retire), and `use-cases.md` — the stakeholder-facing source — names them at the
same level. No language, framework, database, or library is named anywhere in the spec.
