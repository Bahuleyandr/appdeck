CREATE TABLE IF NOT EXISTS ai_prompts (
  id         TEXT PRIMARY KEY,
  title      TEXT NOT NULL,
  prompt     TEXT NOT NULL,
  provider   TEXT,
  model      TEXT,
  local_only INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS saved_tab_sessions (
  id          TEXT PRIMARY KEY,
  workspace_id TEXT,
  name        TEXT NOT NULL,
  service_ids TEXT NOT NULL DEFAULT '[]',
  created_at  INTEGER NOT NULL
);
