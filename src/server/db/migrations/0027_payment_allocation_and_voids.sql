-- Feature 023: per-line allocation on payment_bookings, plus void state on performer_payments.

-- STEP 1: add columns. amount_cents nullable first so the backfill can populate it.
ALTER TABLE payment_bookings ADD COLUMN IF NOT EXISTS amount_cents integer;
ALTER TABLE performer_payments
  ADD COLUMN IF NOT EXISTS voided_at timestamptz,
  ADD COLUMN IF NOT EXISTS void_reason text,
  ADD COLUMN IF NOT EXISTS replaces_payment_id uuid REFERENCES performer_payments(id);

-- STEP 2 backfill (R6): each existing payment_bookings line's amount_cents. One-link payment → the payment
--   total; multi-link → split by the linked bookings' pay_cents proportionally, with any rounding remainder
--   assigned to the first line so the lines sum EXACTLY to the payment total. (Payments with no links are
--   left untouched.) Idempotent — only sets rows still NULL.
DO $$
DECLARE p RECORD; ln RECORD; total_pay bigint; assigned bigint; amt integer; first_booking uuid;
BEGIN
  FOR p IN SELECT id, amount_cents FROM performer_payments LOOP
    SELECT coalesce(sum(b.pay_cents), 0) INTO total_pay
      FROM payment_bookings pb JOIN bookings b ON b.id = pb.booking_id
      WHERE pb.payment_id = p.id;
    assigned := 0;
    first_booking := NULL;
    FOR ln IN
      SELECT pb.booking_id, b.pay_cents
      FROM payment_bookings pb JOIN bookings b ON b.id = pb.booking_id
      WHERE pb.payment_id = p.id
      ORDER BY pb.booking_id
    LOOP
      IF first_booking IS NULL THEN first_booking := ln.booking_id; END IF;
      IF total_pay > 0 THEN
        amt := round(p.amount_cents::numeric * ln.pay_cents / total_pay);
      ELSE
        amt := 0; -- all pay_cents zero → remainder lands on the first line below
      END IF;
      UPDATE payment_bookings SET amount_cents = amt
        WHERE payment_id = p.id AND booking_id = ln.booking_id;
      assigned := assigned + amt;
    END LOOP;
    -- Put any remainder on the first line so the lines sum to the payment total.
    IF first_booking IS NOT NULL AND assigned <> p.amount_cents THEN
      UPDATE payment_bookings SET amount_cents = amount_cents + (p.amount_cents - assigned)
        WHERE payment_id = p.id AND booking_id = first_booking;
    END IF;
  END LOOP;
END $$;

-- STEP 3: enforce NOT NULL now that every line is populated.
ALTER TABLE payment_bookings ALTER COLUMN amount_cents SET NOT NULL;
