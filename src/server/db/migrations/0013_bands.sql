-- Feature 008: reusable Band roster. A Band is a named, editable roster (one Lead Musician + zero
-- or more Musicians) with its own bio/photo; bookings created via "book as a unit" link back to it.

CREATE TABLE IF NOT EXISTS bands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  bio text,
  photo_url text,
  archived_at timestamptz,   -- soft-delete: NULL = active/selectable; set = archived
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS band_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id uuid NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
  -- RESTRICT is defensive; there is no performer-delete path in the app today.
  performer_id uuid NOT NULL REFERENCES performers(id) ON DELETE RESTRICT,
  is_lead boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (band_id, performer_id)
);

-- The booking → band link (set only for bookings created via book-as-unit; null = ad-hoc).
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS band_id uuid REFERENCES bands(id);
CREATE INDEX IF NOT EXISTS bookings_event_band ON bookings (event_id, band_id);
