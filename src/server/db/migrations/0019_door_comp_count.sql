-- Feature 014: door comp count feeding paying dancers.
-- One combined count of people admitted FREE — "your next dance free" card redemptions and performers'
-- guests together. Distinct from gift_card_redemption_count (which is reconciliation-only and keeps
-- counting its redeemers as paying). The organizer report subtracts comps from paying dancers:
--   paying_dancers = attendance − distinct performers − 1 (door attendant) − comps  (floored at 0).
-- Additive, no backfill: existing door records get 0, so historical reports are unchanged.

ALTER TABLE door_records ADD COLUMN IF NOT EXISTS comp_count integer NOT NULL DEFAULT 0;
