-- Feature 038 (P6-R6): remove the unused "non-dance income" capability (3 years, zero entries; YAGNI).
-- Drops the table created by 0006 (the non_dance_income_event index goes with it). Idempotent — safe to
-- re-run. The account_mapping catalog is unaffected (only the seeded non_dance_income line-key row is
-- removed, in seed data, not here).
DROP TABLE IF EXISTS non_dance_income;
