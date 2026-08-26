-- Feature 057 (P7-R14): the home-page promotional campaign slot. Each campaign is a row; campaigns form a QUEUE.
-- The home page shows exactly ONE — among rows whose window includes today (start_date <= today <= end_date),
-- the one that EXPIRES FIRST (min end_date; ties: min start_date, then created_at). Derived on read (no
-- scheduler). "Remove early" = delete the row; auto-expiry needs no write (the end_date does it). The image is
-- an external http(s) URL (no upload). Independent of event status (018) and the R13 announcement banner.
CREATE TABLE IF NOT EXISTS campaigns (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  heading     text NOT NULL,
  blurb       text NOT NULL,
  image_url   text,                                   -- http(s) image URL; NULL = text-only slot
  image_alt   text,                                   -- required (non-null) iff image_url is set
  cta_label   text NOT NULL,
  cta_url     text NOT NULL,                          -- internal path ('/...') or http(s) URL
  start_date  date NOT NULL,
  end_date    date NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT campaigns_window_ck CHECK (end_date >= start_date)
);
-- Selection reads active rows and orders by (end_date, start_date, created_at); index the ordering keys.
CREATE INDEX IF NOT EXISTS campaigns_window_idx ON campaigns (end_date, start_date, created_at);
