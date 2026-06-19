-- Feature 001: Contacts & Membership — initial schema (MVP: Setup + Foundational + US1)
-- DDL is the source of truth; Drizzle schema mirrors this for typed queries.

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS citext;

-- Enums ---------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE email_purpose AS ENUM ('personal', 'booking', 'public_profile', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE email_status AS ENUM ('active', 'transition', 'inactive');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE membership_status AS ENUM ('current', 'lapsed', 'long_lapsed', 'never');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE volunteer_role AS ENUM ('door_attendant', 'administrator');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE email_consent_topic AS ENUM (
    'contra', 'english', 'openband', 'special_events',
    'jane_austen_ball', 'contact_tracing', 'do_not_contact'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Club settings (single tenant, single row) ---------------------------------
CREATE TABLE IF NOT EXISTS club_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  long_lapse_cycles integer NOT NULL DEFAULT 3,
  cycle_definition text NOT NULL DEFAULT '1 year',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO club_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Contacts ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name text NOT NULL CHECK (length(trim(display_name)) > 0),
  name_normalized text NOT NULL,
  membership_status membership_status NOT NULL DEFAULT 'never',
  list_member boolean NOT NULL DEFAULT false,
  status_recomputed_at timestamptz,
  is_volunteer boolean NOT NULL DEFAULT false,
  volunteer_roles volunteer_role[] NOT NULL DEFAULT '{}',
  merged_into_id uuid REFERENCES contacts(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT roles_require_volunteer
    CHECK (is_volunteer OR array_length(volunteer_roles, 1) IS NULL)
);

CREATE INDEX IF NOT EXISTS contacts_name_trgm
  ON contacts USING gin (name_normalized gin_trgm_ops);
CREATE INDEX IF NOT EXISTS contacts_active
  ON contacts (id) WHERE merged_into_id IS NULL;

-- Contact emails ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contact_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  email citext NOT NULL,
  purposes email_purpose[] NOT NULL DEFAULT '{personal}',
  consent_topics email_consent_topic[] NOT NULL DEFAULT '{contact_tracing}',
  status email_status NOT NULL DEFAULT 'active',
  is_login boolean NOT NULL DEFAULT false,
  provider_set_date timestamptz,
  provider_last_open timestamptz,
  provider_last_click timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT purposes_non_empty CHECK (array_length(purposes, 1) >= 1),
  CONSTRAINT consent_topics_non_empty CHECK (array_length(consent_topics, 1) >= 1)
);

-- Email uniqueness across active + transition records (FR-003).
CREATE UNIQUE INDEX IF NOT EXISTS contact_emails_unique_active
  ON contact_emails (lower(trim(email::text)))
  WHERE status IN ('active', 'transition');

CREATE INDEX IF NOT EXISTS contact_emails_purposes
  ON contact_emails USING gin (purposes);
CREATE INDEX IF NOT EXISTS contact_emails_consent
  ON contact_emails USING gin (consent_topics);
CREATE INDEX IF NOT EXISTS contact_emails_contact
  ON contact_emails (contact_id);
