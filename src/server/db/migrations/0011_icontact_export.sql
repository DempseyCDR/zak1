-- Feature 006: Email List Export (iContact) — audit trail for on-demand exports.

DO $$ BEGIN
  CREATE TYPE mailing_list_id AS ENUM (
    'contra', 'english', 'openband', 'specialevents', 'janeaustenball',
    'performer', 'member', 'contact_tracing'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS mailing_list_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id mailing_list_id NOT NULL,
  event_id uuid REFERENCES events(id) ON DELETE SET NULL,
  row_count integer NOT NULL,
  actor text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mailing_list_exports_lookup
  ON mailing_list_exports (list_id, created_at DESC);
