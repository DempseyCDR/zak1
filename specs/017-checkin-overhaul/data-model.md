# Phase 1 Data Model: Check-in Overhaul

Additive only. Migration `0022_checkin_overhaul.sql`. No drops, no enum changes, no backfill needed (all new
columns carry safe `NOT NULL DEFAULT`s). Contrast feature 016's destructive `0021`.

## Schema deltas

### `attendance` (feature 002; extended here)

| Column | Type | Default | Notes |
|---|---|---|---|
| *(existing)* `id`, `event_id`, `contact_id`, `created_at` | — | — | unchanged; one row per checked-in contact |
| **`children_count`** | `integer NOT NULL` | `0` | **B35.** Number of children accompanying this contact (the parent). Counts toward attendance and paying dancers via `events.attendance_count`. |
| **`is_open_band`** | `boolean NOT NULL` | `false` | **B36.** This check-in is an open-band musician (community_dance only). Per-row marker for the roster; the persisted accounting quantity is `door_records.open_band_count`. Purge-eligible (rows purge at 90 days). |

Constraints:

- `children_count >= 0` (enforced at the Zod boundary; a CHECK is optional — the app is the sole writer).
- `is_open_band = true` is only produced by the service when the event's series is `community_dance`
  (FR-022); no DB-level series check (would require a cross-table trigger — YAGNI).

### `door_records` (feature 002/014; extended here)

| Column | Type | Default | Notes |
|---|---|---|---|
| *(existing)* `comp_count` | `integer NOT NULL` | `0` | **B29 capture point moves to check-in.** Still the FS-confirmable count of *non-open-band* free admissions ("next dance free", performer plus-ones). Now written by the Door Attendant (`attendance.write`) at check-in **and** editable by the FS on `/gate` (`gate.write`). |
| *(existing)* `gift_card_redemption_count` | `integer NOT NULL` | `0` | **B29 / resolves B21.** Gains its capture point at check-in (was orphaned). Redeemers stay counted as paying (unchanged). |
| **`open_band_count`** | `integer NOT NULL` | `0` | **B36.** Persisted count of open-band musicians comped at this event. Separate from `comp_count` so the FS's absolute `comp_count` edit never clobbers per-person open-band increments. Survives the attendance purge → the report can read it for historical quarters. |

## Derivations (behaviour, not storage)

### Attendance total (unchanged mechanism, new inputs)

`events.attendance_count` is the **persisted** per-event total. At check-in it is incremented by:

- existing/new contact check-in: `+ (1 + children_count)`  *(B35)*
- open-band check-in: `+ 1`  *(B36 — counts as attending)*
- `unmatched` placeholder: `+ 1`  *(unchanged)*

### Effective comps and paying dancers

```text
effectiveComps = door_records.comp_count + door_records.open_band_count
payingDancers  = max(0, attendance_count − distinct_performers − 1 − effectiveComps)
```

- Children are **inside** `attendance_count` and are neither performers nor comps → counted as paying, no
  formula change (FR-011/FR-012).
- An open-band musician contributes `+1` to `attendance_count` and `+1` to `effectiveComps` → nets to
  non-paying at the event where redeemed, while still counting as attending (FR-020/FR-021).
- `payingDancers(attendanceCount, performerCount, compCount)` keeps its signature; callers pass
  `effectiveComps` as the `compCount` argument. `reportService` and `eventMoney` sum the two door columns.

## Validation (Zod boundaries)

### `attendanceSchema` (extended — `src/server/validation/attendance.ts`)

- `newContact` variant: add `lastName` (optional in schema; **required in the check-in UI** per FR-001) and
  `displayNameOverride?: string (trimmed, min 1 when present)`.
- existing-contact (`{ contactId }`) and `newContact` variants: add `childrenCount?: int >= 0` (default 0).
- add optional `isOpenBand?: boolean` to the existing-contact and new-contact variants (a musician is a real
  person, matched or newly added; not the `unmatched` path).
- `unmatched` variant: unchanged (no children, no open-band, no override).

### `checkinCountsSchema` (new — B29)

```text
{ compCount: int >= 0 (optional), giftCardRedemptionCount: int >= 0 (optional) }
```

At least the count(s) being set are provided; omitted fields leave the door record's current value. Mirrors
the count fields of `doorRecordPatchSchema` but carries **no money fields** — the Door Attendant never sets
money.

## Entity relationships (unchanged shape)

```text
series (key: community_dance | tnc | ecd | …) 1──* events *──1 event_groups
events 1──1 door_records            (comp_count, gift_card_redemption_count, open_band_count)
events 1──* attendance *──0..1 contacts   (children_count, is_open_band on the attendance row)
contacts (first_name, last_name, display_name_override, display_name derived)
```

No new tables, no new foreign keys, no relationship changes — only new scalar columns on `attendance` and
`door_records`.

## Migration outline (`0022_checkin_overhaul.sql`)

```sql
ALTER TABLE attendance   ADD COLUMN IF NOT EXISTS children_count integer NOT NULL DEFAULT 0;
ALTER TABLE attendance   ADD COLUMN IF NOT EXISTS is_open_band   boolean NOT NULL DEFAULT false;
ALTER TABLE door_records ADD COLUMN IF NOT EXISTS open_band_count integer NOT NULL DEFAULT 0;
```

Additive and idempotent; safe on `zak1_dev` (persists on disk) and auto-applied to `zak1_test`.
