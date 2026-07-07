# Implementation Plan: Retire Jane Austen Ball Mailing List; Free-Text Event-Group Category

**Branch**: `010-retire-jab-mailing-list` | **Date**: 2026-07-07 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/010-retire-jab-mailing-list/spec.md`

## Summary

Two decoupled cleanups from Phase 2 item P2-1. **(1)** Remove the redundant Jane Austen Ball (JAB)
*standing mailing list* — drop `janeaustenball` from the `mailing_list_id` enum, its registry entry, its
Zod value, and the "most recent JAB year" derivation that existed only to annotate it — leaving six
standing lists plus the unchanged event-scoped contact-tracing export (the intended path to augment the
external iContact JAB list). **(2)** Convert `event_groups.kind` from the fixed `event_group_kind` enum
to optional free text, prettifying the handful of existing dev/seed values (`double_dance` → "double
dance"). The `jane_austen_ball` **email consent topic** is deliberately retained and untouched; the
three JAB-named concepts stay distinct (consent topic kept; mailing list + fixed kind removed). No
production data migrates (JAB "last year attended" lives in iContact; no `mailing_list_exports` rows
reference the JAB list — verified in dev 2026-07-04).

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js LTS (24.x), strict mode (existing project).

**Primary Dependencies**: Next.js (App Router, RSC), Drizzle ORM, Zod, pino. Retrofits feature 006
(iContact export: `mailingLists.ts`, `exportService.ts`, `/api/exports`) and feature 002 (event groups:
`event_groups` schema, `eventGroupCreateSchema`, events admin UI). No new external dependency.

**Storage**: PostgreSQL 16. Enum change: recreate `mailing_list_id` without `janeaustenball`. Column
change: `event_groups.kind` `event_group_kind` enum → nullable `text`, then `DROP TYPE
event_group_kind`. `email_consent_topic` (incl. `jane_austen_ball`) is **unchanged**. One new migration
`0015_retire_jab_and_freetext_kind.sql` (0014 is the latest today).

**Testing**: Vitest against the real `zak1_test` database (no mocking of Postgres — existing pattern).
Every test referencing `janeaustenball`, `getMostRecentJabYear`, `eventGroupKindEnum`, or the fixed kind
values is updated, not left incidentally green.

**Target Platform**: Linux server (Node). Two admin surfaces touched: the exports page (one fewer list)
and the events page (event-group kind dropdown → free-text input).

**Performance Goals**: None specified; single-club scale — not a design constraint. This change net
*removes* a per-request DB query (`getMostRecentJabYear`) from the exports listing.

**Constraints**: The `mailing_list_id` enum recreation MUST fail loudly if any `mailing_list_exports`
row still references `janeaustenball` (the `USING list_id::text::mailing_list_id` cast enforces this) —
matching FR-003 and the edge case. No production data may be lost (FR-008/SC-004): existing event-group
categories are prettified, never blanked.

**Scale/Scope**: Single tenant. Standing mailing lists 7 → 6. `event_group_kind` enum (4 values) → free
text. ~8 source files + 1 migration + test updates. No new routes (dev route index unchanged).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Test-First (NON-NEGOTIABLE)**: PASS — behavior changes are covered by updating existing
  integration tests (exports listing now yields 6 lists; event-group creation accepts free text and
  rejects nothing from a fixed set; JAB consent topic still settable) against real Postgres, and by a
  migration-guard test that a stray `janeaustenball` export row would block the enum recreation. Tests
  are updated/added before the code and migration land.
- **II. Simplicity / YAGNI**: PASS — this is a net simplification: an enum value, a derived function
  (`getMostRecentJabYear`), a registry entry, and a fixed-value constraint are all *removed*. Converting
  `kind` to free text drops an enum rather than adding structure. No new abstraction is introduced.
- **III. Type Safety**: PASS — `mailing_list_id` remains a real Postgres enum with a matching Zod
  `listIdSchema`; `event_groups.kind` becomes validated free text (`z.string().trim().min(1).optional()`)
  at the API boundary. No new `any`/`as`. The `EventGroupKind` union type is deleted along with its enum.
- **IV. Observability**: PASS — no logging/audit changes; the export audit trail (`mailing_list_exports`)
  is untouched aside from the enum narrowing. Removing `getMostRecentJabYear` removes only a read path.

**Initial gate: PASS. No violations — Complexity Tracking left empty.**

## Project Structure

### Documentation (this feature)

```text
specs/010-retire-jab-mailing-list/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── api-deltas.md
├── checklists/
│   └── requirements.md  # from /speckit-specify + /speckit-clarify
└── tasks.md             # /speckit-tasks (not created here)
```

### Source Code (repository root) — edits to existing files

```text
src/
├── app/
│   ├── (admin)/
│   │   ├── events/page.tsx              # event-group kind <select> → free-text <input> (optional)
│   │   └── exports/page.tsx             # JAB row/note gone (list shrinks to 6); drop `note` rendering
│   └── api/
│       └── exports/route.ts             # remove getMostRecentJabYear import/call + `note` field
├── server/
│   ├── db/
│   │   ├── schema/
│   │   │   ├── mailingListExports.ts    # mailingListIdEnum: remove "janeaustenball"
│   │   │   ├── events.ts                # eventGroups.kind: eventGroupKindEnum → text(), nullable
│   │   │   └── enums.ts                 # DROP eventGroupKindEnum + EventGroupKind type; KEEP jane_austen_ball in emailConsentTopicEnum
│   │   ├── migrations/
│   │   │   └── 0015_retire_jab_and_freetext_kind.sql   # NEW — recreate mailing_list_id enum; kind enum→text+prettify; drop event_group_kind
│   │   └── seed.ts                      # drop JAB "most recent year" seed intent; kind becomes free text
│   ├── domain/
│   │   └── exports/
│   │       ├── mailingLists.ts          # MAILING_LISTS: remove janeaustenball entry (→ 6)
│   │       └── exportService.ts         # DELETE getMostRecentJabYear
│   └── validation/
│       ├── exports.ts                   # listIdSchema: remove "janeaustenball"
│       └── door.ts                      # eventGroupCreateSchema.kind: z.enum(...) → z.string().trim().min(1).optional()
└── (KEEP unchanged: validation/contacts.ts + app/(admin)/contacts/page.tsx jane_austen_ball consent topic)
```

**Structure Decision**: Continue the single Next.js project; this is a subtractive retrofit of features
006 and 002, so no new folders or modules. The event-group category validation stays where it already
lives (`validation/door.ts`, alongside `eventGroupCreateSchema`) rather than being relocated — moving it
would be churn unrelated to this change. The dev route index (`src/app/dev/routes/page.tsx`) needs no
update because no routes are added or removed.

## Complexity Tracking

> No constitution violations — section intentionally empty.
