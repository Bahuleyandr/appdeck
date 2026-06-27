ALTER TABLE workspaces ADD COLUMN parent_id TEXT;
ALTER TABLE workspaces ADD COLUMN disabled INTEGER NOT NULL DEFAULT 0;

ALTER TABLE service_instances ADD COLUMN icon_path TEXT;
ALTER TABLE service_instances ADD COLUMN disabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE service_instances ADD COLUMN zoom_factor REAL;
ALTER TABLE service_instances ADD COLUMN spellcheck INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS recipe_registry_entries (
  id                 TEXT PRIMARY KEY,
  name               TEXT NOT NULL,
  category           TEXT NOT NULL,
  start_url          TEXT NOT NULL,
  allowed_domains    TEXT NOT NULL DEFAULT '[]',
  aliases            TEXT NOT NULL DEFAULT '[]',
  icon               TEXT,
  icon_path          TEXT,
  default_user_agent TEXT,
  unread_spec        TEXT,
  mobile_mode        INTEGER NOT NULL DEFAULT 0,
  source             TEXT NOT NULL DEFAULT 'seed',
  created_at         INTEGER NOT NULL,
  updated_at         INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_recipe_registry_name ON recipe_registry_entries(name);
CREATE INDEX IF NOT EXISTS idx_recipe_registry_category ON recipe_registry_entries(category);

CREATE TABLE IF NOT EXISTS link_rules (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  priority    INTEGER NOT NULL DEFAULT 100,
  match_type  TEXT NOT NULL,
  pattern     TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id   TEXT,
  enabled     INTEGER NOT NULL DEFAULT 1,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_link_rules_enabled_priority ON link_rules(enabled, priority);

CREATE TABLE IF NOT EXISTS dashboards (
  id           TEXT PRIMARY KEY,
  workspace_id TEXT,
  name         TEXT NOT NULL,
  widgets      TEXT NOT NULL DEFAULT '[]',
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS shortcut_bindings (
  id          TEXT PRIMARY KEY,
  command     TEXT NOT NULL,
  accelerator TEXT NOT NULL,
  scope       TEXT NOT NULL DEFAULT 'global',
  target_id   TEXT,
  enabled     INTEGER NOT NULL DEFAULT 1,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_shortcut_bindings_accel_scope
  ON shortcut_bindings(accelerator, scope, COALESCE(target_id, ''));

CREATE TABLE IF NOT EXISTS permission_policies (
  id                  TEXT PRIMARY KEY,
  service_instance_id TEXT,
  permission          TEXT NOT NULL,
  decision            TEXT NOT NULL DEFAULT 'ask',
  updated_at          INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_permission_policy_unique
  ON permission_policies(COALESCE(service_instance_id, ''), permission);

CREATE TABLE IF NOT EXISTS downloads (
  id                  TEXT PRIMARY KEY,
  service_instance_id TEXT,
  url                 TEXT NOT NULL,
  filename            TEXT NOT NULL,
  mime_type           TEXT,
  total_bytes         INTEGER,
  received_bytes      INTEGER NOT NULL DEFAULT 0,
  state               TEXT NOT NULL,
  path                TEXT,
  started_at          INTEGER NOT NULL,
  completed_at        INTEGER
);

CREATE INDEX IF NOT EXISTS idx_downloads_started ON downloads(started_at DESC);
