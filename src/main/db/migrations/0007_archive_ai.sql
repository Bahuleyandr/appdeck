-- Full-text search over the notification archive. External-content FTS5 table kept in sync by
-- triggers; searchNotifications falls back to LIKE if this table is ever missing.
CREATE VIRTUAL TABLE IF NOT EXISTS notifications_fts USING fts5(
  title, body, content='notifications', content_rowid='id'
);

CREATE TRIGGER IF NOT EXISTS notifications_ai AFTER INSERT ON notifications BEGIN
  INSERT INTO notifications_fts(rowid, title, body) VALUES (new.id, new.title, new.body);
END;

CREATE TRIGGER IF NOT EXISTS notifications_ad AFTER DELETE ON notifications BEGIN
  INSERT INTO notifications_fts(notifications_fts, rowid, title, body)
  VALUES ('delete', old.id, old.title, old.body);
END;

CREATE TRIGGER IF NOT EXISTS notifications_au AFTER UPDATE ON notifications BEGIN
  INSERT INTO notifications_fts(notifications_fts, rowid, title, body)
  VALUES ('delete', old.id, old.title, old.body);
  INSERT INTO notifications_fts(rowid, title, body) VALUES (new.id, new.title, new.body);
END;

-- Backfill existing rows into the index.
INSERT INTO notifications_fts(rowid, title, body)
  SELECT id, title, body FROM notifications;

-- Outputs of scheduled/manual AI runs (briefings, saved prompts). Local-only, never synced.
CREATE TABLE IF NOT EXISTS ai_runs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  kind       TEXT NOT NULL,
  title      TEXT NOT NULL,
  text       TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_runs_created ON ai_runs(created_at DESC);
