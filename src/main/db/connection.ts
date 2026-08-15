import { app } from 'electron';
import Database from 'better-sqlite3';
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { getSchemaVersion, LATEST_SCHEMA_VERSION, migrate } from './migrate.js';
import { getMeta, setMeta } from './repositories/meta.js';
import { logError } from '../services/log.js';

export interface DbContext {
  db: Database.Database;
  deviceId: string;
}

export function openDatabase(explicitPath?: string): DbContext {
  const basePath = explicitPath ?? app.getPath('userData');
  mkdirSync(basePath, { recursive: true });
  const dbPath = join(basePath, 'appdeck.sqlite');
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  backupBeforeMigration(db, dbPath);
  migrate(db);
  const deviceId = ensureDeviceId(db);
  return { db, deviceId };
}

// Best-effort safety net: keep a copy of the pre-migration database so a botched migration
// can't silently eat the user's data. Only fires for an existing, already-migrated DB.
export function backupBeforeMigration(db: Database.Database, dbPath: string): void {
  const version = getSchemaVersion(db);
  if (version <= 0 || version >= LATEST_SCHEMA_VERSION) {
    return;
  }
  try {
    copyFileSync(dbPath, `${dbPath}.bak-v${version}`);
  } catch (error) {
    logError('db-backup', error);
  }
}

export function ensureDeviceId(db: Database.Database): string {
  const existing = getMeta(db, 'device_id');
  if (existing) {
    return existing;
  }
  const deviceId = crypto.randomUUID();
  setMeta(db, 'device_id', deviceId);
  setMeta(db, 'created_at', String(Date.now()));
  return deviceId;
}
