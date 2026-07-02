-- Optional phone number on contacts: some dancers give a phone instead of an email
-- (email remains optional too — declining to give either is allowed but flagged
-- via needs_review for admin follow-up).

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS phone text;
