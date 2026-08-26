# Data Model: Site-wide announcement banner (P7-R13)

Additive migration **`0039_announcements.sql`** (latest is `0038`). One new table. `IF NOT EXISTS` so re-run
is safe. Add `announcements` to the test `resetDb()` TRUNCATE list.

## Migration `0039`

```sql
-- Feature 056 (P7-R13): the single site-wide announcement banner. Each post inserts a row; the CURRENT notice
-- is the latest by posted_at. Active iff cleared_at IS NULL AND now() < posted_at + (duration_hours * 1 hour)
-- — derived on read, so it auto-expires with no scheduler. Independent of event status (feature 018).
CREATE TABLE IF NOT EXISTS announcements (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  text           text NOT NULL,
  link_label     text,
  link_url       text,
  level          text NOT NULL DEFAULT 'info',        -- 'info' | 'urgent'
  duration_hours integer NOT NULL DEFAULT 24,
  posted_at      timestamptz NOT NULL DEFAULT now(),
  cleared_at     timestamptz,                          -- set when cleared early; NULL = not cleared
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS announcements_posted_at_idx ON announcements (posted_at DESC);
```

Snapshot `zak1_dev` first, then `pnpm run db:migrate`.

## Drizzle schema

- `src/server/db/schema/announcements.ts` (NEW): mirror the table; export `announcements` + `AnnouncementRow`.
  Export from the schema index.

## Entity

### Announcement (row = one post; the latest is "current")

| Field | Type | Rule |
|-------|------|------|
| `text` | text | required, non-empty (the notice) |
| `linkLabel` | text? | required **iff** `linkUrl` present |
| `linkUrl` | text? | absolute `http(s)` URL (validated at write) |
| `level` | text | `info` \| `urgent` (Zod enum) |
| `durationHours` | int | `> 0` (sane cap, e.g. ≤ 720); default 24 |
| `postedAt` | timestamptz | set on post (= the active window start) |
| `clearedAt` | timestamptz? | set when cleared early; NULL otherwise |

**Active predicate** (`isAnnouncementActive(row, now)`): `row.clearedAt == null && now < row.postedAt +
durationHours·1h`. The **current** announcement = the latest row by `posted_at`; the **active** one is that row
iff the predicate holds (else none).

## Public projection (derived, display-safe)

```ts
type PublicAnnouncement = {
  id: string;                                   // for dismissal keying (a new post → new id)
  text: string;
  level: "info" | "urgent";
  link: { label: string; url: string } | null; // http(s) only
};
```

`getActiveAnnouncement(db)` → the current row if active, mapped to `PublicAnnouncement`, else `null`. No
internal columns (posted_at/duration/cleared) reach the client.

## Audit

- New `AuditEvent` kinds `announcement.posted` and `announcement.cleared`. `postAnnouncement` /
  `clearAnnouncement` call `recordAudit(db, { kind, actorContactId, details })` — an `audit_events` row per
  change (FR-010).

## Lifecycle

- **Post**: insert a row (supersedes the previous; window starts now).
- **Clear early**: set `cleared_at = now()` on the current row → inactive immediately.
- **Auto-expire**: no write — the read-time predicate stops returning it after `posted_at + duration_hours`.
