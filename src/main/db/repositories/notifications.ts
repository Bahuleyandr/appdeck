import type Database from 'better-sqlite3';
import { NOTIFICATION_TTL_MS } from '../../../shared/constants.js';
import type { NotificationRecord } from '../../../shared/types.js';

export function insertNotification(
  db: Database.Database,
  input: { instanceId: string; title: string; body?: string; icon?: string }
): NotificationRecord {
  const now = Date.now();
  const info = db
    .prepare('INSERT INTO notifications (instance_id, title, body, icon, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(input.instanceId, input.title, input.body ?? '', input.icon ?? null, now);
  return {
    id: Number(info.lastInsertRowid),
    instance_id: input.instanceId,
    title: input.title,
    body: input.body ?? '',
    icon: input.icon ?? null,
    created_at: now,
    read_at: null,
    snoozed_until: null
  };
}

export function listNotifications(db: Database.Database, limit = 100, unreadOnly = false): NotificationRecord[] {
  const now = Date.now();
  // Hide notifications snoozed into the future; they resurface once the snooze elapses.
  const clauses = ['(snoozed_until IS NULL OR snoozed_until <= ?)'];
  if (unreadOnly) {
    clauses.push('read_at IS NULL');
  }
  return db
    .prepare(`SELECT * FROM notifications WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC LIMIT ?`)
    .all(now, limit) as NotificationRecord[];
}

export function searchNotifications(db: Database.Database, query: string, limit = 50): NotificationRecord[] {
  const like = `%${query.replace(/[%_]/g, (match) => `\\${match}`)}%`;
  return db
    .prepare(
      `SELECT * FROM notifications
       WHERE (title LIKE ? ESCAPE '\\' OR body LIKE ? ESCAPE '\\')
       ORDER BY created_at DESC LIMIT ?`
    )
    .all(like, like, limit) as NotificationRecord[];
}

export function markNotificationRead(db: Database.Database, id: number): void {
  db.prepare('UPDATE notifications SET read_at = ? WHERE id = ? AND read_at IS NULL').run(Date.now(), id);
}

export function markAllNotificationsRead(db: Database.Database): void {
  db.prepare('UPDATE notifications SET read_at = ? WHERE read_at IS NULL').run(Date.now());
}

export function snoozeNotification(db: Database.Database, id: number, until: number): void {
  db.prepare('UPDATE notifications SET snoozed_until = ? WHERE id = ?').run(until, id);
}

export function clearNotifications(db: Database.Database): void {
  db.prepare('DELETE FROM notifications').run();
}

export function unreadNotificationCount(db: Database.Database): number {
  const row = db
    .prepare('SELECT COUNT(*) AS count FROM notifications WHERE read_at IS NULL AND (snoozed_until IS NULL OR snoozed_until <= ?)')
    .get(Date.now()) as { count: number };
  return row.count;
}

export function pruneOldNotifications(db: Database.Database): void {
  db.prepare('DELETE FROM notifications WHERE created_at < ?').run(Date.now() - NOTIFICATION_TTL_MS);
}
