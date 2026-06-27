import type Database from 'better-sqlite3';
import type { PersonalAnalytics, TrackerStats } from '../../shared/types.js';
import { listNotifications, unreadNotificationCount } from '../db/repositories/notifications.js';
import { listServiceInstances } from '../db/repositories/serviceInstances.js';
import { listTasks } from '../db/repositories/tasks.js';
import { collectMetrics } from './metrics.js';

export function buildPersonalAnalytics(
  db: Database.Database,
  trackerStats: TrackerStats
): PersonalAnalytics {
  const services = listServiceInstances(db);
  const notifications = listNotifications(db, 500);
  const tasks = listTasks(db);
  const metrics = collectMetrics();
  const notificationCounts = new Map<string, number>();
  for (const notification of notifications) {
    notificationCounts.set(
      notification.instance_id,
      (notificationCounts.get(notification.instance_id) ?? 0) + 1
    );
  }
  const noisyServices = [...notificationCounts.entries()]
    .map(([serviceId, count]) => ({
      serviceId,
      name: services.find((service) => service.id === serviceId)?.display_name ?? 'Service',
      notifications: count
    }))
    .sort((a, b) => b.notifications - a.notifications)
    .slice(0, 8);
  return {
    generatedAt: Date.now(),
    totalServices: services.length,
    activeServices: services.filter((service) => !service.disabled).length,
    mutedServices: services.filter((service) => service.muted).length,
    pinnedServices: services.filter((service) => service.pinned).length,
    unreadTotal: unreadNotificationCount(db),
    notificationVolume: notifications.length,
    completedTasks: tasks.filter((task) => task.done).length,
    openTasks: tasks.filter((task) => !task.done).length,
    trackerBlocks: trackerStats,
    noisyServices,
    memoryTop: metrics.processes.sort((a, b) => b.memoryMB - a.memoryMB).slice(0, 8)
  };
}
