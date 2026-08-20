# Implementation Plan: Contact Load — replace contacts from iContact + membership import

**Branch**: `contact_load` | **Date**: 2026-08-20 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/044-contact-load/spec.md`

## Summary

A one-time, re-runnable operator CLI that hard-resets the contact roster from two operator-supplied
files. It retains only contacts holding an explicit role grant, deletes the rest, and rebuilds the
roster as the union of an iContact export (emails + consent) and a membership workbook's Member sheet
(structured identity, matched by email; Member wins for name/pronouns/phone). It imports email consent
permissions, memberships with a new membership **level**, sets volunteer eligibility from the sheet, and
proposes performer↔contact links for human confirmation. The run is preview-first (dry-run), backed by a
`pg_dump`, executed in a single transaction, and ends with an audit summary of counts.

Technical approach: all inputs are consumed as **CSV** (iContact is already CSV; the workbook's Member
and Payer sheets are exported to CSV by the operator — see research.md), parsed and validated at the
boundary with **zod**, transformed into typed domain rows, and written through the existing
`domain/contacts`, `domain/membership`, `domain/dedup`, and `domain/performers` services inside one
Drizzle transaction. The hard-reset delete accounts for RESTRICT foreign keys (FR-021): before deleting,
`audit_events.actor_contact_id` and `role_grants.granted_by` are nulled for deletion targets, and
contacts referenced by the NOT-NULL `merge_audit` are folded into the retained set. One migration
(`0033`) adds a `membership_level` enum + `memberships.level` column.
No HTTP surface — the tool is a `tsx` script in the operator-tooling family (`db:*`, `auth:bootstrap`).

## Technical Context

**Language/Version**: TypeScript 5.x (strict) on Node 24, run via `tsx`.

**Primary Dependencies**: Next.js 16 (app; unaffected here), Drizzle ORM 0.36 + `postgres` 3.4, `zod`
3.24 (boundary validation), **`csv-parse`** (new — RFC-4180 CSV with quoted fields; see research.md).

**Storage**: PostgreSQL (local real instance for tests, per constitution). Tables touched: `contacts`,
`contact_emails`, `role_grants` (read-only for retention), `payers`, `memberships`, `performers`.

**Testing**: Vitest — `tests/integration/*` against real Postgres (no DB mocking), `tests/unit/*` for
pure parsers/mappers.

**Target Platform**: Operator workstation / server shell (same environment as `pnpm db:migrate`).

**Project Type**: Web app with a server-side operator CLI (single project; `src/server/**`).

**Performance Goals**: Batch, not interactive. Must complete a full load of the real dataset
(~thousands of iContact rows, ~160 members, ~116 payers) in a single transaction within a couple of
minutes. No throughput SLA.

**Constraints**: Destructive → mandatory `pg_dump` backup before writes; single all-or-nothing
transaction; operator-only (no route); dry-run must write nothing; structured audit row + log summary.

**Scale/Scope**: One migration, one new CLI entry, ~4–6 new modules (parsers, mappers, planner,
executor), reusing existing contact/membership/dedup/performer services. Input volume bounded by the
club roster; fits comfortably in memory.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment |
|-----------|------------|
| **I. Test-First (NON-NEGOTIABLE)** | PASS (planned). Integration tests written first against real Postgres: retention (role-grant survives; non-role removed incl. cascaded login identity; RESTRICT-ref handling per FR-021 — nullable audit/grant refs nulled, merge parties retained), union merge + Member-wins precedence, multi-email dedup by name key, consent mapping (`1` vs blank/`-1`, JAB year, universal contact-tracing), membership + level + status recompute, volunteer flag, performer-match proposals, dry-run writes nothing, atomic rollback on failure. Unit tests for pure parsers/mappers (date formats, comma-year, name derivation). |
| **II. Simplicity / YAGNI** | PASS. CSV-only pipeline (no spreadsheet-parsing dependency); reuse `deriveContactNames`, `recomputeContactStatus`/`refreshAllStatuses`, `createPayer`/`createMembership`, dedup name key, and existing performer service rather than new abstractions. One migration, one enum. No generic "import framework" — a single purpose-built loader. Amount/Method dropped. |
| **III. Type Safety** | PASS. `zod` schemas validate each CSV row at the boundary and convert to typed domain objects before any use (constitution §III). No `any`; strict tsc. New enum is a `pgEnum` mirrored as a TS union. |
| **IV. Observability** | PASS. The run emits a structured summary and writes an `audit` row (who/when/counts) via `writeAudit`, consistent with `bootstrapOfficer`. Errors surface with context and roll back. No ad-hoc prints in shipped code paths beyond the CLI's own operator-facing report. |

**Development Workflow**: Multi-contributor mode (constitution v1.3.0 — activated once a second
contributor, Zak, landed work). This feature is developed on the `contact_load` branch and lands via a
**PR that requires review before merge**; self-merging to `main` is not permitted. The PR must carry
passing tests, no lint errors, and this Constitution Check sign-off (all satisfied). No Complexity
Tracking entries required (no violations).

## Project Structure

### Documentation (this feature)

```text
specs/044-contact-load/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── contact-load-cli.md   # CLI contract (flags, exit codes, audit summary shape)
├── checklists/
│   └── requirements.md  # Spec quality checklist (from /speckit-specify + /speckit-clarify)
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
src/server/
├── db/
│   ├── migrations/0033_membership_level.sql        # new: membership_level enum + memberships.level
│   ├── schema/enums.ts                             # +membershipLevelEnum
│   ├── schema/memberships.ts                       # +level column
│   └── contactLoad.ts                              # new: CLI entrypoint (tsx), arg parsing, dry-run/backup/txn orchestration
├── domain/
│   └── contactLoad/                                # new domain module
│       ├── parseIcontact.ts                        # CSV → validated iContact rows (zod)
│       ├── parseMemberSheet.ts                     # CSV → validated Member rows (zod)
│       ├── parsePayerSheet.ts                      # CSV → validated Payer rows (zod)
│       ├── buildRoster.ts                          # union + dedup + Member-wins precedence → planned contacts/emails
│       ├── mapConsent.ts                           # list flags/JAB/contact-tracing → consent_topics
│       ├── buildMemberships.ts                     # payers + memberships + level + payer→contact link
│       ├── matchPerformers.ts                      # propose performer↔contact links
│       └── loadPlan.ts                             # types: LoadPlan, LoadCounts (dry-run report + executor input)
└── (reused) domain/contacts/normalize.ts, domain/membership/membershipService.ts,
             domain/dedup/*, domain/performers/*, lib/audit.ts, lib/loadEnv.ts, db/client.ts

tests/
├── integration/contactLoad.*.test.ts              # real-Postgres: retention, roster, consent, membership, dry-run, rollback, performers
└── unit/contactLoad.*.test.ts                      # pure: parsers, date formats, comma-year, consent mapping, name derivation

package.json                                        # +"contacts:load" script (tsx contactLoad.ts); +csv-parse dep
```

**Structure Decision**: Single-project layout under `src/server`. The loader is a server-side operator
CLI in the existing `db:*` / `auth:bootstrap` family (a `tsx` entrypoint at `src/server/db/contactLoad.ts`
invoked via a `pnpm contacts:load` script), with pure/testable logic factored into a new
`domain/contactLoad/` module and all persistence delegated to existing domain services. No frontend and
no HTTP route (FR-017).

## Complexity Tracking

> No Constitution Check violations — table intentionally empty.
