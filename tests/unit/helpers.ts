import Database from 'better-sqlite3';
import { migrate } from '../../src/main/db/migrate.js';
import { getMeta } from '../../src/main/db/repositories/meta.js';

export function createTestDb(): { db: Database.Database; deviceId: string } {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  migrate(db);
  const deviceId = getMeta(db, 'device_id');
  if (!deviceId) {
    throw new Error('Test DB missing device id');
  }
  return { db, deviceId };
}
