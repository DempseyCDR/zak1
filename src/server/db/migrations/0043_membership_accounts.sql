-- Feature 068: membership accounts. DDL ONLY — no data is moved here and nothing is dropped.
--
-- The club sells memberships to HOUSEHOLDS. An account is owned by a PAYER (a contact), carries a LEVEL
-- (the payer's attribute — what they bought) and a VALIDITY period (everyone's). Members are ATTACHED to
-- the account; attachment, not a contact's own history, is what makes someone a member.
--
-- The data already had this shape: 56 of 154 membership rows had a payer who was not the member, 31 payers
-- covered several people, and level/expiry were consistent within every group. `memberships` merely stored
-- it denormalised, one row per member with level and expiry copied across the household.
--
-- The legacy `memberships` and `payers` tables are deliberately LEFT IN PLACE (research R9): the migration
-- test seeds them to prove no coverage was lost, and `ensureSchema` applies every migration — so dropping
-- them here would delete the guard on this feature's riskiest work. They are retired in a follow-up.
CREATE TABLE membership_accounts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- No ON DELETE clause, deliberately: the default NO ACTION makes the database refuse to delete a payer's
  -- contact out from under their account (FR-009). This is the OPPOSITE of the old payers.contact_id
  -- ON DELETE SET NULL, which is how accounts came to have owners that were names only.
  payer_contact_id  uuid NOT NULL REFERENCES contacts(id),
  level             membership_level NOT NULL,
  expiry_date       date NOT NULL,
  last_payment_date date,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- FR-004: a payer has at most one DURABLE account. A renewal moves expiry_date; it never inserts.
CREATE UNIQUE INDEX membership_accounts_payer ON membership_accounts (payer_contact_id);

CREATE TABLE membership_members (
  account_id  uuid NOT NULL REFERENCES membership_accounts(id) ON DELETE CASCADE,
  contact_id  uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  attached_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, contact_id)
);

-- "Who is covered?" is asked per contact by every read path (record, search, export).
CREATE INDEX membership_members_contact ON membership_members (contact_id);

-- FR-003/FR-005: the FS records WHAT WAS BOUGHT on a gate dues line. Independent of amount_cents — tiers
-- change and cheques bundle donations. Nullable because it is meaningless on the other six categories.
ALTER TABLE gate_sales ADD COLUMN membership_level membership_level;
