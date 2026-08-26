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
