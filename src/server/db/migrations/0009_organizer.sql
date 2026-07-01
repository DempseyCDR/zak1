-- Feature 005: Organizer Report & Analytics.

DO $$ BEGIN
  CREATE TYPE series_expense_kind AS ENUM ('rent','ongoing');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Per-series effective-dated expense parameters (rent + ongoing).
CREATE TABLE IF NOT EXISTS series_expense_parameters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id uuid NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  kind series_expense_kind NOT NULL,
  amount_cents integer NOT NULL,
  label text,
  effective_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS series_expense_params_lookup
  ON series_expense_parameters (series_id, kind, effective_date DESC);

-- Per-event ad-hoc misc expenses (card fee is added by the report from the door record).
CREATE TABLE IF NOT EXISTS misc_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  description text NOT NULL CHECK (length(trim(description)) > 0),
  amount_cents integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS misc_expenses_event ON misc_expenses (event_id);

-- Persisted per-event attendance count (survives the 90-day contact-tracing purge).
ALTER TABLE events ADD COLUMN IF NOT EXISTS attendance_count integer NOT NULL DEFAULT 0;
