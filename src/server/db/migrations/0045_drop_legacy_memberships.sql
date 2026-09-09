-- Feature 068 replaced `memberships` / `payers` with `membership_accounts` / `membership_members`, and
-- deferred dropping the originals. Feature 069 removed the last write path (mergeService had still been
-- relinking the retired pair, which was the defect FR-010 fixed), so nothing has read or written either
-- table since the 068 cutover.
--
-- They are dropped now because dormant residue had begun to MISLEAD: rows kept pointing at contacts that
-- were later merged away or archived, so a hand-written query against `memberships` disagreed with the
-- live model — which is exactly how this was noticed. No snapshot is taken; `membership_accounts` carries
-- the household state, and the pre-068 provenance columns (`source_gate_sale_id`,
-- `source_notification_id`) go with the rows, by decision.
--
-- Order matters: `memberships.payer_id` references `payers`.
DROP TABLE IF EXISTS memberships;
DROP TABLE IF EXISTS payers;

-- The `membership_level` enum STAYS — feature 068's `membership_accounts.level` uses it.
