# Data Model: Structured name capture when creating a performer

**No persistent schema change, no migration.** Every column already exists (feature 012). This feature changes
**what the create operation writes** and the **input contract**, not the tables.

## Entities used (unchanged columns)

- **`contacts`** — `first_name` (not null), `last_name` (nullable), `display_name_override` (nullable),
  `display_name` (not null, derived), `name_normalized` (derived), `dedup_normalized` (derived). A
  performer-created contact must populate these the **same way** the directory/check-in flows do.
- **`performers`** — `display_name` (not null), `contact_id`. `display_name` becomes **derived**, not
  free-typed.

## The corrected create operation

`createPerformer` now takes structured input and, when it must create a contact, writes:

| Contact field | Source |
|---|---|
| `first_name` | input `firstName` (**not** the whole name) |
| `last_name` | input `lastName` (nullable — mononym allowed) |
| `display_name_override` | input `displayNameOverride` (nullable) |
| `display_name` / `name_normalized` / `dedup_normalized` | `deriveContactNames(...)` — override else "first last" else first; dedup key always from structured "first last", ignoring the override |

Performer `display_name`: `deriveContactNames(...).displayName` on the **create** path; the **linked
contact's** `display_name` on the **link** path (`contactId` given → no contact created).

## Validation (Zod, at the boundary)

- **Create-performer input**: `{ firstName?, lastName?, displayNameOverride?, contactId?, email?, emailPurpose?,
  phone?, bio?, photoUrl? }` with a **refinement**: `contactId` present (link) **XOR** `firstName` present
  (create). `lastName` optional. (Replaces the old required single `displayName`.)

## Invariants preserved / established

- A contact created via performer creation is **indistinguishable** in stored name data from one created at
  the door or in the directory (same `deriveContactNames` output; `dedup_normalized` from structured names, so
  a stage-name override cannot mask a duplicate).
- A performer's `display_name` never disagrees with its contact (derived from the same source).
- **No existing record is modified** (backfill of legacy mis-split contacts is R5-P2).
