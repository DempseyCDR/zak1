-- Feature 011: venue-scoped rent (three layers) + per-event override; multiple concurrent ongoing charges.
-- Rent leaves series_parameters:
--   (1) venue_rents keyed by (venue_id, series_id): series_id NULL = venue default, set = series-at-venue.
--   (2) venue_rent_audit for parity with series_parameter_audit.
--   (3) events.rent_cents = per-event override / direct rent (NULL = resolve from the layers).
--   (4) FREEZE: backfill every existing event's rent_cents to its current resolved series rent so no
--       event's Dance Net changes (FR-007 / SC-004).
--   (5) Delete the now-migrated rent config rows from series_parameters. The 'rent' parameter_kind enum
--       value is KEPT so historical series_parameter_audit rows stay valid (research Decision 5).
-- Ongoing stays in series_parameters; it is now resolved as a labeled sum (multiple concurrent charges),
-- which needs no schema change.

-- (1) venue rents
CREATE TABLE IF NOT EXISTS venue_rents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  series_id uuid REFERENCES series(id) ON DELETE CASCADE,
  amount_cents integer NOT NULL,
  effective_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS venue_rents_lookup ON venue_rents (venue_id, series_id, effective_date DESC);

-- (2) venue rent audit (nullable FKs SET NULL so audit history survives venue/series deletion)
CREATE TABLE IF NOT EXISTS venue_rent_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid REFERENCES venues(id) ON DELETE SET NULL,
  series_id uuid REFERENCES series(id) ON DELETE SET NULL,
  amount_cents integer NOT NULL,
  effective_date date NOT NULL,
  actor text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- (3) per-event rent override
ALTER TABLE events ADD COLUMN IF NOT EXISTS rent_cents integer;

-- (4) freeze existing events at their current resolved series rent
UPDATE events e SET rent_cents = COALESCE((
  SELECT sp.amount_cents FROM series_parameters sp
  WHERE sp.category = 'expense' AND sp.kind = 'rent'
    AND sp.series_id = e.series_id
    AND sp.effective_date <= e.event_date
  ORDER BY sp.effective_date DESC
  LIMIT 1
), 0);

-- (5) remove migrated rent config (audit rows retained; enum value kept)
DELETE FROM series_parameters WHERE category = 'expense' AND kind = 'rent';
