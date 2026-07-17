-- Feature 017: check-in overhaul (P3-3). Additive only — no drops, no backfill.
--
-- attendance.children_count (B35): number of children accompanying the parent contact on this check-in.
--   Counts toward attendance and paying dancers via events.attendance_count (children are paying, not comps).
-- attendance.is_open_band (B36): this check-in is an open-band musician (community_dance series only). A
--   per-row marker for the roster; the persisted accounting quantity is door_records.open_band_count. The
--   attendance row purges at 90 days, so it MUST NOT be the source of truth for the report.
-- door_records.open_band_count (B36): persisted count of open-band musicians comped at this event. Separate
--   from comp_count so the FS's absolute comp_count edit never clobbers per-person open-band increments, and
--   so the count survives the attendance purge for historical reports. The organizer report subtracts
--   effective comps = comp_count + open_band_count from paying dancers.
--
-- Additive, no backfill: existing rows get 0 / false, so historical attendance and reports are unchanged.

ALTER TABLE attendance   ADD COLUMN IF NOT EXISTS children_count  integer NOT NULL DEFAULT 0;
ALTER TABLE attendance   ADD COLUMN IF NOT EXISTS is_open_band    boolean NOT NULL DEFAULT false;
ALTER TABLE door_records ADD COLUMN IF NOT EXISTS open_band_count integer NOT NULL DEFAULT 0;
