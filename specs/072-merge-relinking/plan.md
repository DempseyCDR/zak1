# Implementation Plan: Merge relinking

**Branch**: `072-merge-relink-and-unmerge` | **Date**: 2026-09-11 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/072-merge-relinking/spec.md`

## Summary

A merge moves three tables while twenty-four foreign-key columns reference a contact. This feature
classifies **every** one of them as moved or left, moves the ones that should move, and adds a parity
guard so a new reference cannot be added without being classified (FR-002a) — the drift that already
shipped a live defect once.

Two references cannot simply move. `role_grants` can compound privilege, so a merge that would give the
survivor role-assigning authority, or leave one person holding two mutually exclusive offices, is **held**
under a new reason `role_conflict`. `staff_identities` is unique per contact, so where both records can
sign in the merge is held — and feature 069's existing `two_logins` hold is **corrected**, because today it
moves only the login label and never the account binding that actually grants access.

Finally, the nine records stranded by past merges are repaired, and two adjacent holes that re-create the
same stranding are closed.

## Technical Context

**Language/Version**: TypeScript 5.7 (strict), Node 24, pnpm

**Primary Dependencies**: Next.js 16 (App Router), Drizzle ORM, Zod

**Storage**: PostgreSQL 16. Hand-written SQL migrations in `src/server/db/migrations/`, applied lexically

**Testing**: Vitest — real-Postgres integration tests (`tests/integration/`) plus jsdom component tests

**Target Platform**: Node server; development on localhost, no deployment yet

**Project Type**: Web service with an admin UI (single Next.js app)

**Performance Goals**: Not a factor. Club scale — ~900 contacts, 58 performers, 114 membership accounts,
36 merges in total history. A merge moves at most a few dozen rows

**Constraints**: A merge stays a single transaction. A **held** merge must write nothing but its own hold
row (FR-016), so both new collisions must be detected **before** the transaction opens, as 069's two
already are

**Scale/Scope**: 24 FK columns to classify, 11 to move, 1 new enum value (the only migration),
1 corrected hold resolution, 1 historical backfill delivered as a tested routine

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment |
|---|---|
| **I. Test-First (NON-NEGOTIABLE)** | PASS — every behaviour below lands as a failing integration test first. The relink set, the two hold triggers, the identity rule and the parity guard are all directly testable against a real database. |
| **II. Simplicity / YAGNI** | PASS — clarification Q2 explicitly rejected recording moved identifiers for the not-yet-built undo, on this principle. The parity guard is **not** speculative: FR-002a requires it, and it prevents a defect that has already shipped. No new abstraction is introduced; the classification is one table-driven constant, mirroring `CONTACT_DELETE_BLOCKERS`. |
| **III. Type Safety** | PASS — the classification is a typed constant over Drizzle columns; the new hold reason extends an existing discriminated union. No casts or `any`. |
| **IV. Observability** | PASS — held merges already write an audit row and appear as their own work item; the corrected resolution audits what it moved. |

**Result: no violations.** Complexity Tracking is therefore empty.

## Project Structure

### Documentation (this feature)

```text
specs/072-merge-relinking/
├── spec.md
├── plan.md              # this file
├── research.md          # Phase 0 — decisions and rejected alternatives
├── data-model.md        # Phase 1 — the classification, in full
├── contracts/
│   └── merge-relink.md  # Phase 1 — outcome and resolution shapes
├── quickstart.md        # Phase 1 — how to verify it end to end
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
src/server/
├── db/migrations/0046_role_conflict_hold.sql   # new enum value (the ONLY migration)
├── domain/dedup/
│   ├── mergeService.ts        # the centre: classification, relink, collision detection
│   ├── heldMergeService.ts    # role_conflict authority, resolution, auto-close
│   ├── contactReferences.ts   # NEW — the single classification source of truth
│   └── repairStrandedMerges.ts # NEW — FR-015, a testable routine, not a migration
├── domain/contactLoad/matchPerformers.ts       # FR-014 active-contact predicate
├── auth/signIn.ts                              # FR-013 both branches
└── validation/dedup.ts                         # resolution payloads

tests/integration/
├── dedup.mergeRelink.test.ts      # NEW — US1, the move/leave classification
├── dedup.contactReferences.test.ts # NEW — FR-002a parity guard
├── dedup.heldMerge.test.ts        # extended — role_conflict, corrected sign-in hold
├── auth.protection.test.ts        # extended — FR-013 known-account branch
├── contactLoad.performers.test.ts  # extended — FR-014
└── dedup.repairStranded.test.ts    # NEW — FR-015 chain resolution
```

**Structure Decision**: The existing layout is kept. One new domain module,
`domain/dedup/contactReferences.ts`, holds the classification — the single source of truth that both
`mergeService` and the parity guard read, exactly as `CONTACT_DELETE_BLOCKERS` is shared between the
delete guard and its parity test. Everything else is an extension of a file that already exists.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations. Table intentionally empty.
