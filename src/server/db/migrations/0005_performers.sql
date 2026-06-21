-- Feature 003: Performers & Bookings.

DO $$ BEGIN
  CREATE TYPE performer_type AS ENUM ('caller','lead_musician','open_band_musician','sound_tech','instructor');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE rate_kind AS ENUM ('caller','sound_tech');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Performers -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS performers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name text NOT NULL CHECK (length(trim(display_name)) > 0),
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  bio text,
  photo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS performers_contact ON performers (contact_id);

-- Rate parameters (append-only, effective-dated) -----------------------------
CREATE TABLE IF NOT EXISTS rate_parameters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind rate_kind NOT NULL,
  amount_cents integer NOT NULL,
  effective_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rate_parameters_kind_date ON rate_parameters (kind, effective_date DESC);

CREATE TABLE IF NOT EXISTS rate_parameter_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_kind rate_kind NOT NULL,
  amount_cents integer NOT NULL,
  effective_date date NOT NULL,
  actor text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Bookings -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  performer_id uuid NOT NULL REFERENCES performers(id),
  performer_type performer_type NOT NULL,
  pay_cents integer NOT NULL DEFAULT 0,
  is_donated boolean NOT NULL DEFAULT false,
  is_overridden boolean NOT NULL DEFAULT false,
  requires_check boolean NOT NULL DEFAULT false,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bookings_event ON bookings (event_id);
CREATE INDEX IF NOT EXISTS bookings_performer ON bookings (performer_id);
