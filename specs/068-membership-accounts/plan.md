# Implementation Plan: Membership Accounts

**Branch**: `068-membership-updates` | **Date**: 2026-09-04 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/068-membership-accounts/spec.md`

## Summary

Store what the club already does. Dues buy a **household account**, owned by a **payer**, carrying a
**level** (the payer's attribute) and a **validity period** (everyone's). Members are **attached** to the
account, and attachment — not a contact's own history — is what puts someone on the member list.

The data already has this shape: 56 of 154 membership rows have a payer who is not the member, 31 payers
cover several people, level and expiry are perfectly consistent within every group, and every `individual`
and `student` account is already solo. So this is a **normalisation with a data migration**, not a
behavioural redesign — the risk lives in the migration and in the read paths that currently trust a
materialised status column.

Three things ride along: the FS picks the level when recording dues (at the gate or by post), status is
**derived at the point of use** so a year rollover can never leave it stale, and a contact who owns an
account can no longer be deleted out from under it.

## Technical Context

**Language/Version**: TypeScript 5.7 (strict), Node 24

**Primary Dependencies**: Next.js 16 (App Router, `(admin)` / `(door)` route groups), React 19, Drizzle ORM, Zod

**Storage**: PostgreSQL 16. Hand-written SQL migrations applied lexically by `runMigrations`. **0043** adds
the new tables; the data move is a testable routine. The legacy tables are **not** dropped in this feature —
doing so would make the migration test unrunnable (research R9).

**Testing**: Vitest — integration against a real local Postgres (`zak1_test`), plus jsdom component tests.

**Target Platform**: Web (admin + door surfaces, CSV export)

**Project Type**: Web application (single Next.js app; server domain + API routes + React surfaces)

**Performance Goals**: Not a hot path. Club scale — 154 memberships, ~1,900 contacts. The constraint is
that deriving status per use must not become a per-row query in list and export paths.

**Constraints**: The member CSV keeps its existing columns and gains one (level). No scheduler exists, so
nothing may depend on a cron. Gate-reported dues must keep recording money exactly as today; posted dues
record none (feature 038 stands).

**Scale/Scope**: 2 new tables, 1 migration plus a testable data move, ~10 files reading the materialised
status columns, 1 gate-line field, 1 record-editor surface, 1 export column (service **and** route).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment | Status |
|---|---|---|
| **I. Test-First (NON-NEGOTIABLE)** | Every requirement is expressible as an integration test against real Postgres — capacity refusals, renewal moving an expiry, attachment driving the member list, derived status ignoring a stale column, the delete refusal — plus jsdom tests for the record surfaces. The migration gets its own tests asserting no coverage is lost. Tests precede implementation in every phase. | ✅ PASS |
| **II. Simplicity / YAGNI** | The model gets *smaller*: `memberships` + `payers` (two tables, a redundant payer indirection, level duplicated per member) become `membership_accounts` + `membership_members`. No term-history table — clarification chose a durable account with a moving expiry over per-payment terms. No level rank order, because level is the payer's and never contested. No dues price table. | ✅ PASS |
| **III. Type Safety** | New tables typed in the Drizzle schema; request bodies validated with Zod at the boundary; the derived membership view exposed as one typed helper rather than ad-hoc casts at each call site. | ✅ PASS |
| **IV. Observability** | Dues recorded, level changed, member attached/detached, and every status changed by the backfill are durable audit rows via `recordAudit`, following 065/066/067. The migration reports what it created and flagged. | ✅ PASS |

**Testing standard**: integration tests run against a real local Postgres. The migration is exercised for
real — `ensureSchema` runs it — so the reshape is tested by every suite that touches membership.

**Workflow**: multi-contributor mode — feature branch `068-membership-updates`, reviewed PR, no self-merge.

**Post-Phase-1 re-check**: ✅ PASS — the design retires more than it adds, introduces no capability
(FR-017 keeps membership writes with FS/Treasurer/Super-user), and adds no scheduled infrastructure.

## Project Structure

### Documentation (this feature)

```text
specs/068-membership-accounts/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── membership-accounts.md
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
src/server/db/
├── migrations/0043_membership_accounts.sql   # NEW: tables + gate_sales.membership_level (DDL only)
└── schema/memberships.ts                     # accounts + members ADDED; legacy defs retained (R9)

src/server/domain/membership/
├── accountService.ts        # NEW: record dues, attach/detach, change level, capacity rule
├── migrateToAccounts.ts     # NEW: the data move, callable and testable (cf. feature 044)
├── membershipStatus.ts      # NEW: the single derived status/level/coverage source
├── membershipService.ts     # recompute → backfill only; createMembership retired
└── membershipTerm.ts        # unchanged (boundary + 2-month grace)

src/server/domain/
├── door/doorRecordService.ts     # gate dues line carries a level
├── exports/exportService.ts      # member list: attachment-driven, gains level
└── contacts/contactService.ts    # record projection + account delete blocker

src/app/api/
├── memberships/route.ts                    # record dues against the account model
└── contacts/[id]/membership/route.ts       # NEW: attach/detach, level, dues from the record

src/app/(admin)/contacts/
├── _components/MembershipAccount.tsx       # NEW: the account block on a contact record
└── page.tsx                                # renders it, distinct from the 067 shared-email block

src/app/(door)/gate/page.tsx                # level selector on a membership line

tests/
├── integration/membership.accounts.test.ts       # NEW
├── integration/membership.capacity.test.ts       # NEW
├── integration/membership.derivedStatus.test.ts  # NEW
├── integration/membership.migration.test.ts      # NEW
├── integration/exports.memberList.test.ts        # NEW
└── component/contacts.membershipAccount.test.tsx # NEW
```

**Structure Decision**: Existing layout. The genuinely new modules are `accountService.ts` (the write
side) and `membershipStatus.ts` (the single read side) — keeping derivation in one place is what stops
"derive at the point of use" turning into four subtly different derivations.

## Complexity Tracking

> No Constitution Check violations. Table intentionally empty.
