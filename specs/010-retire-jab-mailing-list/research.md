# Phase 0 Research: Retire JAB Mailing List; Free-Text Event-Group Category

No open **NEEDS CLARIFICATION** from Technical Context — the stack, patterns, and touch-points are all
established by prior features. This file records the small number of design decisions the change
requires (each is a "how", not an unknown).

## Decision 1 — Remove the `janeaustenball` enum value by recreating the type

**Decision**: In migration `0015`, recreate the `mailing_list_id` enum without `janeaustenball` using
the rename/create/alter/drop pattern:

```sql
ALTER TYPE mailing_list_id RENAME TO mailing_list_id_old;
CREATE TYPE mailing_list_id AS ENUM
  ('contra','english','openband','specialevents','performer','member','contact_tracing');
ALTER TABLE mailing_list_exports
  ALTER COLUMN list_id TYPE mailing_list_id USING list_id::text::mailing_list_id;
DROP TYPE mailing_list_id_old;
```

**Rationale**: PostgreSQL has no `ALTER TYPE ... DROP VALUE`. The `USING list_id::text::mailing_list_id`
cast doubles as the FR-003 safety guard: if any `mailing_list_exports` row still held `janeaustenball`,
the cast would error and abort the migration rather than silently drop data. Dev verification on
2026-07-04 confirmed no such rows exist. `contact_tracing` remains in the enum (it is an event-scoped
export id, not a standing list).

**Alternatives considered**: Leaving the value dormant (rejected — the user explicitly wants full
removal "to reduce future confusion"); a check constraint instead of an enum (rejected — loses the
type-level guarantee and diverges from every other enum in this schema).

## Decision 2 — Convert `event_groups.kind` to nullable `text`, prettifying existing values

**Decision**: Change the column type and drop the enum in the same migration:

```sql
ALTER TABLE event_groups ALTER COLUMN kind DROP NOT NULL;
ALTER TABLE event_groups ALTER COLUMN kind TYPE text USING replace(kind::text, '_', ' ');
DROP TYPE event_group_kind;
```

**Rationale**: `replace(kind::text, '_', ' ')` prettifies the four existing snake_case values
(`double_dance` → "double dance", `jane_austen_ball` → "jane austen ball", etc.); they are already
lowercase, so no additional casing is needed. This matches the clarified decision (Session 2026-07-07)
and the free-text style in the user's examples. Making the column nullable satisfies FR-007 (category is
optional). Low-stakes: the only current rows are dev/seed data (production loads fresh at go-live).

**Alternatives considered**: Verbatim copy (rejected in clarification — leaves ugly snake_case);
blanking to NULL (rejected — needlessly discards the dev/seed categorization).

## Decision 3 — Drop the `note` field from the `/api/exports` listing response

**Decision**: Remove the `getMostRecentJabYear` call and the `note` field from `/api/exports` GET;
update the exports admin page to stop rendering `note`.

**Rationale**: `note` was only ever populated for the `janeaustenball` list ("Most recent JAB: <year>").
With JAB gone it would always be `null`, so it becomes dead surface area. Per YAGNI (Constitution II),
remove it rather than emit a permanently-null field. This also deletes an entire per-request DB query
from the exports page load.

**Alternatives considered**: Keep `note: null` (rejected — dead field); repurpose `note` for other lists
(rejected — no requirement, speculative).

## Decision 4 — Retain the `jane_austen_ball` consent topic verbatim

**Decision**: Make no change to `email_consent_topic` (`enums.ts`), `validation/contacts.ts`, or the
contacts admin page.

**Rationale**: FR-009/FR-010 require the consent topic to persist unchanged; it documents opt-in and
remains available for a future iContact sync (backlog B7). This is the one place the "JAB" name is kept,
and conflating it with the removed list/kind is the exact confusion this feature guards against.

**Alternatives considered**: Removing the consent topic too (rejected — explicitly out of scope and
contrary to FR-009).

## Non-functional posture

Performance, scalability, reliability, security, and observability are all inherited from the existing
system and unaffected — this change is subtractive. No new logging, metrics, or auth surface. Integration
tests run against real Postgres per the project's no-mock rule.
