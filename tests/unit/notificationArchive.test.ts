import { describe, expect, it } from 'vitest';
import {
  inboxLastSeenAt,
  insertNotification,
  listNotifications,
  markInboxSeen,
  pruneOldNotifications,
  searchNotifications
} from '../../src/main/db/repositories/notifications.js';
import { setSetting } from '../../src/main/db/repositories/settings.js';
import { createTestDb } from './helpers.js';

function seed(db: ReturnType<typeof createTestDb>['db']): void {
  insertNotification(db, { instanceId: 's1', title: 'Maya', body: 'Can you check this?' });
  insertNotification(db, { instanceId: 's1', title: 'Ravi', body: 'New file uploaded to Drive' });
  insertNotification(db, { instanceId: 's2', title: 'CI', body: 'Deploy pipeline failed again' });
}

describe('notification archive search (FTS)', () => {
  it('finds notifications by body tokens', () => {
    const { db } = createTestDb();
    seed(db);

    const hits = searchNotifications(db, 'uploaded');
    expect(hits).toHaveLength(1);
    expect(hits[0]?.title).toBe('Ravi');
  });

  it('matches word prefixes', () => {
    const { db } = createTestDb();
    seed(db);

    expect(searchNotifications(db, 'uplo')[0]?.title).toBe('Ravi');
    expect(searchNotifications(db, 'pipel dep')[0]?.title).toBe('CI');
  });

  it('survives quotes, hyphens, and parens in the query', () => {
    const { db } = createTestDb();
    seed(db);

    expect(() => searchNotifications(db, '"file (upl- oaded)"')).not.toThrow();
    expect(searchNotifications(db, 'file-uploaded')[0]?.title).toBe('Ravi');
  });

  it('falls back to LIKE search when the FTS table is unavailable', () => {
    const { db } = createTestDb();
    seed(db);
    db.exec('DROP TRIGGER notifications_ai; DROP TRIGGER notifications_ad;');
    db.exec('DROP TRIGGER notifications_au; DROP TABLE notifications_fts;');

    const hits = searchNotifications(db, 'uploaded');
    expect(hits).toHaveLength(1);
    expect(hits[0]?.title).toBe('Ravi');
  });
});

describe('notification retention', () => {
  it('prunes by the notification_retention_days setting (default 30)', () => {
    const { db } = createTestDb();
    const insert = db.prepare(
      "INSERT INTO notifications (instance_id, title, body, created_at) VALUES ('s1', ?, '', ?)"
    );
    insert.run('ancient', Date.now() - 40 * 24 * 60 * 60_000);
    insert.run('recent-old', Date.now() - 5 * 24 * 60 * 60_000);
    insert.run('fresh', Date.now());

    pruneOldNotifications(db);
    expect(searchNotifications(db, 'ancient')).toHaveLength(0);
    expect(searchNotifications(db, 'recent')).toHaveLength(1);

    setSetting(db, 'notification_retention_days', '1');
    pruneOldNotifications(db);
    expect(searchNotifications(db, 'recent')).toHaveLength(0);
    expect(searchNotifications(db, 'fresh')).toHaveLength(1);
  });

  it('caps rows per service at 5000, keeping the newest', () => {
    const { db } = createTestDb();
    const insert = db.prepare(
      "INSERT INTO notifications (instance_id, title, body, created_at) VALUES ('s1', ?, '', ?)"
    );
    const base = Date.now() - 10_000;
    db.transaction(() => {
      for (let i = 0; i < 5010; i += 1) {
        insert.run(`n${i}`, base + i);
      }
    })();

    pruneOldNotifications(db);
    const count = (
      db.prepare("SELECT COUNT(*) AS count FROM notifications WHERE instance_id = 's1'").get() as {
        count: number;
      }
    ).count;
    expect(count).toBe(5000);
    // The newest survive, the oldest go.
    expect(searchNotifications(db, 'n5009')).toHaveLength(1);
    expect(searchNotifications(db, 'n0')).toHaveLength(0);
  });
});

describe('inbox paging and last-seen', () => {
  it('pages older notifications with beforeId', () => {
    const { db } = createTestDb();
    seed(db);
    const all = listNotifications(db, 10);
    const newestId = all[0]?.id;
    if (!newestId) throw new Error('Expected notifications');

    const older = listNotifications(db, 10, false, newestId);
    expect(older.every((record) => record.id < newestId)).toBe(true);
    expect(older).toHaveLength(all.length - 1);
  });

  it('tracks when the inbox was last seen', () => {
    const { db } = createTestDb();
    expect(inboxLastSeenAt(db)).toBe(null);
    markInboxSeen(db);
    expect(inboxLastSeenAt(db)).toBeTypeOf('number');
  });
});
