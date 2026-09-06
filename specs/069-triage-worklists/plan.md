# Implementation Plan: Triage Mode — Worklists

**Branch**: `069-triage-worklists` | **Date**: 2026-09-05 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/069-triage-worklists/spec.md`

## Summary

Make Mel's two queues finishable. Duplicate rows carry enough to decide; a pair offers all three answers to
the question it poses (merge, link as shared, reject); a rejection sticks until a name changes; and the
merge stops failing at the cases it cannot currently survive.

The queues already exist in the contacts view (feature 060/064), and the merge engine already moves data
and retires the merged contact. So most of this is **additive**: two small tables, a richer projection, and
resolution paths that the merge currently lacks. The separate `/dedup` page is retired — the queue does
everything it did, plus reject.

Two defects surfaced while planning and are folded in, because both are merge correctness and this is the
merge feature:

- **`mergeService` never moves membership accounts.** It still relinks the `memberships`/`payers` tables
  that feature 068 retired, and does nothing with `membership_accounts` / `membership_members`. The next
  merge of an account owner would silently strand that household's account on a retired contact.
- **A second collision, structurally identical to M-R21.** `membership_accounts_payer` is UNIQUE on the
  payer, so merging two account owners cannot naively relink either — exactly the shape of two sign-in
  identities. Both need a decision rather than a constraint violation.

## Technical Context

**Language/Version**: TypeScript 5.7 (strict), Node 24

**Primary Dependencies**: Next.js 16 (App Router, `(admin)` route group), React 19, Drizzle ORM, Zod

**Storage**: PostgreSQL 16 (pg_trgm for the similarity that proposes pairs). Hand-written SQL migrations
applied lexically by `runMigrations`. Next: **0044**.

**Testing**: Vitest — integration against a real local Postgres (`zak1_test`), plus jsdom component tests.

**Target Platform**: Web (admin surfaces)

**Performance Goals**: Not a hot path. The queue is capped at 50 pairs; suppression must not turn that into
a per-pair query.

**Constraints**: The similarity criteria that propose a pair are **unchanged** — no new email or phone
matching. A rejection must lapse through any code path that changes a name, without a clearing hook.

**Scale/Scope**: 2 new tables, 1 migration, merge gains three resolution paths, 1 richer projection, the
contacts-view queue reworked, `/dedup` retired.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment | Status |
|---|---|---|
| **I. Test-First (NON-NEGOTIABLE)** | Every requirement is testable against real Postgres — a rejection suppressing then lapsing on a name change, a held merge changing nothing, an account moving to the survivor, the unique-payer collision — plus jsdom tests for row actions and the three resolutions. Tests precede implementation in every phase. | ✅ PASS |
| **II. Simplicity / YAGNI** | Two tables, both minimal: a rejection carries only what makes it lapse; a held merge only what makes it explicable. No third queue (clarification), no configurable "safely resolvable" rule (derived from the row), no new matching criteria. The net surface **shrinks** — `/dedup` and its page go. | ✅ PASS |
| **III. Type Safety** | New tables typed in the Drizzle schema; request bodies validated with Zod; the merge's three outcomes modelled as a discriminated result rather than a thrown constraint error. | ✅ PASS |
| **IV. Observability** | Rejections, un-rejections, held merges and merge outcomes are durable audit rows via `recordAudit`, following 065–068. The existing `merge_audit` row is retained and extended with what moved. | ✅ PASS |

**Testing standard**: integration tests run against real Postgres, so the UNIQUE indexes that cause both
collisions (`contact_emails_one_login_per_contact`, `membership_accounts_payer`) are exercised for real
rather than assumed.

**Workflow**: multi-contributor mode — feature branch `069-triage-worklists`, reviewed PR, no self-merge.

**Post-Phase-1 re-check**: ✅ PASS — the design adds no speculative structure, introduces no capability
(`dedup.write` and `role.assign` both already exist and are held by the right people), and retires more UI
than it adds.

## Project Structure

### Documentation (this feature)

```text
specs/069-triage-worklists/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── triage.md
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
src/server/db/
├── migrations/0044_triage_worklists.sql   # NEW: dedup_rejections, held_merges
└── schema/dedup.ts                        # NEW: both tables

src/server/domain/dedup/
├── suggestionService.ts    # suppress rejected pairs; richer candidate projection
├── rejectionService.ts     # NEW: reject, un-reject, list rejected
└── mergeService.ts         # move accounts; the two collisions; three outcomes

src/server/domain/membership/
└── accountService.ts       # account transfer used by the merge

src/app/api/dedup/
├── suggestions/route.ts    # richer rows; ?includeRejected
├── merge/route.ts          # returns held vs completed rather than throwing
├── rejections/route.ts     # NEW: POST reject / DELETE un-reject
└── held/route.ts           # NEW: held merges for the needs-review queue

src/app/(admin)/contacts/
├── _components/DuplicatePair.tsx   # NEW: the row + its three resolutions
├── _components/MergeCompare.tsx    # NEW: side-by-side, all emails, survivor choice
└── page.tsx                        # queues rework; held merges in needs-review

src/app/(admin)/dedup/              # RETIRED (page deleted)

tests/
├── integration/dedup.rejections.test.ts      # NEW
├── integration/dedup.mergeAccounts.test.ts   # NEW (the 068 defect)
├── integration/dedup.heldMerge.test.ts       # NEW (M-R21 + account collision)
├── integration/dedup.suggestions.test.ts     # extended: suppression, richer rows
└── component/contacts.duplicatePair.test.tsx # NEW
```

**Structure Decision**: Existing layout. The new modules are `rejectionService.ts` (the suppression rule
in one place) and the two components; `mergeService` grows the resolution logic it currently lacks.

## Complexity Tracking

> No Constitution Check violations. Table intentionally empty.
