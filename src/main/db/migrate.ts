import type Database from 'better-sqlite3';
import initSql from './migrations/0001_init.sql?raw';
import notificationsSql from './migrations/0002_notifications.sql?raw';
import serviceTabsSql from './migrations/0003_service_tabs.sql?raw';
import personalProSql from './migrations/0004_personal_pro.sql?raw';
import moatsSql from './migrations/0005_moats.sql?raw';
import beyondParitySql from './migrations/0006_beyond_parity.sql?raw';
import archiveAiSql from './migrations/0007_archive_ai.sql?raw';
import { DEFAULT_WORKSPACE_NAME } from '../../shared/constants.js';
import { grandfatherExistingCustomCode } from '../services/customCode.js';
import { seedRecipeRegistry } from './repositories/recipeRegistry.js';

const MIGRATIONS: Array<{ version: number; sql: string }> = [
  { version: 1, sql: initSql },
  { version: 2, sql: notificationsSql },
  { version: 3, sql: serviceTabsSql },
  { version: 4, sql: personalProSql },
  { version: 5, sql: moatsSql },
  { version: 6, sql: beyondParitySql },
  { version: 7, sql: archiveAiSql }
];

function tableExists(db: Database.Database, tableName: string): boolean {
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?")
    .get(tableName) as { name: string } | undefined;
  return Boolean(row);
}

function getSchemaVersion(db: Database.Database): number {
  if (!tableExists(db, 'meta')) {
    return 0;
  }
  const row = db.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get() as
    | { value: string }
    | undefined;
  return row ? Number(row.value) : 0;
}

export function migrate(db: Database.Database): void {
  const current = getSchemaVersion(db);
  for (const migration of MIGRATIONS) {
    if (current < migration.version) {
      db.transaction(() => {
        db.exec(migration.sql);
        db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run(
          'schema_version',
          String(migration.version)
        );
      })();
    }
  }
  seedDefaultWorkspace(db);
  if (getSchemaVersion(db) >= 4) {
    seedRecipeRegistry(db);
  }
  grandfatherExistingCustomCode(db);
}

function seedDefaultWorkspace(db: Database.Database): void {
  const seeded = db.prepare("SELECT value FROM meta WHERE key = 'seeded'").get() as
    | { value: string }
    | undefined;
  if (seeded) {
    return;
  }
  const row = db.prepare('SELECT COUNT(*) AS count FROM workspaces').get() as { count: number };
  if (row.count > 0) {
    // Existing data (e.g. adopted via sync) — mark seeded without creating a default.
    db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run('seeded', '1');
    return;
  }
  const now = Date.now();
  const deviceIdRow = db.prepare("SELECT value FROM meta WHERE key = 'device_id'").get() as
    | { value: string }
    | undefined;
  const deviceId = deviceIdRow?.value ?? crypto.randomUUID();
  db.prepare('INSERT OR IGNORE INTO meta (key, value) VALUES (?, ?)').run('device_id', deviceId);
  const workspaceId = crypto.randomUUID();
  db.prepare(
    `INSERT INTO workspaces
      (id, name, icon, color, position, focus_rules, sleep_defaults, updated_at, deleted_at, rev, origin_device)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 1, ?)`
  ).run(
    workspaceId,
    DEFAULT_WORKSPACE_NAME,
    'home',
    '#3b82f6',
    0,
    '{}',
    '{"idleMinutes":30}',
    now,
    deviceId
  );
  db.prepare(
    `INSERT INTO layouts
      (workspace_id, mode, selected_service_ids, tile_sizing, updated_at, deleted_at, rev, origin_device)
     VALUES (?, 'single', '[]', '{}', ?, NULL, 1, ?)`
  ).run(workspaceId, now, deviceId);
  db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run('seeded', '1');
}
