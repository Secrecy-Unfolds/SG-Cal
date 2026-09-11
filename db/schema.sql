CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';

CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'meeting',
  is_tentative BOOLEAN NOT NULL DEFAULT false,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  start_reminder_sent_at TIMESTAMPTZ,
  end_reminder_sent_at TIMESTAMPTZ,
  assignee_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'backlog'
);

-- Safe to re-run: adds these columns to a database created before they existed.
ALTER TABLE events ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'meeting';
ALTER TABLE events ADD COLUMN IF NOT EXISTS start_reminder_sent_at TIMESTAMPTZ;
ALTER TABLE events ADD COLUMN IF NOT EXISTS end_reminder_sent_at TIMESTAMPTZ;
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_tentative BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE events ADD COLUMN IF NOT EXISTS assignee_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE events ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'backlog';

CREATE INDEX IF NOT EXISTS events_start_at_idx ON events (start_at);
CREATE INDEX IF NOT EXISTS events_type_idx ON events (type);
CREATE INDEX IF NOT EXISTS events_assignee_id_idx ON events (assignee_id);
CREATE INDEX IF NOT EXISTS events_status_idx ON events (status);

-- Procurement planning: a product to be purchased, with several possible
-- vendors compared against each other, one of which can be marked preferred.
CREATE TABLE IF NOT EXISTS procurement_products (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  picture_url TEXT,
  description TEXT NOT NULL DEFAULT '',
  required_for TEXT NOT NULL DEFAULT '',
  required_by DATE,
  quantity_needed INTEGER NOT NULL DEFAULT 1,
  quantity_unit TEXT NOT NULL DEFAULT 'pcs',
  customs_notes TEXT NOT NULL DEFAULT '',
  unit_price NUMERIC(12, 2),
  shipping_cost NUMERIC(12, 2),
  customs_cost NUMERIC(12, 2),
  currency TEXT NOT NULL DEFAULT 'OMR',
  purchase_date_expected DATE,
  expected_arrival DATE,
  status TEXT NOT NULL DEFAULT 'planning',
  preferred_vendor_id INTEGER,
  preference_remarks TEXT NOT NULL DEFAULT '',
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS procurement_vendors (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES procurement_products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  niche TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT '',
  pricing TEXT NOT NULL DEFAULT '',
  payment_terms TEXT NOT NULL DEFAULT '',
  quality_rating SMALLINT,
  delivery_period TEXT NOT NULL DEFAULT '',
  warranty TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- procurement_products.preferred_vendor_id -> procurement_vendors(id) is added
-- here (not inline above) since the two tables reference each other; wrapped
-- so re-running this file doesn't error on an already-added constraint.
DO $$ BEGIN
  ALTER TABLE procurement_products
    ADD CONSTRAINT procurement_products_preferred_vendor_fkey
    FOREIGN KEY (preferred_vendor_id) REFERENCES procurement_vendors(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS procurement_vendors_product_id_idx ON procurement_vendors (product_id);
CREATE INDEX IF NOT EXISTS procurement_products_status_idx ON procurement_products (status);

-- Capital needed is now computed (unit price * quantity + shipping + customs
-- cost) rather than typed in directly, so it's derived at display/email time
-- instead of stored. Migrate a database created before this change existed.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'procurement_products' AND column_name = 'customs'
  ) THEN
    ALTER TABLE procurement_products RENAME COLUMN customs TO customs_notes;
  END IF;
END $$;
ALTER TABLE procurement_products ADD COLUMN IF NOT EXISTS customs_notes TEXT NOT NULL DEFAULT '';
ALTER TABLE procurement_products ADD COLUMN IF NOT EXISTS unit_price NUMERIC(12, 2);
ALTER TABLE procurement_products ADD COLUMN IF NOT EXISTS shipping_cost NUMERIC(12, 2);
ALTER TABLE procurement_products ADD COLUMN IF NOT EXISTS customs_cost NUMERIC(12, 2);
ALTER TABLE procurement_products DROP COLUMN IF EXISTS capital_needed;
