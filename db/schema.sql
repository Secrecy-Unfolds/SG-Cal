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

-- Inventory: v1 tagged an asset type and tracked cost/value manually.
-- purchase_order_id links back to the PO that created it, when applicable
-- (manual entries are allowed too).
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

-- v2: straight-line automatic depreciation for asset_type = 'depreciating'.
-- current_value for those rows is no longer read as-stored — it's computed
-- live from purchase_cost/purchase_date/useful_life_months on every read
-- (see lib/inventory.ts) and the stored column is left stale/unused for
-- them, same "compute live, don't persist a derived number" pattern
-- Procurement's capital-needed figure already uses. fixed/consumable rows
-- are unaffected — current_value stays manually edited for those, exactly
-- as before.
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS useful_life_months INTEGER;

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

-- v2 currency blending: manual, Admin-entered exchange rates (not a live FX
-- API — see docs/erp-v2-roadmap.md's "Currency blending" section for why).
-- rate_to_base = how many units of app_settings' "base_currency" key
-- (src/lib/settings.ts, default 'OMR') one unit of `currency` is worth.
-- The base currency itself never gets a row here — it implicitly has a
-- rate of 1. Blended totals are computed live from this table wherever
-- needed, never stored.
CREATE TABLE IF NOT EXISTS exchange_rates (
  currency TEXT PRIMARY KEY,
  rate_to_base NUMERIC(18, 6) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- v2 Capital / Investment / Government support — built together since
-- they're interlinked the same way Procurement execution + Inventory +
-- Accounting were: investors/government_supporters are directories,
-- investments/government_support are the actual records against those
-- directories, and both auto-post a row into capital_entries (the new
-- third ledger type, alongside income/expense) the same "one action,
-- linked auto-posting" way a Received PO already posts an Accounting
-- expense. capital_entries also accepts direct manual entries (source =
-- owner/loan/grant/other) with no investor/supporter behind them at all.
CREATE TABLE IF NOT EXISTS capital_entries (
  id SERIAL PRIMARY KEY,
  source TEXT NOT NULL, -- owner | loan | investor | government | grant | other
  amount NUMERIC(12, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'OMR',
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT NOT NULL DEFAULT '',
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS capital_entries_source_idx ON capital_entries (source);
CREATE INDEX IF NOT EXISTS capital_entries_date_idx ON capital_entries (date);

-- Investors directory — same shared/reusable-identity shape as
-- procurement_vendors (global identity, reused across every investment).
CREATE TABLE IF NOT EXISTS investors (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  contact TEXT NOT NULL DEFAULT '',
  entity_type TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One investment per investor per capital injection. investment_type splits
-- what "status" even means (see lib/investorsDisplay.ts): a loan has a real
-- repaid/defaulted debt lifecycle, equity doesn't get "repaid" at all —
-- its lifecycle is exited (bought back/sold) or written_off (worthless).
CREATE TABLE IF NOT EXISTS investments (
  id SERIAL PRIMARY KEY,
  investor_id INTEGER NOT NULL REFERENCES investors(id) ON DELETE CASCADE,
  investment_type TEXT NOT NULL DEFAULT 'loan', -- equity | loan
  amount NUMERIC(12, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'OMR',
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  terms TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  capital_entry_id INTEGER REFERENCES capital_entries(id) ON DELETE SET NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A loan's interest payments or an equity holder's dividends — either way,
-- money flowing back to the investor, logged the same way per investment.
CREATE TABLE IF NOT EXISTS investment_payouts (
  id SERIAL PRIMARY KEY,
  investment_id INTEGER NOT NULL REFERENCES investments(id) ON DELETE CASCADE,
  amount NUMERIC(12, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'OMR',
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Government/Royal supporters directory — same shared-identity pattern as
-- investors above.
CREATE TABLE IF NOT EXISTS government_supporters (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  supporter_type TEXT NOT NULL DEFAULT 'other', -- ministry | department | royal_family | other
  contact TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- expectations is deliberately nullable and blank in the normal case — most
-- government/Royal support has nothing expected in return, unlike an
-- investment. Filled in only for the exceptional record where a specific
-- ministry/sponsor does attach a condition. No payout tracking here at all
-- (see docs/erp-v2-roadmap.md) — the whole premise is nothing's owed back.
CREATE TABLE IF NOT EXISTS government_support (
  id SERIAL PRIMARY KEY,
  supporter_id INTEGER NOT NULL REFERENCES government_supporters(id) ON DELETE CASCADE,
  amount NUMERIC(12, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'OMR',
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  expectations TEXT,
  capital_entry_id INTEGER REFERENCES capital_entries(id) ON DELETE SET NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Capital budgeting (budget vs. actual) — scoped 2026-09-16 via
-- AskUserQuestion: "period + optional product". A budget always covers a
-- date range; product_id is nullable so a budget can be org-wide (compared
-- against all expense transactions in the period) or scoped to one
-- Procurement product (compared against just that product's PO-linked
-- expense transactions). "Actual" is computed live from
-- accounting_transactions (see lib/capitalBudgets.ts), never stored here —
-- same "compute live, never store" pattern as Procurement's "Capital
-- needed" and Inventory's depreciation.
CREATE TABLE IF NOT EXISTS capital_budgets (
  id SERIAL PRIMARY KEY,
  label TEXT NOT NULL DEFAULT '',
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  product_id INTEGER REFERENCES procurement_products(id) ON DELETE SET NULL,
  amount NUMERIC(12, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'OMR',
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS capital_budgets_period_idx ON capital_budgets (period_start, period_end);
CREATE INDEX IF NOT EXISTS capital_budgets_product_idx ON capital_budgets (product_id);

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

-- Expense management (scoped 2026-09-12 / 2026-09-15, via `AskUserQuestion`)
-- — budgets per category, recurring/scheduled expenses, and a
-- threshold-based approval workflow. See docs/erp-v2-roadmap.md.

-- "Actual" is computed live from accounting_transactions (category + period
-- + currency match), never stored — same pattern as capital_budgets above.
CREATE TABLE IF NOT EXISTS expense_budgets (
  id SERIAL PRIMARY KEY,
  category TEXT NOT NULL DEFAULT '',
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'OMR',
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS expense_budgets_period_idx ON expense_budgets (period_start, period_end);
CREATE INDEX IF NOT EXISTS expense_budgets_category_idx ON expense_budgets (category);

-- A scheduled job (the existing reminder-sweep cron, polled every 10-15 min
-- — see src/app/api/cron/reminder-sweep/route.ts) posts one
-- accounting_transactions row per due occurrence and advances
-- next_run_date, rather than a new scheduling mechanism.
CREATE TABLE IF NOT EXISTS recurring_expenses (
  id SERIAL PRIMARY KEY,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  amount NUMERIC(12, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'OMR',
  frequency TEXT NOT NULL DEFAULT 'monthly', -- weekly | monthly | quarterly | yearly
  next_run_date DATE NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS recurring_expenses_next_run_idx ON recurring_expenses (next_run_date);

-- Threshold-based expense approval — confirmed 2026-09-15/16: a manual
-- expense whose base-currency-converted amount exceeds 200 (or whose
-- currency has no configured exchange rate at all) needs Super-Admin
-- approval before it counts; everything else (income, PO-linked expenses,
-- payroll, recurring expenses, a Super Admin's own entry, or a small manual
-- expense) posts as 'approved' immediately, same as today. `decided_by`/
-- `decided_at` mirror leave_requests' decision columns.
ALTER TABLE accounting_transactions ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'approved'; -- pending | approved | rejected
ALTER TABLE accounting_transactions ADD COLUMN IF NOT EXISTS decided_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE accounting_transactions ADD COLUMN IF NOT EXISTS decided_at TIMESTAMPTZ;
ALTER TABLE accounting_transactions ADD COLUMN IF NOT EXISTS recurring_expense_id INTEGER REFERENCES recurring_expenses(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS accounting_transactions_status_idx ON accounting_transactions (status);
