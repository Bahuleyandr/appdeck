CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workspaces (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  icon            TEXT,
  color           TEXT,
  position        INTEGER NOT NULL DEFAULT 0,
  focus_rules     TEXT NOT NULL DEFAULT '{}',
  sleep_defaults  TEXT NOT NULL DEFAULT '{}',
  updated_at      INTEGER NOT NULL,
  deleted_at      INTEGER,
  rev             INTEGER NOT NULL DEFAULT 1,
  origin_device   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS profiles (
  id            TEXT PRIMARY KEY,
  label         TEXT NOT NULL,
  color         TEXT,
  note          TEXT,
  updated_at    INTEGER NOT NULL,
  deleted_at    INTEGER,
  rev           INTEGER NOT NULL DEFAULT 1,
  origin_device TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS custom_recipes (
  id                 TEXT PRIMARY KEY,
  name               TEXT NOT NULL,
  category           TEXT NOT NULL,
  start_url          TEXT NOT NULL,
  allowed_domains    TEXT NOT NULL DEFAULT '[]',
  icon_path          TEXT,
  default_user_agent TEXT,
  unread_spec        TEXT,
  mobile_mode        INTEGER NOT NULL DEFAULT 0,
  updated_at         INTEGER NOT NULL,
  deleted_at         INTEGER,
  rev                INTEGER NOT NULL DEFAULT 1,
  origin_device      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS service_instances (
  id            TEXT PRIMARY KEY,
  recipe_id     TEXT NOT NULL,
  profile_id    TEXT,
  display_name  TEXT NOT NULL,
  partition_key TEXT NOT NULL,
  color         TEXT,
  pinned        INTEGER NOT NULL DEFAULT 0,
  muted         INTEGER NOT NULL DEFAULT 0,
  sleep_policy  TEXT NOT NULL DEFAULT '{}',
  custom_css    TEXT,
  custom_js     TEXT,
  proxy         TEXT,
  user_agent    TEXT,
  last_url      TEXT,
  updated_at    INTEGER NOT NULL,
  deleted_at    INTEGER,
  rev           INTEGER NOT NULL DEFAULT 1,
  origin_device TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workspace_services (
  workspace_id        TEXT NOT NULL,
  service_instance_id TEXT NOT NULL,
  position            INTEGER NOT NULL DEFAULT 0,
  group_name          TEXT,
  updated_at          INTEGER NOT NULL,
  deleted_at          INTEGER,
  rev                 INTEGER NOT NULL DEFAULT 1,
  origin_device       TEXT NOT NULL,
  PRIMARY KEY (workspace_id, service_instance_id)
);

CREATE TABLE IF NOT EXISTS layouts (
  workspace_id          TEXT PRIMARY KEY,
  mode                  TEXT NOT NULL DEFAULT 'single',
  selected_service_ids  TEXT NOT NULL DEFAULT '[]',
  tile_sizing           TEXT NOT NULL DEFAULT '{}',
  updated_at            INTEGER NOT NULL,
  deleted_at            INTEGER,
  rev                   INTEGER NOT NULL DEFAULT 1,
  origin_device         TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  done        INTEGER NOT NULL DEFAULT 0,
  position    INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL
);
