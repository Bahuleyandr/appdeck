import type Database from 'better-sqlite3';
import type { NotificationRecord } from '../../../shared/types.js';
import { getMeta, setMeta } from './meta.js';
import { getSetting } from './settings.js';

const DEFAULT_RETENTION_DAYS = 30;
const MAX_ROWS_PER_INSTANCE = 5000;
const INBOX_SEEN_KEY = 'inbox_last_seen_at';

export const NOTIFICATION_DEDUP_MS = 30_000;

export function insertNotification(
  db: Database.Database,
  input: { instanceId: string; title: string; body?: string; icon?: string }
): NotificationRecord {
  const now = Date.now();
  const body = input.body ?? '';
  const existing = db
    .prepare(
      `SELECT * FROM notifications
       WHERE instance_id = ? AND title = ? AND body = ? AND created_at >= ?
       ORDER BY created_at DESC LIMIT 1`
    )
    .get(input.instanceId, input.title, body, now - NOTIFICATION_DEDUP_MS) as
    | NotificationRecord
    | undefined;
  if (existing) {
    return existing;
  }
  const info = db
    .prepare(
      'INSERT INTO notifications (instance_id, title, body, icon, created_at) VALUES (?, ?, ?, ?, ?)'
    )
    .run(input.instanceId, input.title, body, input.icon ?? null, now);
  return {
    id: Number(info.lastInsertRowid),
    instance_id: input.instanceId,
    title: input.title,
    body,
    icon: input.icon ?? null,
    created_at: now,
    read_at: null,
    snoozed_until: null
  };
}

export function listNotifications(
  db: Database.Database,
  limit = 100,
  unreadOnly = false,
  beforeId?: number
): NotificationRecord[] {
  const now = Date.now();
  // Hide notifications snoozed into the future; they resurface once the snooze elapses.
  const clauses = ['(snoozed_until IS NULL OR snoozed_until <= ?)'];
  const params: Array<number> = [now];
  if (unreadOnly) {
    clauses.push('read_at IS NULL');
  }
  if (beforeId !== undefined) {
    clauses.push('id < ?');
    params.push(beforeId);
  }
  params.push(limit);
  return db
    .prepare(
      `SELECT * FROM notifications WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC, id DESC LIMIT ?`
    )
    .all(...params) as NotificationRecord[];
}

// Quote each token (so FTS operators like -, OR, ( ) are inert) and add a trailing * for
// prefix matching. Returns null for queries with no indexable tokens.
function ftsMatchExpression(query: string): string | null {
  const tokens = query
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
  if (!tokens.length) {
    return null;
  }
  return tokens.map((token) => `"${token}"*`).join(' ');
}

export function searchNotifications(
  db: Database.Database,
  query: string,
  limit = 50
): NotificationRecord[] {
  const match = ftsMatchExpression(query);
  if (match) {
    try {
      return db
        .prepare(
          `SELECT n.* FROM notifications_fts f
           JOIN notifications n ON n.id = f.rowid
           WHERE notifications_fts MATCH ?
           ORDER BY bm25(notifications_fts), n.created_at DESC
           LIMIT ?`
        )
        .all(match, limit) as NotificationRecord[];
    } catch {
      // FTS table missing or query rejected — fall through to the LIKE path below.
    }
  }
  const like = `%${query.replace(/[%_]/g, (matched) => `\\${matched}`)}%`;
  return db
    .prepare(
      `SELECT * FROM notifications
       WHERE (title LIKE ? ESCAPE '\\' OR body LIKE ? ESCAPE '\\')
       ORDER BY created_at DESC LIMIT ?`
    )
    .all(like, like, limit) as NotificationRecord[];
}

export function markNotificationRead(db: Database.Database, id: number): void {
  db.prepare('UPDATE notifications SET read_at = ? WHERE id = ? AND read_at IS NULL').run(
    Date.now(),
    id
  );
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
    .prepare(
      'SELECT COUNT(*) AS count FROM notifications WHERE read_at IS NULL AND (snoozed_until IS NULL OR snoozed_until <= ?)'
    )
    .get(Date.now()) as { count: number };
  return row.count;
}

export function pruneOldNotifications(db: Database.Database): void {
  const configured = Number.parseInt(getSetting(db, 'notification_retention_days'), 10);
  const retentionDays =
    Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_RETENTION_DAYS;
  db.prepare('DELETE FROM notifications WHERE created_at < ?').run(
    Date.now() - retentionDays * 24 * 60 * 60_000
  );
  // Bound each service's archive so one chatty service can't grow the DB without limit.
  db.prepare(
    `DELETE FROM notifications WHERE id IN (
       SELECT id FROM (
         SELECT id, ROW_NUMBER() OVER (
           PARTITION BY instance_id ORDER BY created_at DESC, id DESC
         ) AS rank FROM notifications
       ) WHERE rank > ?
     )`
  ).run(MAX_ROWS_PER_INSTANCE);
}

/** When the user last had the inbox open — powers the "new since you last looked" divider. */
export function inboxLastSeenAt(db: Database.Database): number | null {
  const raw = getMeta(db, INBOX_SEEN_KEY);
  const parsed = raw === null ? Number.NaN : Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export function markInboxSeen(db: Database.Database): void {
  setMeta(db, INBOX_SEEN_KEY, String(Date.now()));
}
