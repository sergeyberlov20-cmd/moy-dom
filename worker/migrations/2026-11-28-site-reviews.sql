-- Отзывы посетителей сайта
CREATE TABLE IF NOT EXISTS site_reviews (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  name       TEXT NOT NULL,
  rating     INTEGER NOT NULL DEFAULT 5,
  text       TEXT NOT NULL,
  page       TEXT,
  ip_hash    TEXT,
  status     TEXT NOT NULL DEFAULT 'pending'
);

CREATE INDEX IF NOT EXISTS idx_site_reviews_status ON site_reviews (status, created_at DESC);
