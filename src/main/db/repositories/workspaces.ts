import type Database from 'better-sqlite3';
import type { FocusRules, SleepPolicy, Workspace } from '../../../shared/types.js';
import { parseJson, stringifyJson, toBool } from './json.js';

interface WorkspaceRow {
  id: string;
  parent_id: string | null;
  name: string;
  icon: string | null;
  color: string | null;
  position: number;
  disabled: number;
  focus_rules: string;
  sleep_defaults: string;
  updated_at: number;
  deleted_at: number | null;
  rev: number;
  origin_device: string;
}

function mapWorkspace(row: WorkspaceRow): Workspace {
  return {
    ...row,
    disabled: toBool(row.disabled),
    focus_rules: parseJson<FocusRules>(row.focus_rules, {}),
    sleep_defaults: parseJson<SleepPolicy>(row.sleep_defaults, {})
  };
}

export function listWorkspaces(db: Database.Database, includeDeleted = false): Workspace[] {
  const rows = db
    .prepare(
      `SELECT * FROM workspaces ${includeDeleted ? '' : 'WHERE deleted_at IS NULL'} ORDER BY position ASC, name ASC`
    )
    .all() as WorkspaceRow[];
  return rows.map(mapWorkspace);
}

export function getWorkspace(db: Database.Database, id: string): Workspace | null {
  const row = db.prepare('SELECT * FROM workspaces WHERE id = ?').get(id) as
    | WorkspaceRow
    | undefined;
  return row ? mapWorkspace(row) : null;
}

export function createWorkspace(
  db: Database.Database,
  deviceId: string,
  input: { name: string; icon?: string | null; color?: string | null; parentId?: string | null }
): Workspace {
  const now = Date.now();
  const id = crypto.randomUUID();
  const positionRow = db
    .prepare('SELECT COALESCE(MAX(position), -1) + 1 AS position FROM workspaces')
    .get() as { position: number };
  db.prepare(
    `INSERT INTO workspaces
      (id, parent_id, name, icon, color, position, disabled, focus_rules, sleep_defaults, updated_at, deleted_at, rev, origin_device)
     VALUES (?, ?, ?, ?, ?, ?, 0, '{}', '{"idleMinutes":30}', ?, NULL, 1, ?)`
  ).run(
    id,
    input.parentId ?? null,
    input.name,
    input.icon ?? null,
    input.color ?? null,
    positionRow.position,
    now,
    deviceId
  );
  db.prepare(
    `INSERT INTO layouts
      (workspace_id, mode, selected_service_ids, tile_sizing, updated_at, deleted_at, rev, origin_device)
     VALUES (?, 'single', '[]', '{}', ?, NULL, 1, ?)`
  ).run(id, now, deviceId);
  const created = getWorkspace(db, id);
  if (!created) throw new Error('Failed to create workspace');
  return created;
}

export function updateWorkspace(
  db: Database.Database,
  deviceId: string,
  id: string,
  patch: Partial<
    Pick<
      Workspace,
      'parent_id' | 'name' | 'icon' | 'color' | 'disabled' | 'focus_rules' | 'sleep_defaults'
    >
  >
): Workspace {
  const current = getWorkspace(db, id);
  if (!current) throw new Error(`Workspace not found: ${id}`);
  const next = { ...current, ...patch };
  db.prepare(
    `UPDATE workspaces
     SET parent_id = ?, name = ?, icon = ?, color = ?, disabled = ?, focus_rules = ?, sleep_defaults = ?,
         updated_at = ?, rev = rev + 1, origin_device = ?
     WHERE id = ?`
  ).run(
    next.parent_id,
    next.name,
    next.icon,
    next.color,
    next.disabled ? 1 : 0,
    stringifyJson(next.focus_rules),
    stringifyJson(next.sleep_defaults),
    Date.now(),
    deviceId,
    id
  );
  const updated = getWorkspace(db, id);
  if (!updated) throw new Error('Failed to update workspace');
  return updated;
}

export function tombstoneWorkspace(db: Database.Database, deviceId: string, id: string): void {
  const now = Date.now();
  db.transaction(() => {
    db.prepare(
      'UPDATE workspaces SET deleted_at = ?, updated_at = ?, rev = rev + 1, origin_device = ? WHERE id = ?'
    ).run(now, now, deviceId, id);
    db.prepare(
      'UPDATE workspace_services SET deleted_at = ?, updated_at = ?, rev = rev + 1, origin_device = ? WHERE workspace_id = ? AND deleted_at IS NULL'
    ).run(now, now, deviceId, id);
    db.prepare(
      'UPDATE layouts SET deleted_at = ?, updated_at = ?, rev = rev + 1, origin_device = ? WHERE workspace_id = ? AND deleted_at IS NULL'
    ).run(now, now, deviceId, id);
  })();
}

export function reorderWorkspaces(
  db: Database.Database,
  deviceId: string,
  orderedIds: string[]
): void {
  const now = Date.now();
  const stmt = db.prepare(
    'UPDATE workspaces SET position = ?, updated_at = ?, rev = rev + 1, origin_device = ? WHERE id = ?'
  );
  db.transaction(() => {
    orderedIds.forEach((id, position) => stmt.run(position, now, deviceId, id));
  })();
}
