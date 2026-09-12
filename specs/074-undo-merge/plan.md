# Implementation Plan: Undo merge

**Branch**: `074-undo-merge` | **Date**: 2026-09-11 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/074-undo-merge/spec.md`

## Summary

A merge records how *much* moved, not *what* moved, and in five places it destroys or overwrites data
leaving no trace. Both are fixed by making the merge write a **reversal manifest** — the primary-key tuple
of every row it re-links, the full prior content of every row it destroys, the prior value of every field
it overwrites, and the identity of every row it creates — inside the merge's own transaction. An undo
replays that manifest backwards.

Reversibility begins at this feature. A merge with no manifest is un-reversible and says so; there is no
backfill, and `reversal_manifest IS NULL` is the whole test.

Two facts found in the schema during Phase 0 widened the design past what the requirements session
assumed. `membership_members` has a **composite** primary key and no `id` column, so rows cannot be
identified by id and the classification in `contactReferences.ts` must state each table's key. And
`membership_members.account_id` **cascades**, so deleting the discarded membership account silently
destroys household rows that no statement in the merge names — a fifth destruction, on top of D2's four.

The undo itself is best-effort per entry and all-or-nothing as a whole: an entry whose row has since gone,
or whose slot is now occupied, or which the actor lacks authority to perform, is skipped with a reason and
reported; everything else commits together.

## Technical Context

**Language/Version**: TypeScript 5.7 (strict), Node 24, pnpm

**Primary Dependencies**: Next.js 16 (App Router), Drizzle ORM, Zod

**Storage**: PostgreSQL 16. Hand-written SQL migrations in `src/server/db/migrations/`, applied lexically.
Next migration number is **0047**

**Testing**: Vitest — real-Postgres integration tests (`tests/integration/`) plus jsdom component tests

**Target Platform**: Node server; development on localhost, no deployment yet

**Project Type**: Web service with an admin UI (single Next.js app)

**Performance Goals**: Not a factor. Club scale — ~900 contacts, 36 merges in total history. The largest
merge moves a few dozen rows, so a manifest is a few kilobytes and an undo is a few dozen statements

**Constraints**: The manifest MUST be written in the merge's existing transaction (FR-005) — a merge that
commits without a complete manifest must be impossible. The undo is one transaction (FR-019). Two partial
unique indexes constrain the order of operations inside it (research R5)

**Scale/Scope**: 11 moved references to name by primary key, 5 destructive operations to snapshot, 1 new
table, 1 new jsonb column, 2 new API routes, 1 new UI surface on the contact record

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Assessed against constitution **v1.4.0** (amended 2026-09-11, this session).

| Principle | Assessment |
|---|---|
| **I. Test-First (NON-NEGOTIABLE)** | PASS — every behaviour here is testable against a real database, and the shape invites it: merge, assert the manifest, undo, assert the world is as it was. The skip paths (row gone, slot occupied, not authorized) are each reachable by arranging the database and are written as failing tests first. |
| **II. Simplicity / YAGNI** | PASS, and worth noting **why it now passes when it did not before**: feature 072's clarification Q2 explicitly *rejected* recording moved identifiers, on this principle, because the undo did not exist. It exists now, so the recording is required by a shipping requirement rather than anticipated. No speculative generality is added — one jsonb column, one table, no abstraction layer over the manifest. |
| **III. Type Safety** | PASS — the manifest is a discriminated union over entry kinds, parsed with Zod on read so a manifest written by an older shape cannot be silently misread. Primary-key columns join the existing typed `contactReferences` constant, so a renamed column fails to compile. |
| **IV. Observability** | PASS — the undo writes its own append-only record naming actor, merge and every skipped entry with a reason (FR-021), and emits a structured audit event like every other contact mutation. |

**Development Workflow (v1.4.0)**: single-contributor mode. Branch `074-undo-merge` exists; work lands by
PR; the author merges it; the full gate suite is the only reviewer and no gate may be skipped.

**Result: no violations.** Complexity Tracking is therefore empty and omitted.

## Project Structure

### Documentation (this feature)

```text
specs/074-undo-merge/
├── plan.md              # This file
├── research.md          # Phase 0 output — 10 decisions
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── undo-merge.md    # Phase 1 output — route contracts
├── checklists/
│   └── requirements.md  # /speckit-specify output
└── tasks.md             # /speckit-tasks output — NOT created here
```

### Source Code (repository root)

```text
src/server/db/
├── migrations/0047_merge_reversal.sql      # NEW — manifest column + merge_reversals table
└── schema/audit.ts                          # merge_audit gains reversalManifest; + mergeReversals

src/server/domain/dedup/
├── contactReferences.ts                     # each `move` entry gains its primary-key columns
├── mergeManifest.ts                         # NEW — manifest types, Zod schema, builder
├── mergeService.ts                          # records the manifest as it works
├── unmergeService.ts                        # NEW — the reversal
└── mergeHistoryService.ts                   # NEW — history + reversibility verdict (R9)

src/server/validation/dedup.ts               # undo request schema

src/app/api/dedup/merges/
├── route.ts                                 # NEW — GET history for a contact
└── [id]/undo/route.ts                       # NEW — POST the reversal

src/app/(admin)/contacts/                    # merge history + undo control on the contact record

tests/integration/
├── dedup.mergeManifest.test.ts              # NEW — the merge records what it did
├── dedup.unmerge.test.ts                    # NEW — the reversal, and every skip path
└── dedup.mergeHistory.test.ts               # NEW — the reversibility verdict
```

**Structure Decision**: the existing single Next.js app. This feature sits entirely inside the established
dedup domain (`src/server/domain/dedup/`), which already holds the merge, the held-merge resolution and
the reference classification. Three new services rather than one because they have genuinely different
jobs and different callers: building a manifest (merge-side), replaying one (undo-side), and judging
whether a merge can be replayed (read-side, shared by both). The route layout follows the existing
`/api/dedup/*` convention.

## Design notes carried into tasks

These are settled by research and must not be re-litigated during implementation:

- **The manifest is written by the merge, not derived afterwards.** `mergeService` already knows what it
  moved — the relink loop returns rows. It changes from `RETURNING 1` to returning the primary key, and
  the collision deletes change from `DELETE` to `DELETE … RETURNING *` so the snapshot is the row itself.
- **`contactReferences.ts` is still the only statement of what a merge touches.** Primary keys go there,
  and the existing parity guard extends to assert that every `move` entry declares one.
- **Order inside the undo is fixed** (research R5) and has a comment saying why, because it looks
  arbitrary and is not: two partial unique indexes make the obvious order abort.
- **The reversibility verdict is one function** used by both the history view and the undo route, and the
  route re-checks inside its transaction (research R9).
- **Skips are per-entry with reason codes** (`gone`, `occupied`, `not_authorized`), never silent.

## Deliberately not in this feature

- The held-merge resolution chooser UI, still unbuilt for all three hold reasons. Tracked in
  `specs/phase-8-requirements/mel-maintenance-remaining.md`.
- Any change to the classification's `move`/`leave` dispositions, or to the hold conditions. Feature 072
  settled both; this feature only adds each moved entry's key.
- Backfilling or reconstructing merges recorded before this feature.
- A one-step "re-merge the other way". After an undo, a re-merge is an ordinary merge.
