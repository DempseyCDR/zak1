# Implementation Plan: Consistent structured name capture when creating a performer (R5-P1)

**Branch**: `026-structured-name-capture` (solo-maintainer mode, constitution v1.3.0 — one atomic commit to
`main`) | **Date**: 2026-07-31 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/026-structured-name-capture/spec.md`

## Summary

Performer creation is the **only** runtime route that writes a `contacts` row from a single free-typed name —
it stores the whole name in `first_name` (`createPerformer` does `firstName: input.displayName`), while the
contacts directory (012) and door check-in (017) already capture structured **first / last / display**. This
feature aligns performer creation to that same shape: the create input becomes structured
(`firstName` + optional `lastName` + optional `displayNameOverride`, or an existing `contactId` to link), the
auto-created contact is built with the existing `deriveContactNames` helper, and the performer's own display
name is **derived** (from those names on the create path, or from the linked contact on the link path) instead
of free-typed. **No schema change, no migration** — `contacts` already has `first_name`/`last_name`/
`display_name_override`/`display_name`/`name_normalized`/`dedup_normalized`; this is a capture/contract fix.
The two staff surfaces that create a brand-new performer (the performers directory and the booking
add-performer step) gain structured name fields. Back-filling existing mis-split contacts is **R5-P2**
(separate) and is out of scope here.

## Technical Context

**Language/Version**: TypeScript 5.7 (strictest) · Node 24 · pnpm

**Primary Dependencies**: Next.js 16.2.10 (App Router, RSC) · React 19.2 · Drizzle · Zod. **No new runtime
dependency.**

**Storage**: PostgreSQL 16. **No migration** — no schema change. Uses existing `contacts`
(`first_name`, `last_name`, `display_name_override`, `display_name`, `name_normalized`, `dedup_normalized`) and
`performers` (`display_name`, `contact_id`).

**Testing**: Integration (node, real Postgres) — `createPerformer` structured create (first/last/display →
structured contact + derived display), mononym (last omitted), display override (structured dedup key
preserved), link-existing-contact (no new contact; performer display from the contact), and the
contactId-XOR-firstName validation. Component (jsdom, 020 harness) — the performers-page create form and the
booking add-performer step present + post structured names.

**Target Platform**: Web, single tenant, staff performer/booking surfaces.

**Project Type**: Next.js App Router monolith; domain under `src/server/`, UI under `src/app/`.

**Performance Goals**: Admin-scale; a single insert path. Trivial.

**Constraints**: Reuse the **exact** structured-name shape (`deriveContactNames`, 012) — do not invent a new
one; a performer-created contact must be indistinguishable in data from a door/directory contact. Last name
optional (mononym). Touch **no existing records** (backfill is R5-P2). Existing suite stays green.

**Scale/Scope**: 1 validation-schema change (structured + a refinement), ~1 service change (`createPerformer`),
2 create surfaces (performers page + booking add-performer), and the `makePerformer` test factory adapted to
the new input. No migration.

## Constitution Check

*GATE: Must pass before Phase 0. Re-check after Phase 1.* Constitution v1.3.0 (principles I–IV).

| Principle | Verdict |
|---|---|
| **I. Test-First** | **PASS** — each rule lands test-first against real Postgres: structured create → structured contact + derived display; mononym; display-override keeps the structured dedup key; link-existing-contact; the contactId-XOR-firstName refusal. The two create surfaces get jsdom component tests. |
| **II. YAGNI** | **PASS** — reuses `deriveContactNames` (012) verbatim; no new table, no migration, no new pattern. The only change is the input contract + the two forms. Backfill deliberately deferred to R5-P2. |
| **III. Type Safety** | **PASS** — the new create input is Zod-validated with a refinement (**link a contact XOR create with a first name**); last name optional; no `any`. |
| **IV. Observability** | **PASS** — no new logging surface; `createPerformer` keeps its current behavior (it is not an audited path today, and this feature adds no security-relevant mutation). |

**Development Workflow**: solo-maintainer mode — one atomic commit to `main`, full local gate as the reviewer.
Complies.

### Post-Design Re-Check

Re-evaluated after Phase 1: **still PASS.** No schema/migration, one reused helper, one contract change with a
clear refinement; the test-factory adaptation keeps the existing suite meaningful (and upgrades its data to
structured names).

## Project Structure

### Documentation (this feature)

```text
specs/026-structured-name-capture/
├── plan.md              # This file
├── research.md          # R1..R5 (decisions)
├── data-model.md        # no persistent change — the create operation's structured population + validation
├── quickstart.md        # per-story validation
├── contracts/
│   └── performer-create.md   # POST /api/performers structured input + behavior
├── checklists/requirements.md  # complete (from /speckit-specify)
└── tasks.md             # /speckit-tasks (NOT created here)
```

### Source Code (repository root)

```text
src/
├── server/
│   ├── validation/performers.ts   performerCreateSchema: replace single `displayName` with
│   │                              `firstName` + `lastName?` + `displayNameOverride?`; refine contactId XOR firstName
│   └── domain/performers/performerService.ts   createPerformer: build the new contact via deriveContactNames;
│                                               derive performer.displayName (create) or read it from the linked
│                                               contact (link path)
└── app/
    ├── (admin)/performers/page.tsx           create form → first / last / display fields
    └── (admin)/_modals/BookingModal.tsx      add-performer "create brand-new" → first / last / display fields
tests/
└── integration/helpers/factories.ts          makePerformer adapts its convenience string → structured input
```

**Structure Decision**: No structural change — the established monolith. Work is a validation-contract change,
a service change reusing the 012 helper, two form updates, and a test-factory adaptation. No migration.

## Complexity Tracking

> No constitution deviation. One noted ripple: `performerCreateSchema` is a **breaking input-contract change**
> (single `displayName` → structured), so every caller is updated in the same commit — the two UI create
> surfaces and the `makePerformer` factory (which splits its convenience string into first/last so the existing
> suite keeps passing and now produces structured contacts). This is churn, not complexity; no new abstraction.
