-- Feature 019: performer payments & membership acquisition (P3-5). Additive, except one intentional
-- backfill (performer_payments from existing paid bookings — see the end of this file).
--
-- performer_payments (B28): what was ACTUALLY disbursed, distinct from a booking's expected pay_cents.
--   payee MAY differ from the booked performer (substitution). Not cascaded from performers — a payee is
--   financial history.
-- payment_bookings (B28): many-to-many so one check (one payment) can settle several bookings (aggregation).
-- membership_captures (B30): prospective-member info submitted on the public page, awaiting a matched
--   PayPal notification. `email` is the match key.
-- paypal_notifications (B30): every VERIFIED notification. provider_event_id UNIQUE is the idempotency
--   guarantee (FR-013) — a replay collides here rather than creating a second membership. Unverifiable
--   notifications are rejected upstream and never stored.
-- club_settings.membership_year_end (FR-003a): a MM-DD month-day, year-agnostic. DEFAULT '08-31' is a
--   PLACEHOLDER — the club must confirm the real boundary before rollout.
-- memberships.source_gate_sale_id / source_notification_id (R5, FR-013): provenance + the partial unique
--   indexes that make the door (replace-all gate save) and online (webhook replay) channels idempotent.
-- parameter_category 'door' + parameter_kind 'seed_float' (US5): the seed float joins the existing
--   effective-dated series-parameter mechanism. ADD VALUE runs fine inside the runner's transaction on
--   PG16; the values are not USED in this file (the backfill touches no enum), so nothing needs them
--   committed first.

CREATE TYPE capture_status      AS ENUM ('awaiting_payment', 'matched', 'expired');
CREATE TYPE notification_status AS ENUM ('matched', 'parked', 'resolved');

ALTER TYPE parameter_category ADD VALUE IF NOT EXISTS 'door';
ALTER TYPE parameter_kind     ADD VALUE IF NOT EXISTS 'seed_float';

ALTER TABLE club_settings
  ADD COLUMN IF NOT EXISTS membership_year_end text NOT NULL DEFAULT '08-31';

CREATE TABLE IF NOT EXISTS performer_payments (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id           uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  payee_performer_id uuid NOT NULL REFERENCES performers(id),
  amount_cents       integer NOT NULL,
  check_number       text,
  override_reason    text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS performer_payments_event ON performer_payments(event_id);

CREATE TABLE IF NOT EXISTS payment_bookings (
  payment_id uuid NOT NULL REFERENCES performer_payments(id) ON DELETE CASCADE,
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  PRIMARY KEY (payment_id, booking_id)
);
CREATE INDEX IF NOT EXISTS payment_bookings_booking ON payment_bookings(booking_id);

CREATE TABLE IF NOT EXISTS membership_captures (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email      text NOT NULL,
  name       text NOT NULL,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  status     capture_status NOT NULL DEFAULT 'awaiting_payment',
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Matching scans awaiting_payment captures by lower(email); latest wins.
CREATE INDEX IF NOT EXISTS membership_captures_email ON membership_captures(lower(email));

CREATE TABLE IF NOT EXISTS paypal_notifications (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_event_id text NOT NULL UNIQUE,
  event_type        text NOT NULL,
  payer_email       text,
  amount_cents      integer NOT NULL,
  capture_id        uuid REFERENCES membership_captures(id) ON DELETE SET NULL,
  status            notification_status NOT NULL,
  raw_payload       jsonb NOT NULL,
  received_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE memberships
  ADD COLUMN IF NOT EXISTS source_gate_sale_id uuid REFERENCES gate_sales(id) ON DELETE SET NULL;
ALTER TABLE memberships
  ADD COLUMN IF NOT EXISTS source_notification_id uuid REFERENCES paypal_notifications(id);
-- Idempotency: at most one membership per originating gate-sale line / per notification.
CREATE UNIQUE INDEX IF NOT EXISTS memberships_source_gate_sale
  ON memberships(source_gate_sale_id) WHERE source_gate_sale_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS memberships_source_notification
  ON memberships(source_notification_id) WHERE source_notification_id IS NOT NULL;

-- INTENTIONAL BACKFILL (R7): mirror every existing paid booking into performer_payments so the treasurer
-- report's performer lines do not regress when it cuts over from bookings to payments. One-for-one and
-- lossless — payee, amount, and check number already live on the booking. A per-row loop (not an
-- attribute-join) so each payment links to EXACTLY its source booking even when two bookings share the
-- same event/performer/pay/check. Idempotent via the NOT EXISTS guard on payment_bookings.
DO $$
DECLARE
  bk  RECORD;
  pid uuid;
BEGIN
  FOR bk IN
    SELECT b.id, b.event_id, b.performer_id, b.pay_cents, b.check_number
    FROM bookings b
    WHERE b.pay_cents > 0
      AND NOT EXISTS (SELECT 1 FROM payment_bookings pb WHERE pb.booking_id = b.id)
  LOOP
    INSERT INTO performer_payments (event_id, payee_performer_id, amount_cents, check_number)
      VALUES (bk.event_id, bk.performer_id, bk.pay_cents, bk.check_number)
      RETURNING id INTO pid;
    INSERT INTO payment_bookings (payment_id, booking_id) VALUES (pid, bk.id);
  END LOOP;
END $$;
