import type Database from 'better-sqlite3';
import type { WorkspaceService } from '../../../shared/types.js';

export function listWorkspaceServices(db: Database.Database, includeDeleted = false): WorkspaceService[] {
  return db
    .prepare(
      `SELECT * FROM workspace_services ${includeDeleted ? '' : 'WHERE deleted_at IS NULL'} ORDER BY workspace_id ASC, position ASC`
    )
    .all() as WorkspaceService[];
}

/**
 * The workspace that owns a service instance, or null if it belongs to none. Used to route a
 * notification/quick-view click to the workspace holding the service before selecting it.
 * A service can in principle be linked to several workspaces; the lowest position wins so the
 * choice is stable.
 */
export function findWorkspaceIdForService(
  db: Database.Database,
  serviceInstanceId: string
): string | null {
  const row = db
    .prepare(
      `SELECT workspace_id FROM workspace_services
        WHERE service_instance_id = ? AND deleted_at IS NULL
        ORDER BY position ASC, workspace_id ASC
        LIMIT 1`
    )
    .get(serviceInstanceId) as { workspace_id: string } | undefined;
  return row?.workspace_id ?? null;
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
