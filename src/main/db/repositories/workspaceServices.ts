import type Database from 'better-sqlite3';
import type { WorkspaceService } from '../../../shared/types.js';

export function listWorkspaceServices(db: Database.Database, includeDeleted = false): WorkspaceService[] {
  return db
    .prepare(
      `SELECT * FROM workspace_services ${includeDeleted ? '' : 'WHERE deleted_at IS NULL'} ORDER BY workspace_id ASC, position ASC`
    )
    .all() as WorkspaceService[];
}

export function reorderWorkspaceServices(
  db: Database.Database,
  deviceId: string,
  workspaceId: string,
  orderedIds: string[]
): void {
  const now = Date.now();
  const stmt = db.prepare(
    `UPDATE workspace_services
     SET position = ?, updated_at = ?, rev = rev + 1, origin_device = ?
     WHERE workspace_id = ? AND service_instance_id = ?`
  );
  db.transaction(() => {
    orderedIds.forEach((id, position) => stmt.run(position, now, deviceId, workspaceId, id));
  })();
}
