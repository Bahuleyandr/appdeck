import type Database from 'better-sqlite3';
import type { QuickViewState, UnreadCount } from '../../shared/types.js';
import { listNotifications } from '../db/repositories/notifications.js';
import { listServiceInstances } from '../db/repositories/serviceInstances.js';
import { getSetting } from '../db/repositories/settings.js';

export const QUICK_VIEW_NOTIFICATION_LIMIT = 20;
export const QUICK_VIEW_BODY_MAX_CHARS = 140;

const ZERO_UNREAD: UnreadCount = { direct: 0, indirect: 0 };

/**
 * Builds the popover snapshot from data main already holds: the badge service's in-memory unread
 * map and the SQLite notification archive. Reading it never touches a WebContentsView, so parked
 * or dozing services stay parked.
 */
export function buildQuickViewState(
  db: Database.Database,
  unreadCounts: ReadonlyMap<string, UnreadCount>
): QuickViewState {
  const instances = listServiceInstances(db);
  const nameById = new Map(instances.map((instance) => [instance.id, instance.display_name]));

  const services = instances
    .filter((instance) => !instance.disabled)
    .map((instance) => ({
      id: instance.id,
      name: instance.display_name,
      color: instance.color,
      muted: instance.muted,
      unread: unreadCounts.get(instance.id) ?? ZERO_UNREAD
    }))
    // Unread services first (direct before indirect), then stable by name.
    .sort(
      (a, b) =>
        b.unread.direct - a.unread.direct ||
        b.unread.indirect - a.unread.indirect ||
        a.name.localeCompare(b.name)
    );

  const notifications = listNotifications(db, QUICK_VIEW_NOTIFICATION_LIMIT).map((record) => ({
    id: record.id,
    serviceId: record.instance_id,
    serviceName: nameById.get(record.instance_id) ?? 'AppDeck',
    title: record.title,
    body: truncate(record.body, QUICK_VIEW_BODY_MAX_CHARS),
    timestamp: record.created_at
  }));

  return {
    services,
    notifications,
    totalUnread: services.reduce((sum, service) => sum + service.unread.direct, 0),
    theme: getSetting(db, 'theme') || 'system'
  };
}

function truncate(text: string, maxChars: number): string {
  return text.length <= maxChars ? text : `${text.slice(0, maxChars - 1).trimEnd()}…`;
}
