import type Database from 'better-sqlite3';
import { basename } from 'node:path';
import type { ExtensionRecord } from '../../../shared/types.js';
import { toBool } from './json.js';

interface ExtensionRow {
  id: string;
  name: string;
  path: string;
  enabled: number;
  created_at: number;
}

function mapExtension(row: ExtensionRow): ExtensionRecord {
  return { ...row, enabled: toBool(row.enabled) };
}

export function listExtensions(db: Database.Database, enabledOnly = false): ExtensionRecord[] {
  const where = enabledOnly ? 'WHERE enabled = 1' : '';
  return (db.prepare(`SELECT * FROM extensions ${where} ORDER BY name ASC`).all() as ExtensionRow[]).map(mapExtension);
}

export function addExtension(db: Database.Database, path: string): ExtensionRecord {
  const id = crypto.randomUUID();
  const now = Date.now();
  db.prepare('INSERT INTO extensions (id, name, path, enabled, created_at) VALUES (?, ?, ?, 1, ?)').run(id, basename(path), path, now);
  return { id, name: basename(path), path, enabled: true, created_at: now };
}

export function removeExtension(db: Database.Database, id: string): void {
  db.prepare('DELETE FROM extensions WHERE id = ?').run(id);
}

export function setExtensionEnabled(db: Database.Database, id: string, enabled: boolean): void {
  db.prepare('UPDATE extensions SET enabled = ? WHERE id = ?').run(enabled ? 1 : 0, id);
}
