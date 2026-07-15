-- Feature 015: staff authentication & session foundation (P3-1 / backlog B32).
--
-- Staff sign in with Google; there is no password anywhere. A Google account is bound to an existing
-- VOLUNTEER contact by matching Google's verified email to an active contact_emails row, which then
-- becomes that contact's login email (contact_emails.is_login — present but dormant since feature 001).
--
-- Sessions are server-side rows, not stateless tokens, because FR-011 requires that withdrawing a
-- volunteer's access ends an ACTIVE session: a JWT could not be revoked before its expiry. Session reads
-- join through to contacts.is_volunteer live, so withdrawal takes effect on the very next request.
--
-- Additive: no existing column changes, no backfill.

-- A volunteer contact's ability to authenticate via Google. Holds no secret.
CREATE TABLE IF NOT EXISTS staff_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- One identity per person: prevents a second Google account binding to the same contact.
  -- The sign-in path checks this BEFORE inserting and refuses with `identity_exists`, so a
  -- long-term volunteer holding both a personal and a cdrochester.org account gets a clean
  -- refusal rather than a constraint violation.
  contact_id uuid NOT NULL UNIQUE REFERENCES contacts(id) ON DELETE CASCADE,
  -- Google's immutable account id: the durable link. Email may change; sub does not.
  google_sub text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_sign_in_at timestamptz
);

-- A revocable authenticated period.
CREATE TABLE IF NOT EXISTS staff_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_identity_id uuid NOT NULL REFERENCES staff_identities(id) ON DELETE CASCADE,
  -- Hash only. The raw token lives solely in the client cookie, so a database leak yields no
  -- usable sessions.
  token_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS staff_sessions_identity_idx
  ON staff_sessions (staff_identity_id);

-- FR-015: at most one login email per contact. is_login has existed since feature 001 with nothing
-- enforcing single designation. Safe to add with no backfill: no login emails exist yet.
CREATE UNIQUE INDEX IF NOT EXISTS contact_emails_one_login_per_contact
  ON contact_emails (contact_id) WHERE is_login;
