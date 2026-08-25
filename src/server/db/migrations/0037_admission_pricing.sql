-- Feature 054 (P7-R10): single-source admission pricing + the standing-schedule sentence.
-- `admission_prices` holds a series' sliding-scale tiers (a label + amount per tier). A pricing "revision" is
-- the batch of tiers sharing one `effective_date`; an event resolves the revision with the greatest
-- effective_date <= its date (mirrors the series_parameters effective-dating). A per-event flat override reuses
-- the existing events.advertised_price_cents (feature 018), so no events change here. `schedule_sentence` is a
-- curated per-series standing-schedule sentence (no recurrence engine; carries the DST-dependent English time).
CREATE TABLE IF NOT EXISTS admission_prices (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id      uuid NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  label          text NOT NULL,
  amount_cents   integer NOT NULL,
  sort_order     integer NOT NULL DEFAULT 0,
  effective_date date NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admission_prices_series_date_idx
  ON admission_prices (series_id, effective_date);

ALTER TABLE series ADD COLUMN IF NOT EXISTS schedule_sentence text;
