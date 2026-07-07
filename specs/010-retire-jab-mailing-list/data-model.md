# Phase 1 Data Model: Retire JAB Mailing List; Free-Text Event-Group Category

This change is subtractive; it modifies two existing schema objects and leaves a third deliberately
untouched. No new tables or entities.

## Changed

### `mailing_list_id` enum (in `schema/mailingListExports.ts`)

Backs `mailing_list_exports.list_id`.

| Before | After |
|--------|-------|
| contra, english, openband, specialevents, **janeaustenball**, performer, member, contact_tracing | contra, english, openband, specialevents, performer, member, contact_tracing |

- `janeaustenball` removed. Standing lists 7 → 6 (contra, english, openband, specialevents, performer,
  member); `contact_tracing` stays (event-scoped export id, not a standing list).
- Enforced via type recreation (research Decision 1). The `USING` cast aborts if any existing
  `mailing_list_exports` row references `janeaustenball` (FR-003 guard). None do (verified 2026-07-04).
- No change to `mailing_list_exports` table columns.

### `event_groups.kind` (in `schema/events.ts`)

| Attribute | Before | After |
|-----------|--------|-------|
| Type | `event_group_kind` enum (`double_dance`, `weekend`, `jane_austen_ball`, `other`) | `text` |
| Nullability | `NOT NULL` | nullable (optional) |
| Existing values | snake_case enum | prettified free text (`double_dance` → "double dance") |

- The `event_group_kind` enum **type is dropped** after the column is converted.
- `EventGroupKind` TS union type (derived from the enum) is removed from `enums.ts`.
- The `event_groups` table's other columns (`id`, `name`, `created_at`) and the `group_id` relationship
  from `events` are unchanged; only the *category* is now optional free text.
- Validation moves from a DB/Zod enum to `z.string().trim().min(1).optional()` at the API boundary
  (FR-006, FR-007).

## Unchanged (deliberately retained)

### `email_consent_topic` enum (in `schema/enums.ts`)

Keeps `jane_austen_ball` (FR-009, FR-010). No change to the enum, to `validation/contacts.ts`, or to the
contacts admin surface. Consent remains recordable and visible per email.

## Migration `0015_retire_jab_and_freetext_kind.sql`

Single migration, two independent parts (order between them does not matter):

1. **Mailing list**: rename `mailing_list_id` → `_old`; create it without `janeaustenball`; alter
   `mailing_list_exports.list_id` with the guarding `USING` cast; drop `_old`.
2. **Event-group kind**: `DROP NOT NULL` on `event_groups.kind`; alter type to `text` with
   `USING replace(kind::text, '_', ' ')`; `DROP TYPE event_group_kind`.

Both parts are non-destructive to real data: no rows use `janeaustenball`; existing kind values are
prettified in place, never dropped (FR-008 / SC-004).

## Requirements traceability

| Requirement | Data-model effect |
|-------------|-------------------|
| FR-001, FR-002, FR-003 | Remove `janeaustenball` from `mailing_list_id`; 6 standing lists remain |
| FR-004 | Delete `getMostRecentJabYear` (reads `event_groups.kind` = `jane_austen_ball`) |
| FR-005 | Contact-tracing export path unchanged (no schema effect) |
| FR-006, FR-007 | `event_groups.kind` → nullable `text`; free-text validation |
| FR-008, SC-004 | Existing kind values prettified, not lost |
| FR-009, FR-010 | `email_consent_topic.jane_austen_ball` untouched |
