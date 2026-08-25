# Data Model: Org cluster (P7-R12)

Additive migration **`0038_officers.sql`** (latest is `0037`). One new table. Everything else is committed
config (the role registry) or reused (051 content pages, `club_settings`, `contacts`). `IF NOT EXISTS` so
re-run is safe.

## Migration `0038`

```sql
-- Feature 055 (P7-R12): which contact currently holds each board-seat role, for the public board page.
-- One row per board-seat role_key (from the committed club-role registry). The person rotates; the role
-- name/alias/order live in the registry, not here. Names are joined from contacts for public display.
CREATE TABLE IF NOT EXISTS officers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_key    text NOT NULL UNIQUE,
  contact_id  uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
```

Snapshot `zak1_dev` first, then `pnpm run db:migrate`. Add `officers` to the test `resetDb()` TRUNCATE list.

## Drizzle schema

- `src/server/db/schema/officers.ts` (NEW): mirror the table; export `officers` + `OfficerRow`. Export from
  the schema index.

## Committed registry (not a table)

### Club role — `src/server/domain/org/clubRoles.ts`

```ts
export type ClubRole = {
  key: string;         // stable id, e.g. "vice_president", "treasurer", "contra_booking"
  roleName: string;    // display, e.g. "Vice President"
  emailAlias: string;  // e.g. "vicepresident@cdrochester.org"
  isBoardSeat: boolean;// true → shown on the board page with its officer
  order: number;       // display order (both pages)
};
export const CLUB_ROLES: readonly ClubRole[] = [ /* president, vice_president, treasurer, secretary,
   contra_booking, english_booking, membership, webmaster, … — full list from audit §data-6 */ ];
export const BOARD_ROLES = CLUB_ROLES.filter((r) => r.isBoardSeat).sort((a,b)=>a.order-b.order);
export function isRoleKey(k: string): boolean; // guard the admin write
```

- **Validation** (unit): every `emailAlias` matches `^[a-z0-9._-]+@cdrochester\.org$` (a club role alias, not
  arbitrary/PII); keys are unique; `order` unique.

## Entities

### Officer (row = one board-seat assignment)

| Field | Type | Rule |
|-------|------|------|
| `roleKey` | text unique | MUST be a key in `CLUB_ROLES` where `isBoardSeat` (validated at write) |
| `contactId` | uuid | FK → contacts (cascade); the person holding the office |

One row per role_key (unique) → at most one current holder per office. Assigning again upserts.

### Public projections (derived, no PII)

```ts
// Contact directory (from the registry only)
type PublicAlias = { roleName: string; emailAlias: string };

// Board page (registry board-seats ⋈ officers ⋈ contacts)
type PublicOfficer = { roleName: string; emailAlias: string; name: string | null };
```

- `name` = the contact's display name (first + last); **never** email/phone/other contact fields. `null` when
  the seat is unassigned (render role + alias, no person).
- **PII invariant**: `listBoardOfficers` SELECTs only `contacts.first_name` / `last_name` (+ `display_name`);
  the projection type has no contact-PII field, so a renderer cannot leak it (053-style gate).

### Reused / config (no schema change)

- **051 content page** `contact-info` — the curated block below the alias list (published-only via
  `getContentPageBySlug` + `renderMarkdown`). `contact` and `board` added to `RESERVED_SLUGS`.
- **`club_settings.membership_year_end`** (`08-31`) — the single source for the displayed membership year;
  the "PLACEHOLDER" caveat comment is removed (FR-003).
- **Membership tiers** — page content on `/join` (not modeled): Supporter $50+, Family $30, Individual $20,
  Student $10.

## Audit

- New `AuditEvent` kind `officer.set`. `setOfficer` calls `recordAudit(db, { kind, actorContactId, details:
  { roleKey, contactId } })` — an `audit_events` row per assignment (Observability).

## Lifecycle

- Officer rows are upserted per `role_key` (reassign replaces the holder); clearing a seat deletes the row.
- No lifecycle on the registry (code) or the CMS block (051 owns its draft/publish).
