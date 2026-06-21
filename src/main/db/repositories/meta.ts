import type Database from 'better-sqlite3';

export function getMeta(db: Database.Database, key: string): string | null {
  const row = db.prepare('SELECT value FROM meta WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setMeta(db: Database.Database, key: string, value: string): void {
  db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run(key, value);
}

export function deleteMeta(db: Database.Database, key: string): void {
  db.prepare('DELETE FROM meta WHERE key = ?').run(key);
}
