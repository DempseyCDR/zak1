-- Feature 001 US2: Membership status — payers, memberships, status-change audit.

CREATE TABLE IF NOT EXISTS payers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  name text NOT NULL CHECK (length(trim(name)) > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  payer_id uuid NOT NULL REFERENCES payers(id),
  expiry_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS memberships_contact ON memberships (contact_id);
CREATE INDEX IF NOT EXISTS memberships_contact_expiry ON memberships (contact_id, expiry_date DESC);

CREATE TABLE IF NOT EXISTS status_change_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  from_status membership_status,
  to_status membership_status NOT NULL,
  reason text NOT NULL,
  actor text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS status_change_audit_contact ON status_change_audit (contact_id);
