-- Feature 053 (P7-R9): public performer rosters. Make bands and callers publicly exposable, opt-in.
-- `is_public` defaults FALSE so every existing band/performer stays private until a staff member deliberately
-- opts it in (the safety property — the migration itself cannot expose anyone). `styles` is a small set of
-- dance-style tags (contra/english/community) used for the roster's grouping/filter. `links` is a jsonb array
-- of self-published {type, url} promotional links (validated to http(s) at the write boundary). A performer is
-- shown individually in the callers roster only when `is_caller`. `band_members.instrument` is an optional note
-- shown on the roster/lineup. Additive — no backfill, no data transform.
ALTER TABLE bands ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;
ALTER TABLE bands ADD COLUMN IF NOT EXISTS styles text[] NOT NULL DEFAULT '{}';
ALTER TABLE bands ADD COLUMN IF NOT EXISTS links jsonb NOT NULL DEFAULT '[]';

ALTER TABLE performers ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;
ALTER TABLE performers ADD COLUMN IF NOT EXISTS is_caller boolean NOT NULL DEFAULT false;
ALTER TABLE performers ADD COLUMN IF NOT EXISTS styles text[] NOT NULL DEFAULT '{}';
ALTER TABLE performers ADD COLUMN IF NOT EXISTS links jsonb NOT NULL DEFAULT '[]';

ALTER TABLE band_members ADD COLUMN IF NOT EXISTS instrument text;
