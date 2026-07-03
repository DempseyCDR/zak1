-- Feature 009: consolidate rateParameters (003) + SeriesExpenseParameter (005) into one
-- series-scoped series_parameters entity; add a "general" series and a Musician rate kind.

DO $$ BEGIN
  CREATE TYPE parameter_category AS ENUM ('rate', 'expense');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE parameter_kind AS ENUM ('caller', 'sound_tech', 'musician', 'rent', 'ongoing');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS series_parameters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category parameter_category NOT NULL,
  kind parameter_kind NOT NULL,
  series_id uuid NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  amount_cents integer NOT NULL,
  label text,
  effective_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS series_parameters_lookup
  ON series_parameters (series_id, category, kind, effective_date DESC);

-- series_id is nullable here only for migrated pre-series-scoping legacy rate history below;
-- every new row going forward has a real series_id.
CREATE TABLE IF NOT EXISTS series_parameter_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category parameter_category NOT NULL,
  kind parameter_kind NOT NULL,
  series_id uuid REFERENCES series(id) ON DELETE SET NULL,
  amount_cents integer NOT NULL,
  label text,
  effective_date date NOT NULL,
  actor text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- New series for joint/cross-series events. No automatic fallback to/from it — it needs its
-- own explicit series_parameters rows like any other series.
INSERT INTO series (key, name, has_sound_tech)
VALUES ('general', 'General / Joint Events', true)
ON CONFLICT (key) DO NOTHING;

-- Backfill: today's global Caller/Sound Tech rates apply uniformly to every series, so
-- duplicate each existing rate row across every series (including the new general one) —
-- must run after the general-series insert above. Preserves every existing series' resolved
-- rate exactly (FR-005).
INSERT INTO series_parameters (category, kind, series_id, amount_cents, effective_date, created_at)
SELECT 'rate', rp.kind::text::parameter_kind, s.id, rp.amount_cents, rp.effective_date, rp.created_at
FROM rate_parameters rp
CROSS JOIN series s;

-- Backfill: series expense parameters already have a series_id; carry over 1:1.
INSERT INTO series_parameters (category, kind, series_id, amount_cents, label, effective_date, created_at)
SELECT 'expense', sep.kind::text::parameter_kind, sep.series_id, sep.amount_cents, sep.label, sep.effective_date, sep.created_at
FROM series_expense_parameters sep;

-- Backfill: rate audit history is a single historical event per row, not duplicated per
-- series (series_id NULL marks these as pre-series-scoping legacy entries).
INSERT INTO series_parameter_audit (category, kind, series_id, amount_cents, effective_date, actor, created_at)
SELECT 'rate', rpa.rate_kind::text::parameter_kind, NULL, rpa.amount_cents, rpa.effective_date, rpa.actor, rpa.created_at
FROM rate_parameter_audit rpa;

-- Drop the now-consolidated tables and enums.
DROP TABLE IF EXISTS rate_parameter_audit;
DROP TABLE IF EXISTS rate_parameters;
DROP TABLE IF EXISTS series_expense_parameters;
DROP TYPE IF EXISTS rate_kind;
DROP TYPE IF EXISTS series_expense_kind;
