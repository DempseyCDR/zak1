-- Feature 004: Treasurer Report & QBO Hand-off.

CREATE TABLE IF NOT EXISTS account_mapping (
  line_key text PRIMARY KEY,
  account_code text NOT NULL,
  account_name text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS series_qbo_map (
  series_id uuid PRIMARY KEY REFERENCES series(id) ON DELETE CASCADE,
  gate_customer text NOT NULL,
  qbo_class text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS non_dance_income (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  description text NOT NULL CHECK (length(trim(description)) > 0),
  amount_cents integer NOT NULL,
  entry_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS non_dance_income_event ON non_dance_income (event_id);

CREATE TABLE IF NOT EXISTS mapping_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mapping_kind text NOT NULL,
  key text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}',
  actor text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS treasurer_report_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  actor text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS check_number text;
