import type Database from 'better-sqlite3';
import type { SavedTabSession } from '../../../shared/types.js';
import { parseJson, stringifyJson } from './json.js';

interface SavedTabSessionRow extends Omit<SavedTabSession, 'service_ids'> {
  service_ids: string;
}

function mapSession(row: SavedTabSessionRow): SavedTabSession {
  return { ...row, service_ids: parseJson<string[]>(row.service_ids, []) };
}

export function listSavedTabSessions(
  db: Database.Database,
  workspaceId?: string | null
): SavedTabSession[] {
  const rows = workspaceId
    ? (db
        .prepare(
          'SELECT * FROM saved_tab_sessions WHERE workspace_id = ? OR workspace_id IS NULL ORDER BY created_at DESC'
        )
        .all(workspaceId) as SavedTabSessionRow[])
    : (db
        .prepare('SELECT * FROM saved_tab_sessions ORDER BY created_at DESC')
        .all() as SavedTabSessionRow[]);
  return rows.map(mapSession);
}

export function createSavedTabSession(
  db: Database.Database,
  input: { workspaceId?: string | null; name: string; serviceIds: string[] }
): SavedTabSession {
  const id = crypto.randomUUID();
  const now = Date.now();
  db.prepare(
    `INSERT INTO saved_tab_sessions (id, workspace_id, name, service_ids, created_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(id, input.workspaceId ?? null, input.name, stringifyJson(input.serviceIds), now);
  const row = db.prepare('SELECT * FROM saved_tab_sessions WHERE id = ?').get(id) as
    | SavedTabSessionRow
    | undefined;
  if (!row) throw new Error('Failed to save tab session');
  return mapSession(row);
}
