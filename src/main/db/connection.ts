import { app } from 'electron';
import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { migrate } from './migrate.js';
import { getMeta, setMeta } from './repositories/meta.js';

export interface DbContext {
  db: Database.Database;
  deviceId: string;
}

export function openDatabase(explicitPath?: string): DbContext {
  const basePath = explicitPath ?? app.getPath('userData');
  mkdirSync(basePath, { recursive: true });
  const db = new Database(join(basePath, 'appdeck.sqlite'));
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migrate(db);
  const deviceId = ensureDeviceId(db);
  return { db, deviceId };
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
