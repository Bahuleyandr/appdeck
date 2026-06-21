import type Database from 'better-sqlite3';
import type { Layout, LayoutMode } from '../../../shared/types.js';
import { parseJson, stringifyJson } from './json.js';

interface LayoutRow {
  workspace_id: string;
  mode: LayoutMode;
  selected_service_ids: string;
  tile_sizing: string;
  updated_at: number;
  deleted_at: number | null;
  rev: number;
  origin_device: string;
}

function mapLayout(row: LayoutRow): Layout {
  return {
    ...row,
    selected_service_ids: parseJson<string[]>(row.selected_service_ids, []),
    tile_sizing: parseJson<Record<string, unknown>>(row.tile_sizing, {})
  };
}

export function listLayouts(db: Database.Database, includeDeleted = false): Layout[] {
  const rows = db
    .prepare(`SELECT * FROM layouts ${includeDeleted ? '' : 'WHERE deleted_at IS NULL'} ORDER BY workspace_id ASC`)
    .all() as LayoutRow[];
  return rows.map(mapLayout);
}

export function getLayout(db: Database.Database, deviceId: string, workspaceId: string): Layout {
  const row = db.prepare('SELECT * FROM layouts WHERE workspace_id = ?').get(workspaceId) as LayoutRow | undefined;
  if (row) {
    return mapLayout(row);
  }
  const now = Date.now();
  db.prepare(
    `INSERT INTO layouts
      (workspace_id, mode, selected_service_ids, tile_sizing, updated_at, deleted_at, rev, origin_device)
     VALUES (?, 'single', '[]', '{}', ?, NULL, 1, ?)`
  ).run(workspaceId, now, deviceId);
  const created = db.prepare('SELECT * FROM layouts WHERE workspace_id = ?').get(workspaceId) as LayoutRow | undefined;
  if (!created) throw new Error('Failed to create layout');
  return mapLayout(created);
}

export function setLayout(
  db: Database.Database,
  deviceId: string,
  workspaceId: string,
  mode: LayoutMode,
  selectedServiceIds: string[],
  tileSizing: Record<string, unknown>
): void {
  const now = Date.now();
  db.prepare(
    `INSERT INTO layouts
      (workspace_id, mode, selected_service_ids, tile_sizing, updated_at, deleted_at, rev, origin_device)
     VALUES (?, ?, ?, ?, ?, NULL, 1, ?)
     ON CONFLICT(workspace_id) DO UPDATE SET
       mode = excluded.mode,
       selected_service_ids = excluded.selected_service_ids,
       tile_sizing = excluded.tile_sizing,
       updated_at = excluded.updated_at,
       rev = layouts.rev + 1,
       origin_device = excluded.origin_device`
  ).run(workspaceId, mode, stringifyJson(selectedServiceIds), stringifyJson(tileSizing), now, deviceId);
}
