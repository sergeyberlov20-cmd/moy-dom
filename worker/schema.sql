-- Схема D1 для «Мой Дом»
-- Применить: npx wrangler d1 execute moydom --file=./schema.sql --remote

CREATE TABLE IF NOT EXISTS leads (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  name       TEXT,
  phone      TEXT NOT NULL,
  message    TEXT,
  page       TEXT,
  referrer   TEXT,
  utm        TEXT,
  ip_hash    TEXT,
  status     TEXT NOT NULL DEFAULT 'new',   -- new | inwork | done | spam
  note       TEXT
);

CREATE INDEX IF NOT EXISTS idx_leads_created ON leads (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_status  ON leads (status);

CREATE TABLE IF NOT EXISTS events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  type       TEXT NOT NULL,   -- pageview | tel_click | form_open | form_submit
  page       TEXT,
  meta       TEXT,
  ip_hash    TEXT
);

CREATE INDEX IF NOT EXISTS idx_events_created ON events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_type    ON events (type);
