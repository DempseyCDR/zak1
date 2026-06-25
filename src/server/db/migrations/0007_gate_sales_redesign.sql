-- Feature 002/004 rework: rename admission, named-customer gate lines, derived cash/PC totals.

-- Rename the dance-income category.
ALTER TYPE gate_category RENAME VALUE 'today_admission' TO 'admission';

-- "POS gross" -> "PC gross" (sum of card lines, derived).
ALTER TABLE door_records RENAME COLUMN pos_gross_cents TO pc_gross_cents;

-- Named-customer gate lines (donation/future_event/membership) carry a buyer contact.
ALTER TABLE gate_sales ADD COLUMN IF NOT EXISTS contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL;

-- Multiple named lines per category (one per contact) are allowed; drop the old uniqueness.
ALTER TABLE gate_sales DROP CONSTRAINT IF EXISTS gate_sales_door_record_id_category_payment_method_key;
CREATE INDEX IF NOT EXISTS gate_sales_contact ON gate_sales (contact_id);

-- Account mapping line key for the renamed category.
UPDATE account_mapping SET line_key = 'admission' WHERE line_key = 'today_admission';
