-- Feature 021: remove bookings.check_number. performer_payments is the SOLE store of a performer-payment
-- check number (corrects feature 019, which left a redundant second home on the booking).
--
-- Reconcile BEFORE dropping so no history is lost (FR-003): the gate /check route wrote ONLY
-- bookings.check_number (never performer_payments), and the 0024 backfill mirrored only pay_cents>0
-- bookings — so a check entered via the gate AFTER migration 0024 lives solely on the booking. Mirror any
-- such residual value into performer_payments first, then drop the column.

-- STEP 1a (conflict guard): fail loudly if any booking's LINKED payment already carries a DIFFERENT
--   non-null check number (a check edited via the gate after 0024 mirrored the original). Expected empty in
--   the current single-maintainer DB; raising surfaces it rather than silently discarding a value.
DO $$
DECLARE conflicts int;
BEGIN
  SELECT count(*) INTO conflicts
  FROM bookings b
  JOIN payment_bookings pb ON pb.booking_id = b.id
  JOIN performer_payments pp ON pp.id = pb.payment_id
  WHERE b.check_number IS NOT NULL
    AND pp.check_number IS NOT NULL
    AND pp.check_number <> b.check_number;
  IF conflicts > 0 THEN
    RAISE EXCEPTION 'bookings.check_number diverges from a linked performer_payments.check_number on % row(s); reconcile manually before dropping the column', conflicts;
  END IF;
END $$;

-- STEP 1b (null-fill): a LINKED payment whose check_number is NULL inherits the booking's (no conflict).
UPDATE performer_payments pp
SET check_number = b.check_number, updated_at = now()
FROM payment_bookings pb
JOIN bookings b ON b.id = pb.booking_id
WHERE pb.payment_id = pp.id
  AND b.check_number IS NOT NULL
  AND pp.check_number IS NULL;

-- STEP 1c (mirror unlinked): a booking with a check number but NO linked payment (the post-0024 gate case)
--   gets a mirror payment + link — payee = the booked performer, amount = the booking's pay. Idempotent via
--   the NOT EXISTS guard; per-row loop, as in 0024.
DO $$
DECLARE bk RECORD; pid uuid;
BEGIN
  FOR bk IN
    SELECT b.id, b.event_id, b.performer_id, b.pay_cents, b.check_number
    FROM bookings b
    WHERE b.check_number IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM payment_bookings pb WHERE pb.booking_id = b.id)
  LOOP
    INSERT INTO performer_payments (event_id, payee_performer_id, amount_cents, check_number)
      VALUES (bk.event_id, bk.performer_id, bk.pay_cents, bk.check_number)
      RETURNING id INTO pid;
    INSERT INTO payment_bookings (payment_id, booking_id) VALUES (pid, bk.id);
  END LOOP;
END $$;

-- STEP 2: drop the redundant column.
ALTER TABLE bookings DROP COLUMN IF EXISTS check_number;
