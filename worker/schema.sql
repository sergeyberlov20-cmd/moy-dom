-- Схема D1 для «Мой Дом»
-- Применить (новая база):  npx wrangler d1 execute moydom --file=./schema.sql --remote
-- Обновить существующую:   npx wrangler d1 execute moydom --command "ALTER TABLE leads ADD COLUMN reminded_at TEXT" --remote

CREATE TABLE IF NOT EXISTS leads (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  name         TEXT,
  phone        TEXT NOT NULL,
  message      TEXT,
  page         TEXT,
  referrer     TEXT,
  utm          TEXT,
  ip_hash      TEXT,
  status       TEXT NOT NULL DEFAULT 'new',   -- new | inwork | done | spam
  note         TEXT,
  reminded_at  TEXT                            -- когда отправляли напоминание
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

-- Кто пользуется ботом: активность и наличие доступа (для /botstats)
CREATE TABLE IF NOT EXISTS bot_users (
  user_id    TEXT PRIMARY KEY,
  name       TEXT,
  username   TEXT,
  messages   INTEGER NOT NULL DEFAULT 0,
  commands   INTEGER NOT NULL DEFAULT 0,
  allowed    INTEGER NOT NULL DEFAULT 0,
  first_seen TEXT,
  last_seen  TEXT
);

CREATE INDEX IF NOT EXISTS idx_bot_users_last ON bot_users (last_seen);

CREATE INDEX IF NOT EXISTS idx_leads_phone_created ON leads(phone, created_at);

-- Отзывы посетителей сайта (появляются после проверки в боте)
CREATE TABLE IF NOT EXISTS site_reviews (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  name       TEXT NOT NULL,
  rating     INTEGER NOT NULL DEFAULT 5,
  text       TEXT NOT NULL,
  page       TEXT,
  ip_hash    TEXT,
  status     TEXT NOT NULL DEFAULT 'pending'   -- pending | approved | rejected
);

CREATE INDEX IF NOT EXISTS idx_site_reviews_status ON site_reviews (status, created_at DESC);
