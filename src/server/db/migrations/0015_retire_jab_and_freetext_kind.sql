-- Feature 010: retire the Jane Austen Ball mailing list; make event-group kind free text.
-- Two INDEPENDENT parts:
--   (A) Recreate the mailing_list_id enum without 'janeaustenball' (Postgres has no ALTER TYPE DROP
--       VALUE). The USING cast aborts the migration if any mailing_list_exports row still references
--       'janeaustenball' — the FR-003 safety guard. No such rows exist (verified in dev 2026-07-04).
--   (B) Convert event_groups.kind from the event_group_kind enum to nullable free text, prettifying
--       existing snake_case values (double_dance -> "double dance"), then drop the enum type.
-- The jane_austen_ball email_consent_topic is deliberately left untouched.

-- Part A: mailing_list_id enum (7 standing lists -> 6, plus contact_tracing)
ALTER TYPE mailing_list_id RENAME TO mailing_list_id_old;
CREATE TYPE mailing_list_id AS ENUM (
  'contra', 'english', 'openband', 'specialevents', 'performer', 'member', 'contact_tracing'
);
ALTER TABLE mailing_list_exports
  ALTER COLUMN list_id TYPE mailing_list_id USING list_id::text::mailing_list_id;
DROP TYPE mailing_list_id_old;

-- Part B: event_groups.kind enum -> nullable, prettified free text
ALTER TABLE event_groups ALTER COLUMN kind DROP NOT NULL;
ALTER TABLE event_groups ALTER COLUMN kind TYPE text USING replace(kind::text, '_', ' ');
DROP TYPE event_group_kind;
