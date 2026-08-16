import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import initSql from '../../src/main/db/migrations/0001_init.sql?raw';
import { LATEST_SCHEMA_VERSION, getSchemaVersion, migrate } from '../../src/main/db/migrate.js';
import { listServiceInstances } from '../../src/main/db/repositories/serviceInstances.js';
import { listWorkspaces } from '../../src/main/db/repositories/workspaces.js';

/** Build a database frozen at schema version 1, as a real v0.0.x install would have. */
function createV1Db(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(initSql);
  db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run('schema_version', '1');
  db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run('device_id', 'device-v1');
  return db;
}

function seedV1Rows(db: Database.Database): { workspaceId: string; serviceId: string } {
  const now = Date.now();
  const workspaceId = 'ws-legacy';
  const serviceId = 'svc-legacy';
  db.prepare(
    `INSERT INTO workspaces (id, name, icon, color, position, focus_rules, sleep_defaults, updated_at, deleted_at, rev, origin_device)
     VALUES (?, 'Legacy workspace', 'home', '#3b82f6', 0, '{}', '{"idleMinutes":30}', ?, NULL, 1, 'device-v1')`
  ).run(workspaceId, now);
  db.prepare(
    `INSERT INTO service_instances (id, recipe_id, profile_id, display_name, partition_key, color, pinned, muted, sleep_policy, custom_css, custom_js, proxy, user_agent, last_url, updated_at, deleted_at, rev, origin_device)
     VALUES (?, 'whatsapp', NULL, 'WhatsApp', 'persist:svc-legacy', NULL, 0, 0, '{}', NULL, '// legacy js', NULL, NULL, NULL, ?, NULL, 1, 'device-v1')`
  ).run(serviceId, now);
  db.prepare(
    `INSERT INTO workspace_services (workspace_id, service_instance_id, position, group_name, updated_at, deleted_at, rev, origin_device)
     VALUES (?, ?, 0, NULL, ?, NULL, 1, 'device-v1')`
  ).run(workspaceId, serviceId, now);
  return { workspaceId, serviceId };
}

describe('migration upgrade from schema v1', () => {
  it('migrates a v1 database to the latest schema version', () => {
    const db = createV1Db();
    expect(getSchemaVersion(db)).toBe(1);

    migrate(db);

    expect(getSchemaVersion(db)).toBe(LATEST_SCHEMA_VERSION);
    // Tables from later migrations exist and are queryable.
    const tables = ['notifications', 'service_tabs', 'recipe_registry_entries', 'automation_rules', 'ai_runs'];
    for (const table of tables) {
      expect(() => db.prepare(`SELECT COUNT(*) FROM ${table}`).get()).not.toThrow();
    }
  });

  it('preserves existing workspace and service rows across the upgrade', () => {
    const db = createV1Db();
    const { workspaceId, serviceId } = seedV1Rows(db);

    migrate(db);

    const workspaces = listWorkspaces(db);
    expect(workspaces.map((workspace) => workspace.id)).toContain(workspaceId);
    expect(workspaces.find((workspace) => workspace.id === workspaceId)?.name).toBe(
      'Legacy workspace'
    );

    const services = listServiceInstances(db);
    const service = services.find((candidate) => candidate.id === serviceId);
    expect(service).toBeDefined();
    expect(service?.recipe_id).toBe('whatsapp');
    expect(service?.display_name).toBe('WhatsApp');
    expect(service?.custom_js).toBe('// legacy js');
  });

  it('does not inject a default workspace into an existing database', () => {
    const db = createV1Db();
    const { workspaceId } = seedV1Rows(db);

    migrate(db);

    const workspaces = listWorkspaces(db);
    expect(workspaces).toHaveLength(1);
    expect(workspaces[0]?.id).toBe(workspaceId);
  });

  it('seeds the recipe registry during the upgrade', () => {
    const db = createV1Db();
    seedV1Rows(db);

    migrate(db);

    const row = db.prepare('SELECT COUNT(*) AS count FROM recipe_registry_entries').get() as {
      count: number;
    };
    expect(row.count).toBeGreaterThan(0);
  });
});
