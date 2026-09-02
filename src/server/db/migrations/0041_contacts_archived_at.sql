-- Feature 065 (M-R9/M-R10): reversible soft-archive marker on contacts. Archived ⇔ archived_at IS NOT
-- NULL; every active-contact read filters `merged_into_id IS NULL AND archived_at IS NULL`. Mirrors
-- bands.archived_at. Reversible (restore = clear it); distinct from merged_into_id.
ALTER TABLE contacts ADD COLUMN archived_at timestamptz;
