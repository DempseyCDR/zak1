# Data Model: Contact Archive & Delete

**One schema change** (migration 0041): a nullable `archived_at` on `contacts`. Everything else uses
existing columns/tables.

## Entity: Contact (`contacts`)

### New column

| Field | Type | Meaning |
|---|---|---|
| `archived_at` | `timestamptz NULL` | Archived ⇔ non-null. Set on archive (`now()`), cleared on restore. Independent of `merged_into_id`. Mirrors `bands.archived_at`. |

### Active-read definition (M-R10)

"Active contact" = `merged_into_id IS NULL AND archived_at IS NULL`. Applied everywhere a merged contact
is already excluded:

| Read | File |
|---|---|
| Search (browse / substring / fuzzy) | `contactService.searchContacts` (3 branches) |
| Needs-review count / list | `contactService.countNeedsReview`, `listNeedsReview` |
| Duplicate candidates + count | `suggestionService.getMergeSuggestions`, `countMergeSuggestions` |
| Mailing-list / contact-tracing exports | `exports/exportService`, `mailingLists`, `contactTracingService` |

`searchContacts` gains an **`includeArchived`** option: when true it drops **only** the `archived_at`
predicate (still excludes merged). `ContactSummary` gains **`archivedAt`** so a result row can be marked
archived.

### State transitions

```text
active ──archive (contact.write)──▶ archived (archived_at set, hidden from active reads)
archived ──restore (contact.write)──▶ active (archived_at cleared)
active|archived ──delete──▶ (removed)   # safe: only if bare; unrestricted: always (super_user)
```

## Delete guard: "bare record" (clarification Q1 = B)

`contactDeleteBlockers(db, id)` → the substantive referencing categories present. A **bare** contact has
none (only its own `contact_emails`). Referencing tables checked:

| Category | Table(s) | FK on contact delete |
|---|---|---|
| Membership | `memberships`, `membership_captures` | set null (would orphan) |
| Attendance | `attendance`, `gate_sales` (door money) | set null (would orphan) |
| Volunteer/staff | `role_grants`, `staff_identities` | cascade (would erase) |
| Officer | `officers` | cascade (would erase) |
| Performer | `performers` (band member links) | set null (would orphan) |
| Venue landlord | `venues.landlord_contact_id` | set null (would orphan) |

Excluded from the guard: `contact_emails` (owned, cascades with the contact — bare is still deletable) and
audit rows (a log; the deletion itself is audited).

## Capabilities (new)

| Capability | Held by | Gates |
|---|---|---|
| `contact.delete` | mailing_list_manager, super_user (superset) | the safe delete (bare-record) |
| `contact.delete.unrestricted` | super_user only | bypassing the guard (delete regardless of references) |
| `contact.write` (existing) | mailing_list_manager, door_attendant, super_user | archive / restore |

`GET /api/me/capabilities` gains `contactWrite`, `contactDelete`, `contactDeleteUnrestricted` for UI
gating (which action buttons to show); the server still enforces on every route + in `deleteContact`.

## Audit (FR-010)

Every permanent deletion writes a `contact.delete` audit event (detail distinguishes safe vs.
unrestricted), mirroring the existing `contact.merge` audit. Archive/restore are ordinary contact
updates.
