-- Unified notification inbox: every captured service notification is persisted here.
CREATE TABLE IF NOT EXISTS notifications (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  instance_id   TEXT NOT NULL,
  title         TEXT NOT NULL,
  body          TEXT NOT NULL DEFAULT '',
  icon          TEXT,
  created_at    INTEGER NOT NULL,
  read_at       INTEGER,
  snoozed_until INTEGER
);

CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_instance ON notifications(instance_id);

-- Unpacked Chrome extensions loaded into every service partition (local-only, not synced).
CREATE TABLE IF NOT EXISTS extensions (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  path       TEXT NOT NULL,
  enabled    INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);
