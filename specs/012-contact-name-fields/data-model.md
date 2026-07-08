# Phase 1 Data Model: Contact Name Fields

## Changed entity: `contacts`

### New columns

| Column | Type | Notes |
|--------|------|-------|
| first_name | text **NOT NULL** | required (FR-001) |
| last_name | text NULL | optional — dancers may decline one (FR-001) |
| display_name_override | text NULL | raw override; when non-blank it is the effective display name |
| pronouns | text NULL | optional free text (FR-005) |
| dedup_normalized | text **NOT NULL** | `normalizeName(trim(first + " " + last))` — dedup key (FR-006) |

### Repurposed existing columns

| Column | Before | After |
|--------|--------|-------|
| display_name | user-entered name | **materialized effective display name** = `override` (if non-blank) else `trim(first + " " + last)`; recomputed on write |
| name_normalized | `normalize(display_name)` | `normalize(effective display name)` — **search** key (unchanged role) |

### Derived values (one helper, computed on every create/edit)

`deriveContactNames({ firstName, lastName?, displayNameOverride? })` →

- `displayName` = `displayNameOverride?.trim()` if non-empty, else `trim(firstName + " " + (lastName ?? ""))`
- `nameNormalized` = `normalizeName(displayName)` — search
- `dedupNormalized` = `normalizeName(trim(firstName + " " + (lastName ?? "")))` — dedup (ignores override)

### Indexes

- Existing `gin_trgm_ops` index on `name_normalized` (search) — unchanged.
- **New** `gin_trgm_ops` index on `dedup_normalized` (dedup).

## Resolution / behavior rules

- **Effective display name** (FR-002): override if set, else `first last` trimmed → single-name contacts
  show just the first name.
- **Duplicate detection** (FR-006): pg_trgm similarity on `dedup_normalized` (first+last, override-immune;
  first alone when last blank).
- **Search** (FR-006): pg_trgm similarity on `name_normalized` (effective display name).
- **Check-in roster** (FR-007): orderable by `last_name, first_name`; member buttons show `display_name`.
- **Mailing-list export** (FR-009): First/Last columns from `first_name`/`last_name` (blank last → blank
  Last Name cell).

## Migration `0017_contact_names.sql`

1. `ALTER TABLE contacts ADD COLUMN first_name text, last_name text, display_name_override text,
   pronouns text, dedup_normalized text;`
2. Backfill existing rows (dev/seed only; prod is fresh):
   `UPDATE contacts SET first_name = display_name, dedup_normalized = name_normalized WHERE first_name IS NULL;`
   (last_name/override/pronouns stay NULL → effective display, search, and dedup are byte-identical.)
3. `ALTER TABLE contacts ALTER COLUMN first_name SET NOT NULL; ALTER COLUMN dedup_normalized SET NOT NULL;`
4. `CREATE INDEX contacts_dedup_trgm ON contacts USING gin (dedup_normalized gin_trgm_ops);`

## Validation changes

- **`contactCreateSchema`**: replace `displayName` with `firstName: z.string().trim().min(1)` (required),
  `lastName: z.string().trim().min(1).optional()`, `displayNameOverride: z.string().trim().min(1).optional()`,
  `pronouns: z.string().trim().min(1).optional()`. Email/phone unchanged.
- **`contactPatchSchema`**: `firstName`/`lastName`/`displayNameOverride`/`pronouns` all optional
  (recompute derived when any name field changes; `null` clears last/override/pronouns).
- **Attendance new-contact input** (door): the single entered name becomes `firstName`.

## Requirements traceability

| Requirement | Model effect |
|-------------|--------------|
| FR-001 | `first_name` NOT NULL, `last_name` nullable |
| FR-002 | `display_name` = override ?? trim(first+last) |
| FR-003, FR-004 | `display_name_override` column; derive helper recomputes on edit |
| FR-005 | `pronouns` column |
| FR-006 | `dedup_normalized` (dedup) vs `name_normalized` (search) |
| FR-007 | roster `ORDER BY last_name, first_name` |
| FR-008, FR-010 | `display_name` stays the effective value for all readers |
| FR-009 | export reads `first_name`/`last_name` |
