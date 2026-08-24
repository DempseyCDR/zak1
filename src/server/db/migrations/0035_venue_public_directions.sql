-- Feature 052 (P7-R8): make a venue's public exposure opt-in. `is_public` defaults FALSE so every existing
-- venue is private until a staff member deliberately opts it in (the safety property — the migration itself
-- cannot expose an address). `directions` is a free-text transit/parking/how-to-get-there note, shown only for
-- public venues. Additive — no backfill, no data transform.
ALTER TABLE venues ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS directions text;
