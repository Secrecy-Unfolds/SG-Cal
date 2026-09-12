CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';

-- Profile page fields: display name, phone, and an optional avatar.
ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS picture_url TEXT;

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

-- Meeting attendees (meetings only — tasks keep their existing single
-- assignee model). The creator is always inserted here too, so recipient
-- resolution (who gets emailed) never has to special-case them separately.
CREATE TABLE IF NOT EXISTS event_attendees (
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS event_attendees_user_id_idx ON event_attendees (user_id);

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

-- Vendors are many-to-many with products: the same vendor can now supply
-- more than one product, so vendor identity (name/country/niche) is split
-- from each product's offering (pricing/terms/rating/delivery/warranty).
-- No deployment of this app has any procurement products/vendors yet, so an
-- old-shaped table (detected by its now-removed product_id column) is just
-- dropped and recreated rather than migrated row-by-row.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'procurement_vendors' AND column_name = 'product_id'
  ) THEN
    DROP TABLE procurement_vendors CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS procurement_vendors (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT '',
  niche TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS procurement_product_vendors (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES procurement_products(id) ON DELETE CASCADE,
  vendor_id INTEGER NOT NULL REFERENCES procurement_vendors(id) ON DELETE CASCADE,
  pricing TEXT NOT NULL DEFAULT '',
  payment_terms TEXT NOT NULL DEFAULT '',
  quality_rating SMALLINT,
  delivery_period TEXT NOT NULL DEFAULT '',
  warranty TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_id, vendor_id)
);

CREATE INDEX IF NOT EXISTS procurement_product_vendors_product_id_idx ON procurement_product_vendors (product_id);
CREATE INDEX IF NOT EXISTS procurement_product_vendors_vendor_id_idx ON procurement_product_vendors (vendor_id);
CREATE INDEX IF NOT EXISTS procurement_vendors_name_idx ON procurement_vendors (name);

-- HR: employee details are a 1:1 extension of users (kept separate so
-- auth/account fields on `users` stay untouched). No row is required to
-- exist for every user — reads default to blank/null and the first admin
-- edit creates it via upsert, so no backfill migration is needed here.
CREATE TABLE IF NOT EXISTS employee_details (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  position TEXT NOT NULL DEFAULT '',
  department TEXT NOT NULL DEFAULT '',
  join_date DATE,
  salary NUMERIC(12, 2),
  salary_currency TEXT NOT NULL DEFAULT 'OMR',
  emergency_contact_name TEXT NOT NULL DEFAULT '',
  emergency_contact_phone TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS leave_requests (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  decided_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS leave_requests_user_id_idx ON leave_requests (user_id);
CREATE INDEX IF NOT EXISTS leave_requests_status_idx ON leave_requests (status);

-- Self-service attendance: one row per user per Muscat calendar day.
CREATE TABLE IF NOT EXISTS attendance_records (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  check_in_at TIMESTAMPTZ NOT NULL,
  check_out_at TIMESTAMPTZ,
  UNIQUE (user_id, work_date)
);

CREATE INDEX IF NOT EXISTS attendance_records_user_id_idx ON attendance_records (user_id);

-- Admin-only idea log: name/description/pre-requisites/expected start date.
CREATE TABLE IF NOT EXISTS ideas (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  prerequisites TEXT NOT NULL DEFAULT '',
  expected_start_date DATE,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Purchase Orders: the execution-focused counterpart to Procurement
-- Planning (which stays untouched). Created by "Send to Procurement" on a
-- Planning product; numeric cost fields come from the product itself, the
-- free-text offering fields are snapshotted from the chosen vendor's
-- offering at transfer time — both stay correct even if the Planning
-- product or vendor link is later edited/deleted.
CREATE TABLE IF NOT EXISTS purchase_orders (
  id SERIAL PRIMARY KEY,
  product_id INTEGER REFERENCES procurement_products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  vendor_id INTEGER REFERENCES procurement_vendors(id) ON DELETE SET NULL,
  vendor_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  quantity_unit TEXT NOT NULL DEFAULT 'pcs',
  unit_price NUMERIC(12, 2),
  shipping_cost NUMERIC(12, 2),
  customs_cost NUMERIC(12, 2),
  currency TEXT NOT NULL DEFAULT 'OMR',
  pricing TEXT NOT NULL DEFAULT '',
  payment_terms TEXT NOT NULL DEFAULT '',
  delivery_period TEXT NOT NULL DEFAULT '',
  warranty TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'ordered', -- ordered | in_transit | received | cancelled
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_arrival DATE,
  received_at TIMESTAMPTZ,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS purchase_orders_status_idx ON purchase_orders (status);
CREATE INDEX IF NOT EXISTS purchase_orders_product_id_idx ON purchase_orders (product_id);

-- Inventory: v1 tags an asset type and tracks cost/value manually — no
-- automatic depreciation schedule/math yet. purchase_order_id links back to
-- the PO that created it, when applicable (manual entries are allowed too).
CREATE TABLE IF NOT EXISTS inventory_items (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  asset_type TEXT NOT NULL DEFAULT 'consumable', -- fixed | depreciating | consumable
  quantity INTEGER NOT NULL DEFAULT 1,
  quantity_unit TEXT NOT NULL DEFAULT 'pcs',
  purchase_cost NUMERIC(12, 2),
  currency TEXT NOT NULL DEFAULT 'OMR',
  purchase_date DATE,
  current_value NUMERIC(12, 2),
  location TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  purchase_order_id INTEGER REFERENCES purchase_orders(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS inventory_items_asset_type_idx ON inventory_items (asset_type);

-- Accounting: a simple ledger (not double-entry bookkeeping), plus a record
-- of monthly payroll runs (run_month's UNIQUE constraint stops a month being
-- run twice).
CREATE TABLE IF NOT EXISTS payroll_runs (
  id SERIAL PRIMARY KEY,
  run_month DATE NOT NULL UNIQUE,
  run_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS accounting_transactions (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT NOT NULL DEFAULT '',
  amount NUMERIC(12, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'OMR',
  type TEXT NOT NULL, -- income | expense
  category TEXT NOT NULL DEFAULT '',
  purchase_order_id INTEGER REFERENCES purchase_orders(id) ON DELETE SET NULL,
  payroll_run_id INTEGER REFERENCES payroll_runs(id) ON DELETE SET NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS accounting_transactions_type_idx ON accounting_transactions (type);
CREATE INDEX IF NOT EXISTS accounting_transactions_date_idx ON accounting_transactions (date);

-- Generic app-wide settings (key/value). First use: Super-Admin-configurable
-- digest send times (see src/lib/settings.ts) — also stores each digest's
-- last-sent date as a same-day-resend guard, since the configured time is
-- checked from a frequently-polled endpoint rather than a single fixed cron.
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- procurement_products.preferred_vendor_id -> procurement_vendors(id). Lives
-- here (not with procurement_products above) since it depends on
-- procurement_vendors existing in its current shape; wrapped so re-running
-- this file doesn't error on an already-added constraint.
DO $$ BEGIN
  ALTER TABLE procurement_products
    ADD CONSTRAINT procurement_products_preferred_vendor_fkey
    FOREIGN KEY (preferred_vendor_id) REFERENCES procurement_vendors(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
