# Data Model: Public performer rosters (P7-R9)

Additive migration **`0036_performer_roster.sql`** (latest is `0035`). All columns are additive with safe
defaults; no backfill or data migration. `IF NOT EXISTS` on every add so re-run is safe.

## Migration `0036` — columns

```sql
-- bands: public opt-in, style tags, promo links
ALTER TABLE bands
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS styles    text[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS links     jsonb   NOT NULL DEFAULT '[]';

-- performers: public opt-in, caller designation, style tags, promo links
ALTER TABLE performers
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_caller boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS styles    text[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS links     jsonb   NOT NULL DEFAULT '[]';

-- band membership: optional instrument
ALTER TABLE band_members
  ADD COLUMN IF NOT EXISTS instrument text;
```

Snapshot `zak1_dev` first, then `pnpm run db:migrate`. Add the three tables to the test `resetDb()`
TRUNCATE list only if not already present (bands/performers/band_members are pre-existing — verify).

## Drizzle schema changes

- `src/server/db/schema/bands.ts`
  - `bands`: `isPublic boolean notNull default(false)`, `styles text('styles').array().notNull().default([])`,
    `links jsonb('links').$type<PromoLink[]>().notNull().default([])`.
  - `bandMembers`: `instrument text('instrument')` (nullable).
- `src/server/db/schema/performers.ts`
  - `performers`: `isPublic`, `isCaller` (both boolean notNull default false), `styles text[]`,
    `links jsonb $type<PromoLink[]>`.

`PromoLink` type is defined once in `src/server/domain/public/promoLinks.ts` and imported by the schema
`$type<>()` annotations.

## Entities & validation rules

### PromoLink (value object, stored in `links` jsonb array on bands & performers)

| Field | Type | Rule |
|-------|------|------|
| `type` | enum | `website \| facebook \| instagram \| youtube \| bandcamp \| spotify \| other` |
| `url`  | string | valid absolute URL; scheme MUST be `http` or `https` (Zod `.refine`); any other scheme rejected |

- Empty array is the default. Order preserved as entered. Duplicates allowed (all render).

### Style tag (element of `styles text[]`)

- Value ∈ `contra | english | community` (Zod enum). A band/performer may carry 0..n styles.
- 0 styles → the entry is excluded from every style-filtered view (edge case in spec).

### Band (public projection — `PublicBand`)

Exposable iff `is_public AND archived_at IS NULL`.

| Field | Source | Notes |
|-------|--------|-------|
| `bandId` | `bands.id` | anchor target for lineup links |
| `name` | `bands.name` | always |
| `bio` | `bands.bio` | nullable |
| `photoUrl` | `bands.photo_url` | nullable; omit img when null |
| `styles` | `bands.styles` | for grouping/filter |
| `links` | `bands.links` | validated PromoLink[] |
| `members` | `band_members` (+ `performers.display_name`) | `{ name, isLead, instrument }` — instrument nullable |

Never includes any member's contact info.

### Caller (public projection — `PublicCaller`)

Exposable iff `is_public AND is_caller`.

| Field | Source | Notes |
|-------|--------|-------|
| `performerId` | `performers.id` | anchor target |
| `name` | `performers.display_name` | always |
| `bio` | `performers.bio` | nullable |
| `photoUrl` | `performers.photo_url` | nullable |
| `styles` | `performers.styles` | filter |
| `links` | `performers.links` | validated PromoLink[] |

**PII invariant**: neither projection selects `performers.contact_id` or any contact column. The
projection functions `SELECT` only the columns above — the gate is carried by the projection type (no
contact field exists on it to leak), exactly as R8 `PublicVenue` did.

### Lineup projection additions (US3)

The lineup links a name to a roster anchor **only when that anchor actually exists** — i.e. when the entry
passes the exact roster-inclusion predicate, not merely `is_public`. A roster anchor exists for a **band**
iff `is_public AND archived_at IS NULL`, and for a **caller** iff `is_public AND is_caller`. A public
performer booked ad-hoc who is *not* a caller has no `#caller-<id>` anchor; a public band archived after
booking has no `#band-<id>` anchor. Gating on raw `is_public` would emit a broken link (violates FR-005 /
SC-006), so each entry carries a single computed boolean:

- `PublicBandBlock` (in `publicSchedule.ts`, fed by `publicDisplay.ts`): add `bandId: string` and
  `onPublicRoster: boolean` (= `is_public && archived_at IS NULL`, the same predicate as `isBandPublic`).
  Members gain `instrument: string | null`.
- `PublicPerformer` `full_bio` variant (in `performerDisplay.ts`): add `performerId: string` and
  `onPublicRoster: boolean` (= `is_public && is_caller`, the same predicate as `isCallerPublic`).

`Lineup.tsx` links a name to the roster **only when** `onPublicRoster` is true; otherwise plain text.
Because each flag reuses the very predicate that decides roster membership, the link and the anchor can
never disagree.

## State / lifecycle

- No new lifecycle. `is_public` toggles visibility; `archived_at` (bands, feature 008) still hides a band
  from every public surface regardless of `is_public`.
