-- Feature 001 US3: Contact deduplication — append-only merge audit.

CREATE TABLE IF NOT EXISTS merge_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_id uuid NOT NULL REFERENCES contacts(id),
  merged_id uuid NOT NULL REFERENCES contacts(id),
  actor text NOT NULL,
  relinked_counts jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS merge_audit_canonical ON merge_audit (canonical_id);
CREATE INDEX IF NOT EXISTS merge_audit_merged ON merge_audit (merged_id);
