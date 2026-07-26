-- Feature 020: Booker experience (P4-1). Additive, plus one intentional backfill.
--
-- booking_status 'tentative' (US3): a performer's "maybe" — a state between requested and confirmed.
--   Transitions are validated in code (bookingStatus.ts), not by enum order, so the value's position is
--   irrelevant. ADD VALUE runs inside the runner's transaction on PG16; this file never USES the value
--   (no data write references it), so the same-transaction restriction doesn't bite — as with 0024.
-- venues.short_name (US5): the compact label shown in the bookings report. Nullable, display-only,
--   non-unique. Defaulted from name initials at create; the app falls back to derived initials if null.
--   BACKFILL below sets it for existing venues from the same rule the app uses (venueShortNameDefault).

ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'tentative';

ALTER TABLE venues ADD COLUMN IF NOT EXISTS short_name text;

-- INTENTIONAL BACKFILL: initials = uppercased first letter of each whitespace-delimited word
-- ("German House" -> "GH"). Mirrors venueShortNameDefault(name); idempotent via WHERE short_name IS NULL.
UPDATE venues
SET short_name = (
  SELECT string_agg(upper(left(word, 1)), '')
  FROM regexp_split_to_table(name, '\s+') AS word
  WHERE word <> ''
)
WHERE short_name IS NULL;
