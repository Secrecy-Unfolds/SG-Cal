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
-- 0.2.9: set when a Super Admin resets someone's password; cleared once they
-- choose their own. While set, the session is locked to the change-password
-- page (src/middleware.ts) — see src/lib/session.ts's `mcp` claim.
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;
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
-- v2.1: per-product opt-out from the product/vendor-change emails every
-- Admin-level account otherwise gets on every create/update/delete —
-- narrowly scoped to Procurement Planning's own CRUD notifications, not
-- the downstream PO-received Inventory/Accounting auto-postings (a
-- separate module's notification path).
ALTER TABLE procurement_products ADD COLUMN IF NOT EXISTS notifications_muted BOOLEAN NOT NULL DEFAULT false;
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
-- v2 Procurement workflow Phase 1: contact fields — confirmed 2026-09-15,
-- `email` primary, `phone`/`alternate_email` optional. A prerequisite for
-- Phase 2's RFQ email step, and a real gap on its own (no way to actually
-- contact a vendor from inside the app before this).
ALTER TABLE procurement_vendors ADD COLUMN IF NOT EXISTS email TEXT NOT NULL DEFAULT '';
ALTER TABLE procurement_vendors ADD COLUMN IF NOT EXISTS phone TEXT NOT NULL DEFAULT '';
ALTER TABLE procurement_vendors ADD COLUMN IF NOT EXISTS alternate_email TEXT NOT NULL DEFAULT '';

