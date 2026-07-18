-- Feature 018: booking & event management (P3-4). Additive, except one intentional backfill.
--
-- booking_status (B23): per-booking lifecycle proposed → requested → confirmed / declined. New bookings
--   default 'proposed'. EXISTING bookings are backfilled to 'confirmed' — they predate the lifecycle and
--   were treated as final, so the confirmed-only public display (FR-022) does not regress.
-- event_status (B25): 'scheduled' | 'cancelled'. Cancel is a retained, public-visible state (not a delete).
-- events.advertised_price_cents (B27): public display price; NEVER an accounting input; independent of
--   charges_admission.
-- venues.landlord_contact_id (B22): optional single landlord contact; ON DELETE SET NULL so the link
--   degrades gracefully if the contact is removed/merged.

CREATE TYPE booking_status AS ENUM ('proposed', 'requested', 'confirmed', 'declined');
CREATE TYPE event_status   AS ENUM ('scheduled', 'cancelled');

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS status booking_status NOT NULL DEFAULT 'proposed';
-- FR-022: pre-lifecycle bookings were final → confirmed (new bookings keep the 'proposed' default).
UPDATE bookings SET status = 'confirmed';

ALTER TABLE events ADD COLUMN IF NOT EXISTS status event_status NOT NULL DEFAULT 'scheduled';
ALTER TABLE events ADD COLUMN IF NOT EXISTS advertised_price_cents integer;

ALTER TABLE venues ADD COLUMN IF NOT EXISTS landlord_contact_id uuid
  REFERENCES contacts(id) ON DELETE SET NULL;
