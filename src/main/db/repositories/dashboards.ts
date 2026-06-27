import type Database from 'better-sqlite3';
import type { Dashboard, DashboardWidget } from '../../../shared/types.js';
import { parseJson, stringifyJson } from './json.js';

interface DashboardRow {
  id: string;
  workspace_id: string | null;
  name: string;
  widgets: string;
  created_at: number;
  updated_at: number;
}

function mapDashboard(row: DashboardRow): Dashboard {
  return { ...row, widgets: parseJson<DashboardWidget[]>(row.widgets, []) };
}

export function listDashboards(db: Database.Database, workspaceId?: string | null): Dashboard[] {
  const rows = workspaceId
    ? (db
        .prepare(
          'SELECT * FROM dashboards WHERE workspace_id = ? OR workspace_id IS NULL ORDER BY name ASC'
        )
        .all(workspaceId) as DashboardRow[])
    : (db.prepare('SELECT * FROM dashboards ORDER BY name ASC').all() as DashboardRow[]);
  return rows.map(mapDashboard);
}

export function upsertDashboard(
  db: Database.Database,
  input: Partial<Dashboard> & Pick<Dashboard, 'name'>
): Dashboard {
  const now = Date.now();
  const id = input.id ?? crypto.randomUUID();
  db.prepare(
    `INSERT INTO dashboards (id, workspace_id, name, widgets, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       workspace_id = excluded.workspace_id, name = excluded.name, widgets = excluded.widgets,
       updated_at = excluded.updated_at`
  ).run(
    id,
    input.workspace_id ?? null,
    input.name,
    stringifyJson(input.widgets ?? defaultWidgets()),
    input.created_at ?? now,
    now
  );
  const row = db.prepare('SELECT * FROM dashboards WHERE id = ?').get(id) as
    | DashboardRow
    | undefined;
  if (!row) throw new Error('Failed to save dashboard');
  return mapDashboard(row);
}

export function deleteDashboard(db: Database.Database, id: string): void {
  db.prepare('DELETE FROM dashboards WHERE id = ?').run(id);
}

export function ensureDefaultDashboard(
  db: Database.Database,
  workspaceId: string | null
): Dashboard {
  const row = db
    .prepare('SELECT * FROM dashboards WHERE workspace_id IS ? ORDER BY created_at ASC LIMIT 1')
    .get(workspaceId) as DashboardRow | undefined;
  if (row) return mapDashboard(row);
  return upsertDashboard(db, {
    name: 'Dashboard',
    workspace_id: workspaceId,
    widgets: defaultWidgets()
  });
}

function defaultWidgets(): DashboardWidget[] {
  return [
    { id: crypto.randomUUID(), type: 'shortcuts', title: 'Shortcuts', config: {} },
    { id: crypto.randomUUID(), type: 'unread', title: 'Unread', config: {} },
    { id: crypto.randomUUID(), type: 'notifications', title: 'Recent', config: { limit: 8 } },
    { id: crypto.randomUUID(), type: 'tasks', title: 'Tasks', config: { limit: 8 } },
    { id: crypto.randomUUID(), type: 'clock', title: 'Clock', config: {} }
  ];
}
