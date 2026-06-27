import type Database from 'better-sqlite3';
import type { DashboardSnapshot } from '../../shared/types.js';
import { listDashboards } from '../db/repositories/dashboards.js';
import { listDownloads } from '../db/repositories/downloads.js';
import { listNotifications, unreadNotificationCount } from '../db/repositories/notifications.js';
import { listSavedTabSessions } from '../db/repositories/savedSessions.js';
import { listServiceInstances } from '../db/repositories/serviceInstances.js';
import { listShortcuts } from '../db/repositories/shortcuts.js';
import { listTasks } from '../db/repositories/tasks.js';

export function buildDashboardSnapshot(
  db: Database.Database,
  workspaceId?: string | null
): DashboardSnapshot {
  return {
    dashboards: listDashboards(db, workspaceId),
    services: listServiceInstances(db, workspaceId ?? undefined).map((service) => ({
      id: service.id,
      display_name: service.display_name,
      color: service.color,
      pinned: service.pinned,
      muted: service.muted,
      disabled: service.disabled
    })),
    tasks: listTasks(db).slice(0, 12),
    notifications: listNotifications(db, 12, false),
    downloads: listDownloads(db, 8),
    shortcuts: listShortcuts(db).slice(0, 12),
    savedSessions: listSavedTabSessions(db, workspaceId),
    unreadTotal: unreadNotificationCount(db),
    generatedAt: Date.now()
  };
}
