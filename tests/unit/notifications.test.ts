import { describe, expect, it } from 'vitest';
import {
  insertNotification,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  searchNotifications,
  unreadNotificationCount
} from '../../src/main/db/repositories/notifications.js';
import { createTestDb } from './helpers.js';

describe('notifications repo', () => {
  it('inserts, lists, searches, and tracks unread state', () => {
    const { db } = createTestDb();
    const a = insertNotification(db, { instanceId: 'svc-1', title: 'Hello there', body: 'first message' });
    insertNotification(db, { instanceId: 'svc-2', title: 'Standup', body: 'meeting at 10' });

    expect(listNotifications(db)).toHaveLength(2);
    expect(unreadNotificationCount(db)).toBe(2);

    expect(searchNotifications(db, 'standup').map((n) => n.title)).toEqual(['Standup']);
    expect(searchNotifications(db, 'message')).toHaveLength(1);

    markNotificationRead(db, a.id);
    expect(unreadNotificationCount(db)).toBe(1);

    markAllNotificationsRead(db);
    expect(unreadNotificationCount(db)).toBe(0);
  });
});
