-- Feature 003 addition: plain "musician" performer type (band member, paid individually).

ALTER TYPE performer_type ADD VALUE IF NOT EXISTS 'musician' AFTER 'lead_musician';

-- Musician pay books to the Bands account (same as lead musician).
INSERT INTO account_mapping (line_key, account_code, account_name)
VALUES ('musician', '5310', 'Program Staff:Bands')
ON CONFLICT (line_key) DO NOTHING;
