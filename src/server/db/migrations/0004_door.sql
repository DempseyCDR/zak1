-- Feature 002: Door Attendance & Gate Capture.

DO $$ BEGIN
  CREATE TYPE gate_category AS ENUM ('today_admission','merchandise','donation','future_event','membership','gift_card','misc_sales');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payment_method AS ENUM ('cash','card');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE event_group_kind AS ENUM ('double_dance','weekend','jane_austen_ball','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Series ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  name text NOT NULL,
  has_sound_tech boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Event groups ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS event_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(trim(name)) > 0),
  kind event_group_kind NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Events ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id uuid NOT NULL REFERENCES series(id),
  group_id uuid REFERENCES event_groups(id),
  event_date date NOT NULL,
  charges_admission boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS events_series_date ON events (series_id, event_date);
CREATE INDEX IF NOT EXISTS events_group ON events (group_id);

-- Door records ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS door_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL UNIQUE REFERENCES events(id) ON DELETE CASCADE,
  pos_transaction_count integer NOT NULL DEFAULT 0,
  pos_gross_cents integer NOT NULL DEFAULT 0,
  pos_fee_cents integer NOT NULL DEFAULT 0,
  gross_cash_cents integer NOT NULL DEFAULT 0,
  seed_float_cents integer NOT NULL DEFAULT 1500,
  cash_paid_out_cents integer NOT NULL DEFAULT 0,
  cash_paid_out_reason text,
  deposit_cents integer NOT NULL DEFAULT 0,
  gift_card_redemption_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payout_reason_required CHECK (cash_paid_out_cents = 0 OR cash_paid_out_reason IS NOT NULL)
);

-- Gate sales -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gate_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  door_record_id uuid NOT NULL REFERENCES door_records(id) ON DELETE CASCADE,
  category gate_category NOT NULL,
  payment_method payment_method NOT NULL,
  amount_cents integer NOT NULL DEFAULT 0,
  UNIQUE (door_record_id, category, payment_method)
);

-- Attendance (attaches to the event) -----------------------------------------
CREATE TABLE IF NOT EXISTS attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS attendance_event ON attendance (event_id);
CREATE INDEX IF NOT EXISTS attendance_created ON attendance (created_at);
-- A given contact appears at most once per event (unmatched rows allowed many).
CREATE UNIQUE INDEX IF NOT EXISTS attendance_event_contact
  ON attendance (event_id, contact_id) WHERE contact_id IS NOT NULL;

-- Quarterly attendance counts (permanent aggregate) --------------------------
CREATE TABLE IF NOT EXISTS quarterly_attendance_counts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id uuid NOT NULL REFERENCES series(id),
  year integer NOT NULL,
  quarter smallint NOT NULL CHECK (quarter BETWEEN 1 AND 4),
  attendee_count integer NOT NULL DEFAULT 0,
  UNIQUE (series_id, year, quarter)
);

-- Door record audit (append-only) --------------------------------------------
CREATE TABLE IF NOT EXISTS door_record_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  door_record_id uuid NOT NULL REFERENCES door_records(id) ON DELETE CASCADE,
  action text NOT NULL,
  actor text,
  details jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS door_record_audit_record ON door_record_audit (door_record_id);

-- Contact review flag (extends feature 001) ----------------------------------
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS needs_review boolean NOT NULL DEFAULT false;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS source text;
