CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'admin';

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
