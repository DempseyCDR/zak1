# Implementation Plan: Mailing-List Manager Authority to Maintain Contacts

**Branch**: `059-mailing-manager-authority` | **Date**: 2026-08-31 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/059-mailing-manager-authority/spec.md`

## Summary

Grant the `mailing_list_manager` role two capabilities, club-wide, in the feature-016 authorization
catalog: **`contact.write`** (new — create/edit the contact record) and **`contact.mailing.write`** as
**`global`** (today it is `scoped`). This is an **authorization-policy change only** — a small,
type-checked edit to `src/server/auth/capabilities.ts` plus authorization tests. No schema, no new
endpoints, no UI (the maintenance UI is a separate feature). The gated operations already exist and
already enforce these capabilities, so granting them is the entire behavioral change.

## Technical Context

**Language/Version**: TypeScript 5.7 (strict), Node 24

**Primary Dependencies**: Next.js 16 (App Router), Drizzle ORM — **not touched**; the change is in the
in-code authorization catalog (`src/server/auth/capabilities.ts`) evaluated by `src/server/auth/can.ts`.

**Storage**: PostgreSQL 16 — **no schema or migration**. Authority is defined in code (feature-016
decision: a DB-driven catalog could grant a capability no handler implements).

**Testing**: Vitest — unit (`tests/unit/authz.can.test.ts`) + real-Postgres integration
(`tests/integration/authz.*.test.ts`).

**Target Platform**: Linux server (the club's web app).

**Project Type**: Web application (single Next.js project; server-side authorization).

**Performance Goals**: N/A — a constant-time map lookup (`CAPABILITIES[role][capability]`); no runtime
cost change.

**Constraints**: The change must be **additive to `mailing_list_manager` only** and must not widen any
other role or cross the governance boundary (no `role.assign`, delete, or membership authority).

**Scale/Scope**: Two catalog entries; the catalog has 10 roles × ~22 capabilities and is exhaustively
type-checked.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Test-First (NON-NEGOTIABLE)** — PASS (planned). Extend the authorization tests **first**: assert
  `mailing_list_manager` now holds `contact.write` (global) and `contact.mailing.write` (global), and
  assert the boundary (still no `role.assign`, delete, membership, etc.). Watch them fail, then edit the
  catalog.
- **II. Simplicity / YAGNI** — PASS. The whole change is two entries in an existing map. No new
  abstraction, service, endpoint, column, or flag. Explicitly **not** building the maintenance UI here.
- **III. Type Safety** — PASS. `CAPABILITIES: Record<Role, Partial<Record<Capability, ScopeMode>>>` is
  exhaustively checked; a malformed entry is a compile error. No new boundary input (no Zod needed).
- **IV. Observability** — PASS. The catalog is code, not a runtime event, so the change itself emits no
  audit row. Contact-record and email/consent writes performed under the new authority continue to emit
  their existing audit rows (`contact.created`, `email.created`, etc.), now attributable to an MLM actor
  (FR-006). Refusals already log via `authz.refused`.

**Result: PASS — no violations, no complexity to justify.**

## Project Structure

### Documentation (this feature)

```text
specs/059-mailing-manager-authority/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (authorization-catalog delta; no DB entities)
├── quickstart.md        # Phase 1 output (validation scenarios)
├── contracts/
│   └── authorization.md # Phase 1 output (capability-matrix contract for the role)
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
src/server/auth/
├── capabilities.ts      # CHANGE: mailing_list_manager gains contact.write:"global";
│                        #         contact.mailing.write "scoped" → "global"
├── can.ts               # unchanged — evaluates the catalog (mode === "global" ⇒ allow everywhere)
└── withAuth.ts          # unchanged — route guard reads can()

src/app/api/contacts/    # unchanged — already gate on contact.write / contact.mailing.write:
├── route.ts             #   POST  requires contact.write
├── [id]/route.ts        #   PATCH requires contact.write
└── [id]/emails/…        #   POST/PATCH require contact.mailing.write

tests/
├── unit/authz.can.test.ts          # ADD: mailing_list_manager capability assertions
└── integration/
    ├── authz.boundaries.test.ts    # ADD/EXTEND: MLM can contact.write + mailing.write; still can't cross boundary
    └── authz.scope.test.ts         # ADD/EXTEND: a series-scoped MLM grant still gets these globally
```

**Structure Decision**: Single web-app project. The only production file touched is
`src/server/auth/capabilities.ts`; everything else that makes the change observable (the `can()`
evaluator, the route guards, the contact endpoints) already exists and is unchanged. Work concentrates
in the authorization tests, per Test-First.

## Complexity Tracking

> No Constitution violations — section intentionally empty.
