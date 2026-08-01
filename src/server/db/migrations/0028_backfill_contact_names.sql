-- Feature 027 (R5-P2): backfill mis-split contact names.
--
-- Before the capture fix (feature 026), the performer-create path stored a full name in `first_name` with an
-- empty `last_name`. Re-split those contacts into a proper first + last, splitting at the LAST space so a
-- compound given/first part stays with the first name (e.g. "David Van Buren" -> "David Van" + "Buren").
--
-- Touches ONLY first_name/last_name. display_name / name_normalized / dedup_normalized already derive from the
-- full name (display = the full first-name value, dedup = normalize(full name)), and the structured "first
-- last" reproduces that exact full name, so those keys are left unchanged.
--
-- Idempotent: the `last_name IS NULL` guard means a corrected row (now having a last name) is never matched
-- again, so a re-run changes nothing. Both SET expressions read the pre-update `first_name` (single UPDATE).
UPDATE contacts
SET first_name = btrim(substring(btrim(first_name) from '^(.*) [^ ]+$')),
    last_name  = btrim(substring(btrim(first_name) from ' ([^ ]+)$'))
WHERE last_name IS NULL
  AND btrim(first_name) LIKE '% %';
