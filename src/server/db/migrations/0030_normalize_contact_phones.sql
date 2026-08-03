-- Feature 032 (P5-R6): one-time backfill normalizing existing contacts.phone to the canonical form
-- (E.164, assume +1). Mirrors the TS normalizePhone rule (pinned by an integration parity test):
--   * 10 digits, no leading + : +1 + digits
--   * 11 digits leading with 1 (with or without +) : +1 + last 10 digits
--   * existing +-prefixed number with >= 11 digits (non-US E.164) : + digits
--   * anything else (wrong length / letters / extension) : left unchanged (raw) — no data loss.
-- Values only; no schema change. Idempotent (a canonical value re-normalizes to itself). Second Phase 5
-- migration.
UPDATE contacts
SET phone = CASE
  WHEN btrim(phone) !~ '^\+' AND regexp_replace(btrim(phone), '\D', '', 'g') ~ '^\d{10}$'
    THEN '+1' || regexp_replace(btrim(phone), '\D', '', 'g')
  WHEN regexp_replace(btrim(phone), '\D', '', 'g') ~ '^1\d{10}$'
    THEN '+1' || substr(regexp_replace(btrim(phone), '\D', '', 'g'), 2)
  WHEN btrim(phone) ~ '^\+' AND length(regexp_replace(btrim(phone), '\D', '', 'g')) >= 11
    THEN '+' || regexp_replace(btrim(phone), '\D', '', 'g')
  ELSE btrim(phone)
END
WHERE phone IS NOT NULL;
