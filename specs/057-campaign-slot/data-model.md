# Data Model: Campaign / promotional slot (P7-R14)

Additive migration **`0040_campaigns.sql`** (latest is `0039`). One new table. `IF NOT EXISTS` so re-run is
safe. Add `campaigns` to the test `resetDb()` TRUNCATE list.

## Migration `0040`

```sql
-- Feature 057 (P7-R14): the home-page promotional campaign slot. Each campaign is a row; campaigns form a QUEUE.
-- The home page shows exactly ONE — among rows whose window includes today (start_date <= today <= end_date),
-- the one that EXPIRES FIRST (min end_date; ties: min start_date, then created_at). Derived on read (no
-- scheduler). "Remove early" = delete the row; auto-expiry needs no write (the end_date does it). The image is
-- an external http(s) URL (no upload). Independent of event status (018) and the R13 announcement banner.
CREATE TABLE IF NOT EXISTS campaigns (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  heading     text NOT NULL,
  blurb       text NOT NULL,
  image_url   text,                                   -- http(s) image URL; NULL = text-only slot
  image_alt   text,                                   -- required (non-null) iff image_url is set
  cta_label   text NOT NULL,
  cta_url     text NOT NULL,                          -- internal path ('/...') or http(s) URL
  start_date  date NOT NULL,
  end_date    date NOT NULL,                          -- CHECK end_date >= start_date
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT campaigns_window_ck CHECK (end_date >= start_date)
);
-- Selection reads active rows and orders by (end_date, start_date, created_at); index the ordering keys.
CREATE INDEX IF NOT EXISTS campaigns_window_idx ON campaigns (end_date, start_date, created_at);
```

Snapshot `zak1_dev` first, then `pnpm run db:migrate`.

## Drizzle schema

- `src/server/db/schema/campaigns.ts` (NEW): mirror the table; export `campaigns` + `CampaignRow`. `date`
  columns surface as `YYYY-MM-DD` strings (Drizzle default) — matching the app's string-date convention. Export
  from the schema index.

## Entity

### Campaign (row = one promotional item; a queue of them)

| Field | Type | Rule |
|-------|------|------|
| `heading` | text | required, non-empty |
| `blurb` | text | required, non-empty |
| `imageUrl` | text? | absolute `http(s)` image URL (validated at write); NULL = text-only |
| `imageAlt` | text? | required **iff** `imageUrl` present (a11y) |
| `ctaLabel` | text | required, non-empty |
| `ctaUrl` | text | internal path (`^/` not `//`) **or** absolute `http(s)` URL (validated at write) |
| `startDate` | date | `YYYY-MM-DD` |
| `endDate` | date | `YYYY-MM-DD`, `>= startDate` (row CHECK + Zod) |

**Active predicate** (`isCampaignActive(row, today)`): `row.startDate <= today && today <= row.endDate`
(inclusive; `today` = the app's UTC date string `YYYY-MM-DD`; lexicographic compare).

**Shown selection** (`selectShownCampaign(rows, today)`): of the **active** rows, the one ordered first by
`(endDate ASC, startDate ASC, createdAt ASC)` — i.e. the campaign that **expires first** (ties: starts earliest,
then created earliest). `null` when none are active.

## Public projection (derived, display-safe)

```ts
type PublicCampaign = {
  id: string;                                   // stable id (not used for dismissal — the slot has none)
  heading: string;
  blurb: string;
  image: { url: string; alt: string } | null;  // http(s) only; null = text-only
  cta: { label: string; url: string };         // url = internal path or http(s)
};
```

`getShownCampaign(db)` → the shown row (via `selectShownCampaign`) mapped to `PublicCampaign`, else `null`. No
internal columns (dates/created/updated) reach the client.

## Admin read

- `listCampaigns(db)` → every campaign with, per row, its **status** (`upcoming` | `active` | `ended`, from the
  window vs today) and a **`shown`** flag marking the single row currently selected — so the editor sees which
  one the public sees and can manage each independently.

## Audit

- New `AuditEvent` kinds `campaign.created`, `campaign.updated`, `campaign.deleted`. `create`/`update`/`delete`
  call `recordAudit(db, { kind, actorContactId, details })` — an `audit_events` row per change (FR-010).

## Lifecycle

- **Create**: insert a row (joins the queue; does not affect others).
- **Edit**: update a row's fields/window.
- **Remove early**: delete the row (or edit its `end_date` earlier). Auto-expiry needs no write — the read-time
  predicate stops returning a row after its `end_date`.
