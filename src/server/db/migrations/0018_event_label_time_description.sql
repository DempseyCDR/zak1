-- Feature 013: event short label + start time + public description.
-- Three optional, display-only columns on events. start_time is a bare wall-clock `time` (without time
-- zone) — the club treats all times as venue-local, so it is stored and shown as entered with no
-- conversion. Additive, no backfill: existing events get NULL for all three and render as today.

ALTER TABLE events ADD COLUMN IF NOT EXISTS label text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS start_time time; -- time without time zone (wall-clock)
ALTER TABLE events ADD COLUMN IF NOT EXISTS description text;
