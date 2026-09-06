-- Feature 069: Mel's triage worklists. Two additive tables; nothing existing is altered or dropped.

-- A merge that could not complete because the survivor may hold only one of something BOTH parties have.
-- Two conditions produce this, and they are structurally identical:
--   two_logins  → contact_emails_one_login_per_contact (a survivor holds one sign-in identity)
--   two_accounts → membership_accounts_payer            (a payer owns one membership account)
-- Today the first throws a RAW database error, which is what M-R21 replaces.
CREATE TYPE held_merge_reason AS ENUM ('two_logins', 'two_accounts');

/*
 * A recorded human judgement that a proposed pair is NOT one person (M-R18 / FR-002).
 *
 * The two `dedup_normalized` values are stored AS JUDGED. Suppression holds only while both still match,
 * so the rejection lapses automatically through ANY path that changes a name — including paths added
 * later. Four places write that column today (contactService create + patch, attendanceService at the
 * door, and the contact load), so a plain flag would need four clearing hooks and would suppress a pair
 * FOREVER, silently, if one were missed. Deriving beats remembering to invalidate (feature 068's lesson).
 */
CREATE TABLE dedup_rejections (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_a_id       uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  contact_b_id       uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  a_dedup_normalized text NOT NULL,
  b_dedup_normalized text NOT NULL,
  rejected_by        uuid REFERENCES contacts(id),
  rejected_at        timestamptz NOT NULL DEFAULT now(),
  -- The suggestion query emits each unordered pair once as a.id < b.id; storing rejections the same way
  -- makes suppression a direct match rather than a two-way comparison.
  CHECK (contact_a_id < contact_b_id)
);
CREATE UNIQUE INDEX dedup_rejections_pair ON dedup_rejections (contact_a_id, contact_b_id);

-- A held merge changes NO contact data (FR-013): the merge rolls back and only this row is written.
CREATE TABLE held_merges (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  merged_id    uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  reason       held_merge_reason NOT NULL,
  attempted_by uuid REFERENCES contacts(id),
  attempted_at timestamptz NOT NULL DEFAULT now(),
  -- Resolved rather than deleted: a held merge is a governance event and the trail is kept (Principle IV).
  resolved_at  timestamptz
);
-- A pair may be held, resolved, and — if the collision recurs — held again; only one open hold at a time.
CREATE UNIQUE INDEX held_merges_pair_open ON held_merges (canonical_id, merged_id)
  WHERE resolved_at IS NULL;
