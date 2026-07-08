-- Feature 012: structured contact names.
--   first_name (required), last_name (optional), display_name_override, pronouns, dedup_normalized.
-- display_name stays as a MAINTAINED materialized effective display name (override, else "first last");
-- name_normalized stays as the SEARCH key. dedup_normalized is the new DEDUP key (structured first+last).
-- Backfill preserves existing dev/seed rows byte-for-byte (production loads fresh at go-live): the whole
-- current display_name becomes first_name (last blank), and dedup_normalized reuses name_normalized, so
-- display / search / dedup outcomes are unchanged.

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS first_name text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_name text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS display_name_override text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS pronouns text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS dedup_normalized text;

UPDATE contacts
   SET first_name = display_name,
       dedup_normalized = name_normalized
 WHERE first_name IS NULL;

ALTER TABLE contacts ALTER COLUMN first_name SET NOT NULL;
ALTER TABLE contacts ALTER COLUMN dedup_normalized SET NOT NULL;

-- Trigram index for override-immune duplicate detection on the structured name.
CREATE INDEX IF NOT EXISTS contacts_dedup_trgm ON contacts USING gin (dedup_normalized gin_trgm_ops);