-- 0.2.8: vendor website + a documents section (company profile, product
-- catalogue, price list, ...). Files live in Vercel Blob; one row per file,
-- no versioning (upload again / delete the old one). ON DELETE CASCADE from
-- the vendor — lib/procurement.ts's deleteVendor also removes the blobs.
ALTER TABLE procurement_vendors ADD COLUMN IF NOT EXISTS website TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS procurement_vendor_documents (
  id SERIAL PRIMARY KEY,
  vendor_id INTEGER NOT NULL REFERENCES procurement_vendors(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'other',
  blob_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT '',
  size_bytes INTEGER NOT NULL DEFAULT 0,
  uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS procurement_vendor_documents_vendor_id_idx ON procurement_vendor_documents (vendor_id);

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

-- v2 Procurement workflow Phase 1: quotation dates — distinct from
-- created_at (whenever the record was typed in). Both nullable/optional,
-- same light-touch-validation convention as the rest of this offering row.
ALTER TABLE procurement_product_vendors ADD COLUMN IF NOT EXISTS quote_received_on DATE;
ALTER TABLE procurement_product_vendors ADD COLUMN IF NOT EXISTS quote_valid_until DATE;
-- v2 Procurement workflow Phase 1: evaluation scoring — confirmed via
-- `AskUserQuestion`: price/delivery/warranty are free text and can't be
-- scored algorithmically, so each gets its own 1-5 star rating (same shape
-- as the pre-existing quality_rating) rather than trying to parse a number
-- out of free text. The free-text fields themselves are untouched —
-- these are a parallel manual judgment, not a replacement.
ALTER TABLE procurement_product_vendors ADD COLUMN IF NOT EXISTS price_rating SMALLINT;
ALTER TABLE procurement_product_vendors ADD COLUMN IF NOT EXISTS delivery_rating SMALLINT;
ALTER TABLE procurement_product_vendors ADD COLUMN IF NOT EXISTS warranty_rating SMALLINT;

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

-- 0.2.11: leave balance. `annual_leave_days` is a per-employee custom
-- allowance (NULL = none set, so no balance is shown or compared) counted per
-- CALENDAR year. Days are counted Sun-Thu (Fri/Sat are the weekend) minus the
-- public holidays below — see src/lib/hrDisplay.ts's countLeaveDays.
ALTER TABLE employee_details ADD COLUMN IF NOT EXISTS annual_leave_days NUMERIC(5, 1);

-- Admin-maintained public holidays: one row per calendar day (a multi-day
-- holiday like Eid is several rows sharing a name).
CREATE TABLE IF NOT EXISTS public_holidays (
  id SERIAL PRIMARY KEY,
  holiday_date DATE NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
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

-- 0.2.17: Organization structure, Phase 5 — much richer employee details
-- (confirmed 2026-09-18, resolved in full 2026-09-22) plus per-type document
-- uploads. Fixed columns, not a custom-fields mechanism (confirmed). Expat
-- status is derived from `country` (not Oman => visa_expiry applies), not a
-- separate flag. `position` is untouched/coexists with the job-title system.
-- The four `*_expiry_reminder_sent_at` columns gate a once-per-expiry-value
-- reminder (reset when that expiry date is edited — src/lib/hr.ts), same
-- mark-once-fired pattern used everywhere else in this app.
ALTER TABLE employee_details ADD COLUMN IF NOT EXISTS civil_id TEXT NOT NULL DEFAULT '';
ALTER TABLE employee_details ADD COLUMN IF NOT EXISTS civil_id_expiry DATE;
ALTER TABLE employee_details ADD COLUMN IF NOT EXISTS civil_id_expiry_reminder_sent_at TIMESTAMPTZ;
ALTER TABLE employee_details ADD COLUMN IF NOT EXISTS passport_number TEXT NOT NULL DEFAULT '';
ALTER TABLE employee_details ADD COLUMN IF NOT EXISTS passport_expiry DATE;
ALTER TABLE employee_details ADD COLUMN IF NOT EXISTS passport_expiry_reminder_sent_at TIMESTAMPTZ;
ALTER TABLE employee_details ADD COLUMN IF NOT EXISTS visa_expiry DATE;
ALTER TABLE employee_details ADD COLUMN IF NOT EXISTS visa_expiry_reminder_sent_at TIMESTAMPTZ;
ALTER TABLE employee_details ADD COLUMN IF NOT EXISTS contract_expiry DATE;
ALTER TABLE employee_details ADD COLUMN IF NOT EXISTS contract_expiry_reminder_sent_at TIMESTAMPTZ;
ALTER TABLE employee_details ADD COLUMN IF NOT EXISTS father_name TEXT NOT NULL DEFAULT '';
ALTER TABLE employee_details ADD COLUMN IF NOT EXISTS religion TEXT NOT NULL DEFAULT '';
ALTER TABLE employee_details ADD COLUMN IF NOT EXISTS country TEXT NOT NULL DEFAULT '';
ALTER TABLE employee_details ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE employee_details ADD COLUMN IF NOT EXISTS gender TEXT NOT NULL DEFAULT '';
ALTER TABLE employee_details ADD COLUMN IF NOT EXISTS education_level TEXT NOT NULL DEFAULT '';
ALTER TABLE employee_details ADD COLUMN IF NOT EXISTS degree_field TEXT NOT NULL DEFAULT '';
ALTER TABLE employee_details ADD COLUMN IF NOT EXISTS graduation_date DATE;
ALTER TABLE employee_details ADD COLUMN IF NOT EXISTS years_experience NUMERIC(4, 1);
ALTER TABLE employee_details ADD COLUMN IF NOT EXISTS recommended_by TEXT NOT NULL DEFAULT '';

-- Per-type document uploads (passport, Civil ID, visa, contract, degree,
-- other). One logical "slot" per (user_id, doc_type); a re-upload adds a new
-- version_number rather than overwriting — "current" is MAX(version_number),
-- computed live (same precedent as step_deliverable_files). Files live in
-- Vercel Blob under hr/employees/.
CREATE TABLE IF NOT EXISTS employee_documents (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL DEFAULT 'other',
  version_number INTEGER NOT NULL DEFAULT 1,
  blob_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT '',
  size_bytes INTEGER NOT NULL DEFAULT 0,
  uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS employee_documents_user_id_idx ON employee_documents (user_id);

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
-- 0.2.12: an Admin can add/edit/remove a day's record after the fact. A row
-- means present and no row means absent (unchanged); these two columns just
-- record that a person other than the employee last touched the row.
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS edited_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;

-- 0.2.13: Organization structure, Phase 1 (docs/org-structure-plan.md).
-- Departments are a managed list replacing the free-text
-- employee_details.department; each has ONE Manager and (optionally) one
-- Director who can oversee several Departments. Naming a Manager/Director here
-- also sets that person's job title (lib/org.ts keeps the two in sync).
CREATE TABLE IF NOT EXISTS departments (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  manager_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  director_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS departments_name_lower_idx ON departments (lower(name));
-- One person manages at most one Department.
CREATE UNIQUE INDEX IF NOT EXISTS departments_manager_id_idx ON departments (manager_id) WHERE manager_id IS NOT NULL;

-- Editable job-title list (the hierarchy titles), NOT an enum. `level` orders
-- the hierarchy (1 = top). `structural_key` marks the six titles the code
-- relies on (it survives a rename); those can't be deleted. Manager, Director,
-- Project Head and Team Lead are assigned through the structure (a
-- Department's Manager/Director, a Project's Head, a Team's Lead), never
-- picked by hand on an employee — CEO and Chief Officer are picked by hand.
CREATE TABLE IF NOT EXISTS job_titles (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  level INTEGER NOT NULL,
  qualified_by_department BOOLEAN NOT NULL DEFAULT false, -- shown as "<Department> <title>", e.g. "HR Officer"
  structural_key TEXT UNIQUE CHECK (structural_key IN ('ceo', 'chief_officer', 'director', 'manager', 'project_head', 'team_lead')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS job_titles_name_lower_idx ON job_titles (lower(name));

-- The employee's Department and title. `reports_to_id` is used ONLY for a
-- Director -> their Chief Officer; every other reporting line is derived from
-- Department / Project / Team structure (src/lib/orgHierarchy.ts). The old
-- free-text `department` column is left in place, unread and unwritten.
ALTER TABLE employee_details ADD COLUMN IF NOT EXISTS department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL;
ALTER TABLE employee_details ADD COLUMN IF NOT EXISTS job_title_id INTEGER REFERENCES job_titles(id) ON DELETE SET NULL;
ALTER TABLE employee_details ADD COLUMN IF NOT EXISTS reports_to_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- Guard for one-time data steps below: setup re-runs this whole file, and a
-- seed that re-ran would resurrect a Department someone renamed or deleted.
CREATE TABLE IF NOT EXISTS one_time_migrations (
  key TEXT PRIMARY KEY,
  ran_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM one_time_migrations WHERE key = 'org_phase1_seed') THEN
    INSERT INTO departments (name) VALUES
      ('HR'), ('IT'), ('Accounting'), ('Procurement'), ('Inventory Management'), ('Logistics'),
      ('Engineering'), ('AI'), ('Cybersecurity'), ('Production'), ('Quality Assurance'),
      ('Maintenance'), ('Marketing'), ('Sales'), ('Customer Service'), ('Legal'),
      ('Internal Audit'), ('Business Intelligence'), ('HSE'), ('Public Relations'),
      ('Investor & Government Relations')
    ON CONFLICT DO NOTHING;

    INSERT INTO job_titles (name, level, qualified_by_department, structural_key) VALUES
      ('CEO', 1, false, 'ceo'),
      ('Chief Officer', 2, false, 'chief_officer'),
      ('Director', 3, false, 'director'),
      ('Manager', 4, true, 'manager'),
      ('Project Head', 5, false, 'project_head'),
      ('Team Lead', 6, false, 'team_lead')
    ON CONFLICT DO NOTHING;
    INSERT INTO job_titles (name, level, qualified_by_department) VALUES
      ('Officer', 7, true), ('Technician', 8, false), ('Developer', 8, false),
      ('Engineer', 8, false), ('Trainee', 9, false), ('Intern', 9, false)
    ON CONFLICT DO NOTHING;

    -- Existing free-text departments become real ones: a value matching a
    -- department (case-insensitive, trimmed) is linked to it; a value with no
    -- match creates a department of that name, so nothing is lost or blanked.
    INSERT INTO departments (name)
      SELECT DISTINCT ON (lower(trim(ed.department))) trim(ed.department)
      FROM employee_details ed
      WHERE trim(ed.department) <> ''
        AND NOT EXISTS (SELECT 1 FROM departments d WHERE lower(d.name) = lower(trim(ed.department)))
      ORDER BY lower(trim(ed.department))
    ON CONFLICT DO NOTHING;
    UPDATE employee_details ed SET department_id = d.id
      FROM departments d
      WHERE lower(d.name) = lower(trim(ed.department)) AND ed.department_id IS NULL AND trim(ed.department) <> '';

    INSERT INTO one_time_migrations (key) VALUES ('org_phase1_seed');
  END IF;
END $$;

-- 0.2.18: Organization structure, Phase 4 (module-level slice only — confirmed
-- 2026-09-22: "an HR officer only sees HR, not finance/inventory/procurement").
-- A Department maps to zero or more ERP modules; a plain (non-Admin-level)
-- user whose Department has a module gets VIEW-only access to it — every
-- write in that module stays Admin-level-only, unchanged. Admin-level bypasses
-- this table entirely (sees every module regardless). A Department with no
-- row here maps to nothing extra (confirmed default) — the person still keeps
-- the baseline everyone gets (Calendar, Profile, Dashboard, Plans shared with
-- them). Organization and Projects are deliberately NOT gateable through this
-- table (see src/lib/orgModulesDisplay.ts) — they're structural/admin pages,
-- not a "line of business" a Department maps to.
CREATE TABLE IF NOT EXISTS department_modules (
  department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL CHECK (module_key IN ('procurement', 'inventory', 'accounting', 'hr')),
  PRIMARY KEY (department_id, module_key)
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM one_time_migrations WHERE key = 'org_phase4_module_seed') THEN
    INSERT INTO department_modules (department_id, module_key)
      SELECT id, 'hr' FROM departments WHERE lower(name) = 'hr'
      UNION ALL
      SELECT id, 'accounting' FROM departments WHERE lower(name) = 'accounting'
      UNION ALL
      SELECT id, 'procurement' FROM departments WHERE lower(name) = 'procurement'
      UNION ALL
      SELECT id, 'inventory' FROM departments WHERE lower(name) = 'inventory management'
    ON CONFLICT DO NOTHING;
    INSERT INTO one_time_migrations (key) VALUES ('org_phase4_module_seed');
  END IF;
END $$;

-- 0.2.14: Organization structure, Phase 2 — Projects and Teams.
-- A Project belongs to exactly one Department and has one Project Head; it has
-- several Teams, each with one Team Lead; people sit under a Team, or directly
-- under the Project when it has no Team for them. A person is on at most ONE
-- Project (via a Team or directly), so "who do I report to" has one answer.
-- project_head_id / team_lead_id are nullable only so a row survives if that
-- person is ever removed (ON DELETE SET NULL); the API always requires them.
-- Naming a Head/Lead sets their job title (lib/org.ts keeps title and structure
-- in sync). department_id is RESTRICT: a Department with Projects can't be deleted.
CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'planning'
    CHECK (status IN ('planning', 'active', 'on_hold', 'completed', 'cancelled')),
  start_date DATE,
  target_end_date DATE,
  budget NUMERIC(14, 2),
  currency TEXT NOT NULL DEFAULT 'OMR',
  department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  project_head_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS projects_name_lower_idx ON projects (lower(name));
CREATE INDEX IF NOT EXISTS projects_department_id_idx ON projects (department_id);

CREATE TABLE IF NOT EXISTS teams (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  team_lead_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS teams_project_name_lower_idx ON teams (project_id, lower(name));
-- One person leads at most one Team.
CREATE UNIQUE INDEX IF NOT EXISTS teams_team_lead_id_idx ON teams (team_lead_id) WHERE team_lead_id IS NOT NULL;

-- user_id UNIQUE = one person, one Team (confirmed).
CREATE TABLE IF NOT EXISTS team_members (
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (team_id, user_id)
);

-- People on a Project directly, with no Team. (A Team member is on the Project
-- through the Team and isn't listed here.)
CREATE TABLE IF NOT EXISTS project_members (
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (project_id, user_id)
);
CREATE INDEX IF NOT EXISTS project_members_user_id_idx ON project_members (user_id);

-- 0.2.15: Organization structure, Phase 3 — optional Project links. A plan
-- (Process/Strategy/Idea, or a Stage) and a Procurement product may each
-- optionally belong to a Project — zero-backfill, ON DELETE SET NULL (fulfils
-- the deferral plans' own schema comment above promised once Projects shipped).
ALTER TABLE plans ADD COLUMN IF NOT EXISTS project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS plans_project_id_idx ON plans (project_id);
ALTER TABLE procurement_products ADD COLUMN IF NOT EXISTS project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS procurement_products_project_id_idx ON procurement_products (project_id);

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

-- v2 Procurement workflow Phase 1: delivery tracking. expected_arrival and
-- received_at above already cover expected-vs-actual dates; this adds the
-- rest — a carrier/tracking reference, and how much actually arrived vs.
-- was ordered (a partial shipment). quantity_received is nullable/optional
-- and purely informational for now — it does not change what
-- createInventoryItemFromPurchaseOrder() posts, which still uses the full
-- ordered quantity.
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS carrier TEXT NOT NULL DEFAULT '';
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS tracking_reference TEXT NOT NULL DEFAULT '';
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS quantity_received INTEGER;

-- v2 Procurement workflow Phase 2 — confirmed 2026-09-17, via `AskUserQuestion`:
-- GRN and Invoice genuinely decouple "goods arrived" (PO status) from
-- "verified into stock" (GRN) and "expense actually owed" (Invoice) —
-- replacing the old direct Received-status-triggers-Inventory+Accounting
-- link, not just adding parallel audit records alongside it. Existing
-- already-received POs and their already-created Inventory items/
-- transactions are untouched; this only changes behavior going forward.

-- Purchase Requisition: a stage *before* a Planning product exists.
-- Approving one creates the actual `procurement_products` row (product_id
-- set then, for traceability) — confirmed any Admin-level can approve,
-- not Super-Admin-only, matching the rest of Procurement's Admin/Super
-- Admin-equal treatment.
CREATE TABLE IF NOT EXISTS purchase_requisitions (
  id SERIAL PRIMARY KEY,
  product_name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  quantity_needed INTEGER NOT NULL DEFAULT 1,
  quantity_unit TEXT NOT NULL DEFAULT 'pcs',
  justification TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  requested_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  decided_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ,
  product_id INTEGER REFERENCES procurement_products(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS purchase_requisitions_status_idx ON purchase_requisitions (status);

-- RFQ: a status per product-vendor link, distinct from the offering data
-- itself. Null = no RFQ sent yet (today's default for every existing row).
ALTER TABLE procurement_product_vendors ADD COLUMN IF NOT EXISTS rfq_status TEXT; -- requested | quoted | declined
ALTER TABLE procurement_product_vendors ADD COLUMN IF NOT EXISTS rfq_sent_at TIMESTAMPTZ;

-- GRN (Goods Receipt Note) — now the actual trigger for creating the
-- linked Inventory item (lib/goodsReceipts.ts's createGoodsReceipt()),
-- replacing updatePurchaseOrderStatus()'s old direct call on a status
-- change to "received".
CREATE TABLE IF NOT EXISTS goods_receipts (
  id SERIAL PRIMARY KEY,
  purchase_order_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  date_received DATE NOT NULL DEFAULT CURRENT_DATE,
  quantity_received INTEGER NOT NULL,
  condition_notes TEXT NOT NULL DEFAULT '',
  received_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  inventory_item_id INTEGER REFERENCES inventory_items(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS goods_receipts_po_idx ON goods_receipts (purchase_order_id);

-- Vendor Invoice — now the real source of the Accounting expense
-- transaction a PO posts (lib/vendorInvoices.ts's createVendorInvoice()),
-- replacing updatePurchaseOrderStatus()'s old direct call to
-- postExpenseForPurchaseOrder() on a status change to "received". Status
-- is derived live from vendor_payments (outstanding balance), not stored.
CREATE TABLE IF NOT EXISTS vendor_invoices (
  id SERIAL PRIMARY KEY,
  purchase_order_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL DEFAULT '',
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC(12, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'OMR',
  due_date DATE,
  transaction_id INTEGER REFERENCES accounting_transactions(id) ON DELETE SET NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vendor_invoices_po_idx ON vendor_invoices (purchase_order_id);

-- Payment — lets one invoice be paid across multiple payments, instead of
-- the old single auto-posted transaction implicitly meaning "fully paid,
-- immediately, in one shot." Outstanding balance is computed live
-- (invoice.amount - sum of its payments), never stored.
CREATE TABLE IF NOT EXISTS vendor_payments (
  id SERIAL PRIMARY KEY,
  vendor_invoice_id INTEGER NOT NULL REFERENCES vendor_invoices(id) ON DELETE CASCADE,
  amount NUMERIC(12, 2) NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  method TEXT NOT NULL DEFAULT '',
  reference TEXT NOT NULL DEFAULT '',
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vendor_payments_invoice_idx ON vendor_payments (vendor_invoice_id);

-- Closure: a `closed` status value on purchase_orders.status (still just
-- TEXT, no enum/CHECK — matches this table's existing convention).
-- close_reason is only ever set on a force-close (the normal path leaves
-- it null); confirmed reachable normally once GRN + invoice + full payment
-- all exist, otherwise only via the explicit force-close path.
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS close_reason TEXT;

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

-- Deeper accounting structure (scoped 2026-09-16, via `AskUserQuestion`) —
-- bank/cash accounts, recurring income, receipt attachments, VAT, and
-- period closing. See docs/erp-v2-roadmap.md.

-- Bank/cash accounts — confirmed optional: financial_account_id is
-- nullable, so existing and new unassigned transactions just show as
-- "Unassigned" rather than forcing every entry to pick one.
CREATE TABLE IF NOT EXISTS financial_accounts (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  account_type TEXT NOT NULL DEFAULT 'bank', -- bank | cash | other
  currency TEXT NOT NULL DEFAULT 'OMR',
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE accounting_transactions ADD COLUMN IF NOT EXISTS financial_account_id INTEGER REFERENCES financial_accounts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS accounting_transactions_account_idx ON accounting_transactions (financial_account_id);

-- Recurring income mirrors recurring_expenses above, but always posts
-- 'approved' immediately (income never goes through the expense-approval
-- threshold) — see lib/recurringIncome.ts.
CREATE TABLE IF NOT EXISTS recurring_income (
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
CREATE INDEX IF NOT EXISTS recurring_income_next_run_idx ON recurring_income (next_run_date);
ALTER TABLE accounting_transactions ADD COLUMN IF NOT EXISTS recurring_income_id INTEGER REFERENCES recurring_income(id) ON DELETE SET NULL;

-- Receipts/invoices as attachments — reuses the existing Vercel Blob upload
-- infrastructure (see /api/accounting/upload, mirroring
-- /api/procurement/upload). Nullable — most transactions still won't have
-- one, this is opt-in backup, not a requirement.
ALTER TABLE accounting_transactions ADD COLUMN IF NOT EXISTS attachment_url TEXT;

-- VAT/tax categorization — confirmed: a manual per-transaction toggle, rate
-- stored as a snapshot (not computed live from one configurable global
-- rate), pre-filled at 5% (Oman's rate) but editable/overridable.
-- vat_amount is computed at write time and stored alongside amount/vat_rate
-- rather than recomputed on every read, same "snapshot, not live" intent.
ALTER TABLE accounting_transactions ADD COLUMN IF NOT EXISTS taxable BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE accounting_transactions ADD COLUMN IF NOT EXISTS vat_rate NUMERIC(5, 2);
ALTER TABLE accounting_transactions ADD COLUMN IF NOT EXISTS vat_amount NUMERIC(12, 2);

-- Period closing — confirmed: an arbitrary period_start/period_end (not a
-- fixed calendar-month/quarter concept), same period-as-date-range shape
-- already used by capital_budgets/expense_budgets. A period counts as
-- currently closed while a row here covers its date and reopened_at is
-- still null; reopening keeps the row (reopened_by/reopened_at set) for
-- audit instead of deleting it. Confirmed: reopening is Super-Admin-only.
CREATE TABLE IF NOT EXISTS closed_periods (
  id SERIAL PRIMARY KEY,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  closed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  closed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reopened_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reopened_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS closed_periods_range_idx ON closed_periods (period_start, period_end);

-- "Basic financial statements" (P&L + balance-style summary) needs no new
-- table — it's a live-computed reporting view over data that already
-- exists across Accounting/Inventory/Capital. See lib/financialStatements.ts.

-- Document & report generation — Accounting's half: customer invoicing
-- (scoped 2026-09-16, via `AskUserQuestion`). See docs/erp-v2-roadmap.md.

-- Same shared/reusable-identity shape as procurement_vendors/investors.
CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  contact TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- invoice_number is backfilled right after insert (needs the row's own id —
-- see lib/invoices.ts's createInvoice()). access_token is a random,
-- unguessable string used only by the public PDF share-link route (the
-- app's one deliberately unauthenticated route, scoped to a single
-- invoice's PDF) — confirmed 2026-09-16 via `AskUserQuestion`.
-- "overdue" is not a stored status — it's computed for display (status =
-- 'sent' and due_date has passed), so nothing needs to flip it, matching
-- the app's "compute live, don't store derived state" convention.
CREATE TABLE IF NOT EXISTS issued_invoices (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL DEFAULT '',
  currency TEXT NOT NULL DEFAULT 'OMR',
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'draft', -- draft | sent | paid
  access_token TEXT NOT NULL,
  transaction_id INTEGER REFERENCES accounting_transactions(id) ON DELETE SET NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS issued_invoices_number_idx ON issued_invoices (invoice_number);
CREATE UNIQUE INDEX IF NOT EXISTS issued_invoices_token_idx ON issued_invoices (access_token);
CREATE INDEX IF NOT EXISTS issued_invoices_customer_idx ON issued_invoices (customer_id);
CREATE INDEX IF NOT EXISTS issued_invoices_status_idx ON issued_invoices (status);

-- Itemized line items — confirmed 2026-09-16 (via `AskUserQuestion`),
-- replacing a single flat amount+description so an invoice reads properly
-- once rendered as a PDF. line_amount = quantity * unit_price, computed and
-- stored at write time (not derived live) so a later unit_price edit on a
-- *different* line item never silently reflows an already-issued line.
CREATE TABLE IF NOT EXISTS invoice_line_items (
  id SERIAL PRIMARY KEY,
  invoice_id INTEGER NOT NULL REFERENCES issued_invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL DEFAULT '',
  quantity NUMERIC(12, 2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  line_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS invoice_line_items_invoice_idx ON invoice_line_items (invoice_id);

-- v2.1: extensible fixed currency list (docs/erp-v2-roadmap.md's
-- "Currency as a fixed list" item) — every currency field app-wide becomes
-- a dropdown over this table instead of free text, with an "Other" escape
-- valve that inserts a new row here so it becomes a real option for every
-- future entry too, not just a one-off string.
CREATE TABLE IF NOT EXISTS currencies (
  code TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO currencies (code) VALUES ('OMR'), ('USD'), ('EUR'), ('GBP'), ('AED'), ('SAR')
ON CONFLICT (code) DO NOTHING;
-- Backfill: any currency value already sitting in real data (typed as free
-- text before this table existed) becomes a selectable option too, so
-- switching to a dropdown never makes an existing record's currency
-- unrepresentable.
INSERT INTO currencies (code)
SELECT DISTINCT currency FROM (
  SELECT currency FROM procurement_products
  UNION SELECT salary_currency AS currency FROM employee_details
  UNION SELECT currency FROM purchase_orders
  UNION SELECT currency FROM inventory_items
  UNION SELECT currency FROM accounting_transactions
  UNION SELECT currency FROM exchange_rates
  UNION SELECT currency FROM capital_entries
  UNION SELECT currency FROM investments
  UNION SELECT currency FROM investment_payouts
  UNION SELECT currency FROM government_support
  UNION SELECT currency FROM capital_budgets
  UNION SELECT currency FROM expense_budgets
  UNION SELECT currency FROM recurring_expenses
  UNION SELECT currency FROM financial_accounts
  UNION SELECT currency FROM recurring_income
  UNION SELECT currency FROM issued_invoices
) x
WHERE currency IS NOT NULL AND currency <> ''
ON CONFLICT (code) DO NOTHING;

-- v2.1: monthly-frozen exchange rate snapshots, so a past month's blended
-- total never shifts just because today's rate moved — same "snapshot at
-- write time, not live" precedent VAT already established. `exchange_rates`
-- itself stays the Super-Admin-edited "current" row (shown/edited on
-- Settings); every edit also freezes a copy here for the calendar month the
-- edit happened in, and a later edit in the same month overwrites that same
-- month's row rather than creating a second one. Resolving the rate for a
-- given transaction's own month (lib/currencyDisplay.ts's resolver) walks
-- back to the latest snapshot at or before that month, so a month with no
-- explicit edit simply keeps the last-set rate rather than going
-- unconfigured.
CREATE TABLE IF NOT EXISTS exchange_rate_history (
  currency TEXT NOT NULL,
  effective_month DATE NOT NULL,
  rate_to_base NUMERIC(18, 6) NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (currency, effective_month)
);
-- Backfill: freeze this calendar month's snapshot for every currency that
-- already had a current rate configured before this table existed, so
-- nothing goes "unconfigured for this month" the first time this runs.
INSERT INTO exchange_rate_history (currency, effective_month, rate_to_base)
SELECT currency, date_trunc('month', now())::date, rate_to_base FROM exchange_rates
ON CONFLICT (currency, effective_month) DO NOTHING;

-- Cross-cutting: per-user notification preferences — confirmed 2026-09-18
-- via `AskUserQuestion`: per-module opt-out (not a single global switch),
-- self-service only (no Super-Admin override). A category with no row for
-- a user is enabled by default (matches today's "everyone gets it"
-- behavior exactly) — only an explicit opt-out gets a row.
CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category TEXT NOT NULL, -- procurement | accounting | inventory | hr | ideas | calendar | digests
  enabled BOOLEAN NOT NULL DEFAULT true,
  PRIMARY KEY (user_id, category)
);

-- v3 Phase 1: Process / Strategy / Idea workflow builder — replaces the
-- flat `ideas` table above. See docs/erp-v3-roadmap.md's "Process /
-- Strategy / Idea" section (fully scoped 2026-09-18) and
-- docs/handover.md for the confirmed modeling decisions. One polymorphic
-- `plans` table, not four separate ones: a "Stage" is not a 4th
-- plan_type, it IS a plan_type='process' row with parent_milestone_id
-- set — this is what "a Stage is structurally a Process" means
-- concretely; the Process tab (Phase 3) is literally
-- `WHERE plan_type='process' AND parent_milestone_id IS NULL`.
--
-- Phase 1 (this block): plans (only 'process'/'idea' are actually
-- creatable from the UI yet — 'strategy' is accepted by the CHECK
-- constraint now so the column never needs widening later, but nothing
-- creates one until Phase 3 builds Milestones/Stages), steps,
-- step_prerequisites, plus the `ideas` -> `plans` migration. Deliverables/
-- Minutes of Meeting (Phase 2), Milestones' own CRUD (Phase 3, though the
-- `milestones` table is created now — see the FK note below), and
-- plan_shares (Phase 4) are added in their own later schema blocks — same
-- "add tables as the phase that needs them lands" convention this file
-- already uses for Procurement's Phase 1/Phase 2 tables.
--
-- plans.parent_milestone_id -> milestones(id) and
-- milestones.strategy_plan_id -> plans(id) is a genuine circular
-- reference. Same fix this file already uses for
-- procurement_products.preferred_vendor_id: the column is created plain
-- (no inline FK) here, and the constraint is added once milestones exists.
CREATE TABLE IF NOT EXISTS plans (
  id SERIAL PRIMARY KEY,
  plan_type TEXT NOT NULL CHECK (plan_type IN ('process', 'strategy', 'idea')),
  parent_milestone_id INTEGER,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  start_date DATE,
  -- Duplication ("clone-and-reset-dates") and Idea->Process/Strategy
  -- promotion lineage — both Phase 4 features, columns created now so
  -- Phase 4 needs no migration of its own.
  promoted_from_plan_id INTEGER REFERENCES plans(id) ON DELETE SET NULL,
  duplicated_from_plan_id INTEGER REFERENCES plans(id) ON DELETE SET NULL,
  migrated_from_idea_id INTEGER,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS plans_plan_type_idx ON plans (plan_type);
CREATE INDEX IF NOT EXISTS plans_parent_milestone_id_idx ON plans (parent_milestone_id);

-- A Strategy's Milestones. Table created now (for the FK pair above to
-- resolve); Milestone CRUD itself is a Phase 3 item. Milestone ordering
-- reuses the exact same prerequisite mechanism as steps, one level up
-- (confirmed 2026-09-18): zero-or-one prerequisite Milestone, enforced if
-- set, unconstrained if not.
CREATE TABLE IF NOT EXISTS milestones (
  id SERIAL PRIMARY KEY,
  strategy_plan_id INTEGER NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  prerequisite_milestone_id INTEGER REFERENCES milestones(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS milestones_strategy_plan_id_idx ON milestones (strategy_plan_id);

DO $$ BEGIN
  ALTER TABLE plans
    ADD CONSTRAINT plans_parent_milestone_id_fkey
    FOREIGN KEY (parent_milestone_id) REFERENCES milestones(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 0.2.6: start-date hierarchy + stage ordering.
-- A Milestone gets its own start date (Strategy.start_date <= Milestone <=
-- Stage <= step), enforced in src/lib/planStartRules.ts — a child can't
-- start before its parent. A Stage (plan_type='process' row with
-- parent_milestone_id set) can now name ONE prerequisite sibling Stage
-- (same shape as milestones.prerequisite_milestone_id): ordering/graph
-- edge only, deliberately NOT a done-gate.
ALTER TABLE milestones ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS prerequisite_stage_id INTEGER REFERENCES plans(id) ON DELETE SET NULL;

-- Steps: the workflow unit shared by every plan type (and by a Stage,
-- which is just a plan_type='process' plan). Every step is backed by a
-- real `events` row unconditionally (src/lib/events.ts's
-- createEvent/updateEvent, not duplicated) — this is what makes "a linked
-- step and its Calendar entry are the same underlying record"
-- (docs/erp-v3-roadmap.md) literally true, and is required so an
-- assignee who isn't shared on the plan still sees their own step as an
-- ordinary Calendar entry.
-- No separate `title` (or due date/assignee) column here on purpose — the
-- backing `events` row is the single source of truth for those (its own
-- title/end_at-or-start_at/assignee_id), so there's exactly one place to
-- edit them and no risk of the step and its Calendar entry disagreeing.
CREATE TABLE IF NOT EXISTS steps (
  id SERIAL PRIMARY KEY,
  plan_id INTEGER NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  step_type TEXT NOT NULL CHECK (step_type IN ('task', 'meeting')),
  notes TEXT NOT NULL DEFAULT '',
  -- done/not-done plus Blocked/Skipped/N/A (confirmed 2026-09-18/19) —
  -- 'pending' is the not-done default. Prerequisite/progress semantics
  -- for skipped/na live in src/lib/planSteps.ts (computed live, not
  -- stored): they satisfy downstream prerequisites but are excluded from
  -- the progress percentage.
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'done', 'blocked', 'skipped', 'na')),
  requires_deliverable BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  completed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  overdue_reminder_sent_at TIMESTAMPTZ,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- 0.2.10: "upcoming" (due-soon / starting-soon) reminder, same mark-once-fired
-- pattern as overdue_reminder_sent_at above. Reset when the step's date changes.
ALTER TABLE steps ADD COLUMN IF NOT EXISTS upcoming_reminder_sent_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS steps_plan_id_idx ON steps (plan_id);
CREATE INDEX IF NOT EXISTS steps_event_id_idx ON steps (event_id);
CREATE INDEX IF NOT EXISTS steps_status_idx ON steps (status);

-- Prerequisite graph — a step can wait on more than one prerequisite
-- (confirmed 2026-09-18: "a real graph, not a strict chain"). A plain
-- linear chain is just this table with one row per step.
CREATE TABLE IF NOT EXISTS step_prerequisites (
  step_id INTEGER NOT NULL REFERENCES steps(id) ON DELETE CASCADE,
  prerequisite_step_id INTEGER NOT NULL REFERENCES steps(id) ON DELETE CASCADE,
  PRIMARY KEY (step_id, prerequisite_step_id),
  CHECK (step_id != prerequisite_step_id)
);
CREATE INDEX IF NOT EXISTS step_prerequisites_prerequisite_step_id_idx
  ON step_prerequisites (prerequisite_step_id);

-- 0.2.6: a Meeting step has attendees (the backing event's own
-- event_attendees rows), not an assignee. Any pre-existing meeting step
-- that still carries an assignee has that person moved over to attendees;
-- idempotent — once assignee_id is NULL on every meeting step there's
-- nothing left for either statement to touch.
INSERT INTO event_attendees (event_id, user_id)
  SELECT e.id, e.assignee_id
  FROM steps s JOIN events e ON e.id = s.event_id
  WHERE s.step_type = 'meeting' AND e.assignee_id IS NOT NULL
  ON CONFLICT DO NOTHING;
UPDATE events SET assignee_id = NULL
  WHERE assignee_id IS NOT NULL AND id IN (SELECT event_id FROM steps WHERE step_type = 'meeting');

-- Migration: every existing `ideas` row becomes a plan_type='idea' plan —
-- a real migration, not a parallel system (confirmed 2026-09-18). The old
-- free-text `prerequisites` column has no equivalent in the new
-- step-graph model (it was prose, not structured data), so it's folded
-- into description rather than silently dropped. Migrated Ideas get zero
-- steps — fabricating a workflow for old rows would invent data that
-- never existed; the UI treats an empty workflow as normal. Guarded by
-- migrated_from_idea_id so this block is safely re-runnable. The `ideas`
-- table itself is deliberately NOT dropped here — kept read-only as a
-- safety net for one release, dropped in a follow-up commit once the new
-- module is verified against the real DB.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ideas') THEN
    INSERT INTO plans (plan_type, name, description, start_date, created_by, created_at, updated_at, migrated_from_idea_id)
    SELECT
      'idea',
      i.name,
      CASE WHEN i.prerequisites IS NOT NULL AND i.prerequisites <> ''
        THEN i.description || E'\n\nPrerequisites (migrated): ' || i.prerequisites
        ELSE i.description
      END,
      i.expected_start_date,
      i.created_by,
      i.created_at,
      i.updated_at,
      i.id
    FROM ideas i
    WHERE NOT EXISTS (SELECT 1 FROM plans p WHERE p.migrated_from_idea_id = i.id);
  END IF;
END $$;

-- v3 Phase 2: deliverables + Minutes of Meeting — see
-- docs/erp-v3-roadmap.md's "Process / Strategy / Idea" section and
-- docs/handover.md for the confirmed modeling decisions.

-- A deliverable placeholder on a step: a text answer, or an image/PDF
-- upload, known only after the step happens. A step can have more than
-- one (confirmed 2026-09-18) — each row here is one placeholder, not a
-- cap of one per kind. text_value is only used for kind='text'; image/pdf
-- kinds are filled via step_deliverable_files below instead.
CREATE TABLE IF NOT EXISTS step_deliverable_defs (
  id SERIAL PRIMARY KEY,
  step_id INTEGER NOT NULL REFERENCES steps(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('text', 'image', 'pdf')),
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  text_value TEXT,
  filled_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  filled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS step_deliverable_defs_step_id_idx ON step_deliverable_defs (step_id);

-- Image/PDF deliverable uploads, versioned: re-uploading inserts a new row
-- rather than overwriting — old versions stay retrievable (confirmed
-- 2026-09-18). First table of its kind in this app — every existing
-- upload (procurement/accounting/avatars) is a single TEXT url column
-- with no history. "Current" version is MAX(version_number) per def,
-- computed live (see lib/planDeliverables.ts), not stored as an
-- is_current flag — same "compute live" precedent this app already uses
-- elsewhere.
CREATE TABLE IF NOT EXISTS step_deliverable_files (
  id SERIAL PRIMARY KEY,
  deliverable_def_id INTEGER NOT NULL REFERENCES step_deliverable_defs(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  blob_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER,
  uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (deliverable_def_id, version_number)
);
CREATE INDEX IF NOT EXISTS step_deliverable_files_def_id_idx ON step_deliverable_files (deliverable_def_id);

-- Minutes of Meeting, for Meeting-type steps: light structure (confirmed
-- 2026-09-18), distinct from the step's generic `notes` field, and IS
-- that step's deliverable (not a separate concept) — filling this
-- satisfies requires_deliverable for a meeting step, same as filled
-- deliverable defs do for a task step (see lib/planSteps.ts's
-- isDeliverableGateSatisfied). Only `discussion` is required for the gate
-- (confirmed 2026-09-19) — Attendees/Decisions/Action Items stay optional.
-- One per step (a step only has one meeting), so PRIMARY KEY IS
-- step_id — this is also an upsert target, not insert-then-update.
CREATE TABLE IF NOT EXISTS minutes_of_meeting (
  step_id INTEGER PRIMARY KEY REFERENCES steps(id) ON DELETE CASCADE,
  attendees TEXT NOT NULL DEFAULT '',
  discussion TEXT NOT NULL DEFAULT '',
  decisions TEXT NOT NULL DEFAULT '',
  action_items TEXT NOT NULL DEFAULT '',
  filled_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  filled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- v3 Phase 4: sharing, duplication, promotion — see docs/erp-v3-roadmap.md
-- and docs/handover.md for the confirmed modeling decisions.

-- Who besides Admin-level can view a plan. Confirmed scope override for
-- this build (overrides docs/erp-v3-roadmap.md's "down to Manager-level"
-- language — the app has zero hierarchy/Manager concept: employee_details
-- has only free-text position/department, no manager_id, no departments/
-- teams/projects tables exist anywhere in the schema): Admin picks
-- specific individual users (any role) via multi-select — a superset a
-- later Manager-level auto-expansion can layer on top of with zero
-- rework: that future feature would just insert additional rows here
-- computed from an org-hierarchy lookup, this table's shape doesn't
-- change at all. Keyed on the top-level (parent_milestone_id IS NULL)
-- plan only — sharing a Strategy implicitly grants its Milestones/Stages
-- too (see lib/planShares.ts's canUserViewPlan, which resolves a Stage up
-- to its root Strategy before checking this table).
CREATE TABLE IF NOT EXISTS plan_shares (
  plan_id INTEGER NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shared_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  shared_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (plan_id, user_id)
);
CREATE INDEX IF NOT EXISTS plan_shares_user_id_idx ON plan_shares (user_id);
