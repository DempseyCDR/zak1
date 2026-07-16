-- Feature 016: authorization — role x capability x scope (P3-2).
--
-- Feature 015 established WHO you are. This establishes WHAT YOU MAY DO: the Organizer base (every
-- authenticated volunteer; reads all but contact PII, writes nothing) plus ten additive grants, each
-- carrying a scope. See docs/use-cases.md for the model and specs/016-role-authorization/ for the why.
--
-- ⚠️ THE FIRST DESTRUCTIVE MIGRATION IN THIS PROJECT. It drops contacts.volunteer_roles, the
-- volunteer_role enum, and the roles_require_volunteer CHECK. There is no rollback but a pg_dump.
-- 0015 recreated an enum and 0010 changed a column type; nothing has ever dropped a column.
--
-- ⚠️ THE administrator MIGRATION BELOW MOVES ZERO ROWS. Verified against zak1_dev 2026-07-15: no
-- contact holds ANY volunteer_role. bootstrapOfficer's --role flag is optional and feature 015 did not
-- use it, so the enum's two values have never had a holder. The statement stays because it is
-- data-driven and correct anywhere a holder DOES exist — and because it records that the enum was
-- retired rather than silently dropped. It must never be replaced with a hardcoded contact id: this
-- migration also runs against zak1_test and every future environment.
--
-- Consequence: after this migration NOBODY holds a grant. The first Super-user is bootstrapped from
-- the operator CLI (`pnpm run auth:bootstrap -- --email <x> --role super_user`), which is the only
-- source of one anyway (FR-030a). That is the designed cold start, not breakage.

-- The ten grants. Organizer is deliberately NOT here: it is the implicit base held by every
-- authenticated volunteer (FR-001), so a row saying 'organizer' would be a fact the evaluator must
-- then ignore -- and would make the base revocable, which the model does not contemplate.
CREATE TYPE role AS ENUM (
  'door_attendant',
  'booker',
  'financial_secretary',
  'treasurer',
  'vice_president',
  'webmaster',
  'mailing_list_manager',
  'secretary',
  'president',
  'super_user'
);

-- One role, at one scope, held by one volunteer contact. The unit the President/VP issues and revokes.
--
-- SCOPE IS THE SHAPE OF THE ROW, NOT A COLUMN:
--   series_id NULL, group_id NULL  -> club-wide
--   series_id set,  group_id NULL  -> per-series
--   series_id NULL, group_id set   -> per-event-group
-- Three granularities are exactly three states of two nullable columns, and the CHECK below is the
-- model. Per-event scope was dropped during specification: its only candidate user (the Door
-- Attendant) is club-wide, leaving it with no users.
--
-- Why two columns rather than a polymorphic (scope_type, scope_id): group and series are ORTHOGONAL
-- axes, not a hierarchy. Event groups deliberately span series ("Thanksgiving 2026" = tnc + ecd), so a
-- group grant legitimately reaches events in a series the holder has no authority over. Two
-- independent filters say that structurally. A single scope_id would imply the tree the model spends
-- three paragraphs denying -- and, fatally, ON DELETE SET NULL on it would silently PROMOTE a series
-- grant to club-wide, since club-wide IS the null state. Real FKs refuse the delete instead.
CREATE TABLE IF NOT EXISTS role_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Grants die with the person: a deleted contact cannot hold authority.
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  role role NOT NULL,
  -- NO ACTION (the default) is load-bearing, not laziness -- see the note above.
  series_id uuid REFERENCES series(id),
  group_id uuid REFERENCES event_groups(id),
  -- Who issued it. NOT cascaded: the record of who granted authority must outlive the granter
  -- leaving the club. NULL = issued by the operator CLI.
  granted_by uuid REFERENCES contacts(id),
  granted_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT grant_scope_exclusive CHECK (num_nonnulls(series_id, group_id) <= 1),
  -- NULLS NOT DISTINCT is load-bearing, not a flourish. A plain UNIQUE would catch NOTHING here:
  -- Postgres treats NULLs as distinct, and grant_scope_exclusive guarantees at least one of
  -- (series_id, group_id) is ALWAYS NULL -- so every possible row would escape it. Club-wide
  -- (NULL,NULL), per-series (sid,NULL) and per-group (NULL,gid) alike. Postgres 15+ / we run 16.
  -- This still allows the same role at two different series (FR-005): those rows genuinely differ.
  CONSTRAINT role_grants_unique UNIQUE NULLS NOT DISTINCT (contact_id, role, series_id, group_id)
);

CREATE INDEX IF NOT EXISTS role_grants_contact_idx ON role_grants (contact_id);

-- NOTE: there is deliberately NO uniqueness on (role) or (role, series_id). Two people may hold
-- President simultaneously -- unlikely, explicitly permitted, and a "helpful" unique index here would
-- violate the specification. Nor is President/VP/Treasurer mutual exclusivity expressed here: it is a
-- cross-ROW invariant on contact_id, which a row CHECK cannot see. It is enforced in the service and
-- on every write path including the CLI.

-- The audit trail becomes a table.
--
-- src/server/lib/audit.ts has written only log lines since the MVP, and said so: "For the MVP the
-- audit sink is the structured log; dedicated audit tables are introduced with those stories." This is
-- that story -- "which volunteer saw the most contacts' PII last month, and how many" must be
-- answerable in SQL without scanning application logs, and a grant/revoke trail must be durable.
CREATE TABLE IF NOT EXISTS audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- text, not an enum: the kind union already has ~40 values and grows every feature. An enum would
  -- mean an ALTER TYPE per feature on a column nothing joins on.
  kind text NOT NULL,
  actor_contact_id uuid REFERENCES contacts(id),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_events_occurred_idx ON audit_events (occurred_at);
CREATE INDEX IF NOT EXISTS audit_events_kind_idx ON audit_events (kind, occurred_at);
CREATE INDEX IF NOT EXISTS audit_events_actor_idx ON audit_events (actor_contact_id, occurred_at);

-- The President (or VP) reviews and approves the volunteer list at least annually.
--
-- ADVISORY ONLY. Nothing on the session path may read these columns: doing so would convert a
-- governance ritual into a club-wide lockout on a forgotten meeting. Overdue is
-- (volunteer_approved_at IS NULL OR < now() - interval '1 year') and it affects a screen, not access.
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS volunteer_approved_at timestamptz;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS volunteer_approved_by uuid REFERENCES contacts(id);

-- Migrate any administrator holders to super_user. MOVES ZERO ROWS TODAY (see the header). Must run
-- BEFORE the drops below, which destroy the only record of who held what.
INSERT INTO role_grants (contact_id, role)
SELECT id, 'super_user'::role FROM contacts WHERE 'administrator' = ANY(volunteer_roles)
ON CONFLICT DO NOTHING;

-- Retire the dormant feature-001 substrate. roles_require_volunteer (CHECK (is_volunteer OR
-- array_length(volunteer_roles,1) IS NULL)) worked because roles were a column on the same row. Across
-- two tables only a trigger could express it, and this codebase has none. The invariant survives
-- elsewhere: readSession re-checks contacts.is_volunteer on a live join every request, so a grant held
-- by a non-volunteer evaluates to denied; and clearing the designation revokes all grants in ONE
-- transaction, which is what makes "never silently restored" true.
ALTER TABLE contacts DROP CONSTRAINT IF EXISTS roles_require_volunteer;
ALTER TABLE contacts DROP COLUMN IF EXISTS volunteer_roles;
DROP TYPE IF EXISTS volunteer_role;
