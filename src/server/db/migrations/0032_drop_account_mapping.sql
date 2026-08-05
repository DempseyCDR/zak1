-- Feature 039 (P6-R7): remove the dead GL-account-per-line annotation. The account_mapping catalog had no
-- consumer (no computed figure, no export — the treasurer books Sales Receipts/Bills and QBO derives the
-- account), so drop the table created by 0006. Idempotent — safe to re-run. `series_qbo_map` (gate customer
-- + class) and `mapping_audit` are unaffected; the report keeps its class/customer columns, only the
-- GL-account column goes.
DROP TABLE IF EXISTS account_mapping;
