-- Nested tabs per service instance. All tabs of an instance share its Chromium partition
-- (same login). Local-only (not synced) — like last_url.
CREATE TABLE IF NOT EXISTS service_tabs (
  id                  TEXT PRIMARY KEY,
  service_instance_id TEXT NOT NULL,
  url                 TEXT NOT NULL,
  title               TEXT,
  position            INTEGER NOT NULL DEFAULT 0,
  active              INTEGER NOT NULL DEFAULT 0,
  created_at          INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_service_tabs_instance ON service_tabs(service_instance_id);
