-- Feature 044 (contact load): add a membership LEVEL to memberships.
--
-- The one-time contact-load re-import (specs/044-contact-load) supplies a level per membership from the
-- CDR membership workbook's Payer sheet "Level" column: individual / family / supporter / student. Rows
-- created by the door, online, and admin enrollment paths (feature 019) predate the concept, so they are
-- backfilled to the modal 'individual' before the column is made NOT NULL. Idempotent — safe to re-run.
DO $$ BEGIN
  CREATE TYPE membership_level AS ENUM ('individual', 'family', 'supporter', 'student');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE memberships ADD COLUMN IF NOT EXISTS level membership_level;
UPDATE memberships SET level = 'individual' WHERE level IS NULL;
ALTER TABLE memberships ALTER COLUMN level SET DEFAULT 'individual';
ALTER TABLE memberships ALTER COLUMN level SET NOT NULL;
