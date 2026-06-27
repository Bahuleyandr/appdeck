import type Database from 'better-sqlite3';
import type { DownloadRecord } from '../../../shared/types.js';

export function listDownloads(db: Database.Database, limit = 100): DownloadRecord[] {
  return db
    .prepare('SELECT * FROM downloads ORDER BY started_at DESC LIMIT ?')
    .all(limit) as DownloadRecord[];
}

export function upsertDownload(
  db: Database.Database,
  input: Partial<DownloadRecord> & Pick<DownloadRecord, 'url' | 'filename' | 'state'>
): DownloadRecord {
  const id = input.id ?? crypto.randomUUID();
  const startedAt = input.started_at ?? Date.now();
  db.prepare(
    `INSERT INTO downloads
      (id, service_instance_id, url, filename, mime_type, total_bytes, received_bytes, state, path, started_at, completed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       service_instance_id = excluded.service_instance_id, filename = excluded.filename,
       mime_type = excluded.mime_type, total_bytes = excluded.total_bytes,
       received_bytes = excluded.received_bytes, state = excluded.state, path = excluded.path,
       completed_at = excluded.completed_at`
  ).run(
    id,
    input.service_instance_id ?? null,
    input.url,
    input.filename,
    input.mime_type ?? null,
    input.total_bytes ?? null,
    input.received_bytes ?? 0,
    input.state,
    input.path ?? null,
    startedAt,
    input.completed_at ?? null
  );
  const row = db.prepare('SELECT * FROM downloads WHERE id = ?').get(id) as
    | DownloadRecord
    | undefined;
  if (!row) throw new Error('Failed to save download');
  return row;
}

export function clearDownloads(db: Database.Database): void {
  db.prepare('DELETE FROM downloads').run();
}
