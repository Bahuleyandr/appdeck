import type Database from 'better-sqlite3';
import type { WorkspaceSnapshot } from '../../../shared/types.js';
import { getLayout, setLayout } from './layouts.js';
import { parseJson, stringifyJson } from './json.js';
import { listServiceInstances, updateServiceInstance } from './serviceInstances.js';
import { listFocusModes } from './focusModes.js';

interface SnapshotRow {
  id: string;
  workspace_id: string;
  name: string;
  payload_json: string;
  created_at: number;
}

function mapSnapshot(row: SnapshotRow): WorkspaceSnapshot {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    name: row.name,
    payload: parseJson<WorkspaceSnapshot['payload']>(row.payload_json, {
      layout: null,
      services: [],
      focusModes: [],
      selectedServiceIds: [],
      createdFrom: row.workspace_id
    }),
    created_at: row.created_at
  };
}

export function listWorkspaceSnapshots(
  db: Database.Database,
  workspaceId?: string | null
): WorkspaceSnapshot[] {
  const rows = workspaceId
    ? (db
        .prepare(
          'SELECT * FROM workspace_snapshots WHERE workspace_id = ? ORDER BY created_at DESC'
        )
        .all(workspaceId) as SnapshotRow[])
    : (db
        .prepare('SELECT * FROM workspace_snapshots ORDER BY created_at DESC')
        .all() as SnapshotRow[]);
  return rows.map(mapSnapshot);
}

export function getWorkspaceSnapshot(db: Database.Database, id: string): WorkspaceSnapshot | null {
  const row = db.prepare('SELECT * FROM workspace_snapshots WHERE id = ?').get(id) as
    | SnapshotRow
    | undefined;
  return row ? mapSnapshot(row) : null;
}

export function createWorkspaceSnapshot(
  db: Database.Database,
  deviceId: string,
  workspaceId: string,
  name: string
): WorkspaceSnapshot {
  const now = Date.now();
  const layout = getLayout(db, deviceId, workspaceId);
  const services = listServiceInstances(db, workspaceId);
  const focusModes = listFocusModes(db).filter((mode) => mode.workspace_id === workspaceId);
  const id = crypto.randomUUID();
  const payload: WorkspaceSnapshot['payload'] = {
    layout,
    services,
    focusModes,
    selectedServiceIds: layout.selected_service_ids,
    createdFrom: workspaceId
  };
  db.prepare(
    `INSERT INTO workspace_snapshots (id, workspace_id, name, payload_json, created_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(id, workspaceId, name, stringifyJson(payload), now);
  const snapshot = getWorkspaceSnapshot(db, id);
  if (!snapshot) throw new Error('Failed to create snapshot');
  return snapshot;
}

export function restoreWorkspaceSnapshot(
  db: Database.Database,
  deviceId: string,
  id: string
): WorkspaceSnapshot {
  const snapshot = getWorkspaceSnapshot(db, id);
  if (!snapshot) throw new Error('Snapshot not found');
  const layout = snapshot.payload.layout;
  if (layout) {
    setLayout(
      db,
      deviceId,
      snapshot.workspace_id,
      layout.mode,
      snapshot.payload.selectedServiceIds,
      layout.tile_sizing
    );
  }
  for (const service of snapshot.payload.services) {
    updateServiceInstance(db, deviceId, service.id, {
      pinned: service.pinned,
      muted: service.muted,
      disabled: service.disabled,
      sleep_policy: service.sleep_policy,
      user_agent: service.user_agent,
      zoom_factor: service.zoom_factor,
      spellcheck: service.spellcheck
    });
  }
  return snapshot;
}

export function deleteWorkspaceSnapshot(db: Database.Database, id: string): void {
  db.prepare('DELETE FROM workspace_snapshots WHERE id = ?').run(id);
}
