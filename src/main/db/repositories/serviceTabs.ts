import type Database from 'better-sqlite3';
import type { ServiceTab } from '../../../shared/types.js';
import { toBool } from './json.js';

interface ServiceTabRow {
  id: string;
  service_instance_id: string;
  url: string;
  title: string | null;
  position: number;
  active: number;
  created_at: number;
}

function mapTab(row: ServiceTabRow): ServiceTab {
  return { ...row, active: toBool(row.active) };
}

export function listTabs(db: Database.Database, instanceId: string): ServiceTab[] {
  return (
    db.prepare('SELECT * FROM service_tabs WHERE service_instance_id = ? ORDER BY position ASC, created_at ASC').all(instanceId) as ServiceTabRow[]
  ).map(mapTab);
}

export function getTab(db: Database.Database, id: string): ServiceTab | null {
  const row = db.prepare('SELECT * FROM service_tabs WHERE id = ?').get(id) as ServiceTabRow | undefined;
  return row ? mapTab(row) : null;
}

export function getActiveTab(db: Database.Database, instanceId: string): ServiceTab | null {
  const active = db.prepare('SELECT * FROM service_tabs WHERE service_instance_id = ? AND active = 1 LIMIT 1').get(instanceId) as
    | ServiceTabRow
    | undefined;
  if (active) {
    return mapTab(active);
  }
  const first = db
    .prepare('SELECT * FROM service_tabs WHERE service_instance_id = ? ORDER BY position ASC, created_at ASC LIMIT 1')
    .get(instanceId) as ServiceTabRow | undefined;
  return first ? mapTab(first) : null;
}

/** Guarantees an instance has at least one tab, seeding from its start/last URL. */
export function ensureDefaultTab(db: Database.Database, instanceId: string, fallbackUrl: string): ServiceTab {
  const existing = listTabs(db, instanceId);
  const active = existing.find((tab) => tab.active) ?? existing[0];
  if (active) {
    return active;
  }
  return createTab(db, instanceId, fallbackUrl);
}

export function createTab(db: Database.Database, instanceId: string, url: string): ServiceTab {
  const id = crypto.randomUUID();
  const now = Date.now();
  const positionRow = db
    .prepare('SELECT COALESCE(MAX(position), -1) + 1 AS position FROM service_tabs WHERE service_instance_id = ?')
    .get(instanceId) as { position: number };
  db.transaction(() => {
    db.prepare('UPDATE service_tabs SET active = 0 WHERE service_instance_id = ?').run(instanceId);
    db.prepare('INSERT INTO service_tabs (id, service_instance_id, url, title, position, active, created_at) VALUES (?, ?, ?, NULL, ?, 1, ?)').run(
      id,
      instanceId,
      url,
      positionRow.position,
      now
    );
  })();
  return { id, service_instance_id: instanceId, url, title: null, position: positionRow.position, active: true, created_at: now };
}

export function closeTab(db: Database.Database, id: string): void {
  const tab = getTab(db, id);
  if (!tab) {
    return;
  }
  db.transaction(() => {
    db.prepare('DELETE FROM service_tabs WHERE id = ?').run(id);
    if (tab.active) {
      const next = db
        .prepare('SELECT id FROM service_tabs WHERE service_instance_id = ? ORDER BY position ASC, created_at ASC LIMIT 1')
        .get(tab.service_instance_id) as { id: string } | undefined;
      if (next) {
        db.prepare('UPDATE service_tabs SET active = 1 WHERE id = ?').run(next.id);
      }
    }
  })();
}

export function setActiveTab(db: Database.Database, instanceId: string, tabId: string): void {
  db.transaction(() => {
    db.prepare('UPDATE service_tabs SET active = 0 WHERE service_instance_id = ?').run(instanceId);
    db.prepare('UPDATE service_tabs SET active = 1 WHERE id = ? AND service_instance_id = ?').run(tabId, instanceId);
  })();
}

export function setTabUrlTitle(db: Database.Database, id: string, url: string, title: string | null): void {
  db.prepare('UPDATE service_tabs SET url = ?, title = ? WHERE id = ?').run(url, title, id);
}

export function deleteTabsForInstance(db: Database.Database, instanceId: string): void {
  db.prepare('DELETE FROM service_tabs WHERE service_instance_id = ?').run(instanceId);
}
