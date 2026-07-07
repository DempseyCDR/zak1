# Phase 1 Data Model: Venue-Scoped Rent with Per-Event Override

## New

### `venue_rents` (new table)

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| venue_id | uuid NOT NULL FK→venues (cascade) | which venue |
| series_id | uuid **NULL** FK→series (cascade) | `NULL` = venue **default**; set = **series-at-venue** override |
| amount_cents | integer NOT NULL | rent in cents |
| effective_date | date NOT NULL | greatest ≤ event date wins |
| created_at | timestamptz NOT NULL default now() | |

- Index on `(venue_id, series_id, effective_date DESC)` for resolution.
- Two layers in one table via nullable `series_id`. Effective-dated (supersede by inserting a newer row;
  never mutate history — FR-012).

### `venue_rent_audit` (new table)

Mirror of `series_parameter_audit`: `id, venue_id, series_id (nullable), amount_cents, effective_date,
actor, created_at`. Written on every `venue_rents` insert (audit parity, Constitution IV).

### `events.rent_cents` (new column)

| Column | Type | Notes |
|--------|------|-------|
| rent_cents | integer **NULL** | `NULL` = resolve from venue/series layers; value = per-event override (or direct rent when no venue) |

## Changed

### `series_parameters` — ongoing becomes multi-row per series

- No column change. `ongoing` rows may now be **multiple per series**, keyed for resolution by **`label`**
  (required for ongoing going forward; enforced in validation, not by a DB constraint).
- `rent` config rows are **deleted** by migration `0016` (rent moved to `venue_rents` / `events`).
- The `parameter_kind` enum **keeps** `rent` (dormant) so historical `series_parameter_audit` rows remain
  valid (research Decision 5).

## Resolution rules

### Event rent — `resolveEventRentCents(event)`

Most specific first (FR-005):
1. `event.rent_cents` if non-null → use it.
2. else if `event.venue_id`: latest `venue_rents(venue_id=V, series_id=event.series_id, effective_date ≤
   event_date)` → use it.
3. else if `event.venue_id`: latest `venue_rents(venue_id=V, series_id IS NULL, effective_date ≤
   event_date)` → use it.
4. else `0`.

### Ongoing total — `resolveOngoingTotalCents(seriesId, onDate)`

Sum over distinct `label` of the latest `series_parameters(category='expense', kind='ongoing',
series_id, effective_date ≤ onDate)` amount. A label whose latest row is `$0` contributes 0 (ended).
(FR-008/FR-009.)

## Migration `0016_venue_rent_and_multi_ongoing.sql`

1. `CREATE TABLE venue_rents` (+ index) and `venue_rent_audit`.
2. `ALTER TABLE events ADD COLUMN rent_cents integer` (nullable).
3. **Freeze backfill** (FR-007/SC-004): for every event, set `rent_cents = COALESCE((latest
   series_parameters expense/rent for that event's series with effective_date ≤ event_date), 0)`.
4. `DELETE FROM series_parameters WHERE category='expense' AND kind='rent'` (config now in venue_rents /
   events; audit rows retained).

Non-destructive to real reporting: every event keeps its exact resolved rent; ongoing is unchanged
(today's single labeled charge per series is one charge under the new sum).

## Validation changes

- **`venueRentCreateSchema`** (new): `venueId` (uuid), `seriesKey` (string, optional → venue default vs.
  series-at-venue), `amount` (≥ 0), `effectiveDate` (YYYY-MM-DD).
- **`expenseParameterCreateSchema`**: `kind` narrows to `z.literal("ongoing")` (rent removed); `label`
  becomes **required** (`z.string().trim().min(1)`).
- **Event PATCH schema**: add `rentCents: z.number().int().min(0).nullable().optional()` — a number sets
  the override, `null` clears it (back to layer resolution).

## Requirements traceability

| Requirement | Data-model effect |
|-------------|-------------------|
| FR-001 | `venue_rents` with `series_id NULL` (venue default) |
| FR-002 | `venue_rents` with `series_id` set (series-at-venue) |
| FR-003, FR-004 | `events.rent_cents` (override / direct); resolution step 1 & 4 |
| FR-005 | `resolveEventRentCents` precedence |
| FR-006 | report calls `resolveEventRentCents` |
| FR-007, SC-004 | freeze backfill onto `events.rent_cents` |
| FR-008, FR-009, FR-010 | multi-row ongoing + `resolveOngoingTotalCents`; label required |
| FR-011 | performer pay / misc untouched |
| FR-012 | effective-dated inserts; audit tables; history never mutated |
