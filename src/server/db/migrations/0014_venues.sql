-- Feature 007: public website. Structured Venue entity (resolves the venue attribute of BACKLOG
-- B12), referenced by an optional events.venue_id for the public schedule + map.

CREATE TABLE IF NOT EXISTS venues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text NOT NULL,
  latitude double precision,
  longitude double precision,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE events ADD COLUMN IF NOT EXISTS venue_id uuid REFERENCES venues(id) ON DELETE SET NULL;
