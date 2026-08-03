-- Feature 031 (P5-R4): a free-text comment on the anonymous gate-sales section ("3 CDs, 2 shirts"). The
-- comment describes the mix of anonymous items sold; it is stored on the anonymous gate_sales line(s) and
-- reloaded with them (Q10). Additive and nullable — no backfill, no data transform. The first Phase 5
-- migration.
ALTER TABLE gate_sales ADD COLUMN IF NOT EXISTS note text;
