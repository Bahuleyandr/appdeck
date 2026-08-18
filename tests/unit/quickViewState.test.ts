import { describe, expect, it } from 'vitest';
import { createServiceInstance, updateServiceInstance } from '../../src/main/db/repositories/serviceInstances.js';
import { insertNotification } from '../../src/main/db/repositories/notifications.js';
import { setSetting } from '../../src/main/db/repositories/settings.js';
import { listWorkspaces } from '../../src/main/db/repositories/workspaces.js';
import {
  buildQuickViewState,
  QUICK_VIEW_BODY_MAX_CHARS,
  QUICK_VIEW_NOTIFICATION_LIMIT
} from '../../src/main/windows/quickViewState.js';
import type { UnreadCount } from '../../src/shared/types.js';
import { createTestDb } from './helpers.js';

function seed(): ReturnType<typeof createTestDb> & { workspaceId: string } {
  const context = createTestDb();
  const workspace = listWorkspaces(context.db)[0];
  if (!workspace) throw new Error('Expected default workspace');
  return { ...context, workspaceId: workspace.id };
}

describe('quick view state', () => {
  it('joins badge counts onto services and sorts unread first', () => {
    const { db, deviceId, workspaceId } = seed();
    const quiet = createServiceInstance(db, deviceId, {
      recipeId: 'whatsapp',
      workspaceId,
      displayName: 'Quiet'
    });
    const busy = createServiceInstance(db, deviceId, {
      recipeId: 'whatsapp',
      workspaceId,
      displayName: 'Busy'
    });
    const counts = new Map<string, UnreadCount>([[busy.id, { direct: 4, indirect: 1 }]]);

    const state = buildQuickViewState(db, counts);
    expect(state.services.map((service) => service.name)).toEqual(['Busy', 'Quiet']);
    expect(state.services[0]?.unread).toEqual({ direct: 4, indirect: 1 });
    expect(state.services[1]?.unread).toEqual({ direct: 0, indirect: 0 });
    expect(state.totalUnread).toBe(4);
    expect(quiet.id).not.toBe(busy.id);
  });

  it('excludes disabled services', () => {
    const { db, deviceId, workspaceId } = seed();
    const service = createServiceInstance(db, deviceId, {
      recipeId: 'whatsapp',
      workspaceId,
      displayName: 'Old'
    });
    updateServiceInstance(db, deviceId, service.id, { disabled: true });

    const state = buildQuickViewState(db, new Map());
    expect(state.services).toHaveLength(0);
  });

  it('lists recent notifications newest-first with service names and truncated bodies', () => {
    const { db, deviceId, workspaceId } = seed();
    const service = createServiceInstance(db, deviceId, {
      recipeId: 'whatsapp',
      workspaceId,
      displayName: 'Chat'
    });
    insertNotification(db, {
      instanceId: service.id,
      title: 'Hello',
      body: 'x'.repeat(QUICK_VIEW_BODY_MAX_CHARS + 100)
    });
    insertNotification(db, { instanceId: 'gone-service', title: 'Orphan', body: 'short' });

    const state = buildQuickViewState(db, new Map());
    expect(state.notifications).toHaveLength(2);
    // Same created_at millisecond is possible; the orphan was inserted last so it sorts first.
    expect(state.notifications[0]?.serviceName).toBe('AppDeck');
    expect(state.notifications[1]?.serviceName).toBe('Chat');
    const long = state.notifications.find((entry) => entry.title === 'Hello');
    expect(long?.body.length).toBeLessThanOrEqual(QUICK_VIEW_BODY_MAX_CHARS);
    expect(long?.body.endsWith('…')).toBe(true);
  });

  it('caps the notification list and stays graceful when empty', () => {
    const { db, deviceId, workspaceId } = seed();
    const service = createServiceInstance(db, deviceId, {
      recipeId: 'whatsapp',
      workspaceId,
      displayName: 'Chat'
    });

    expect(buildQuickViewState(db, new Map()).notifications).toEqual([]);

    for (let i = 0; i < QUICK_VIEW_NOTIFICATION_LIMIT + 10; i += 1) {
      insertNotification(db, { instanceId: service.id, title: `n${i}`, body: String(i) });
    }
    const state = buildQuickViewState(db, new Map());
    expect(state.notifications).toHaveLength(QUICK_VIEW_NOTIFICATION_LIMIT);
  });

  it('carries the theme setting for the popover renderer', () => {
    const { db } = seed();
    expect(buildQuickViewState(db, new Map()).theme).toBeTruthy();
    setSetting(db, 'theme', 'light');
    expect(buildQuickViewState(db, new Map()).theme).toBe('light');
  });
});
