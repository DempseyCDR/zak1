-- Feature 055 (P7-R12): which contact currently holds each board-seat role, for the public board page.
-- One row per board-seat role_key (from the committed club-role registry). The person rotates; the role
-- name/alias/order live in the registry, not here. Names are joined from contacts for public display.
CREATE TABLE IF NOT EXISTS officers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_key    text NOT NULL UNIQUE,
  contact_id  uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
