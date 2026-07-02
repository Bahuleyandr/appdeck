import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  BrowserWindow: vi.fn(),
  Notification: class MockNotification {
    static isSupported(): boolean {
      return true;
    }
    on(): void {}
    show(): void {}
  }
}));

import {
  createServiceInstance,
  updateServiceInstance
} from '../../src/main/db/repositories/serviceInstances.js';
import { focusModeStatus, upsertFocusMode } from '../../src/main/db/repositories/focusModes.js';
import { createWorkspace, listWorkspaces } from '../../src/main/db/repositories/workspaces.js';
import { NotificationService } from '../../src/main/services/notifications.js';
import { SleepManager } from '../../src/main/services/sleepManager.js';
import type { ServiceViewManager } from '../../src/main/views/serviceViewManager.js';
import { createTestDb } from './helpers.js';

const ALWAYS = [{ from: '00:00', to: '23:59', days: [0, 1, 2, 3, 4, 5, 6] }];

function seededWorkspaceId(db: ReturnType<typeof createTestDb>['db']): string {
  const workspace = listWorkspaces(db)[0];
  if (!workspace) throw new Error('Expected default workspace');
  return workspace.id;
}

function makeService(
  context: ReturnType<typeof createTestDb>,
  workspaceId: string,
  displayName: string
) {
  return createServiceInstance(context.db, context.deviceId, {
    recipeId: 'whatsapp',
    workspaceId,
    displayName
  });
}

describe('focus mode enforcement', () => {
  it('mutes notifications while a focus mode with muteNotifications is active', () => {
    const context = createTestDb();
    const service = makeService(context, seededWorkspaceId(context.db), 'Chat');
    const notifications = new NotificationService(context.db, () => null, vi.fn());

    expect(notifications.shouldNotify(service.id)).toBe(true);
    upsertFocusMode(context.db, {
      name: 'Deep Work',
      schedule: ALWAYS,
      settings: { muteNotifications: true }
    });
    expect(notifications.shouldNotify(service.id)).toBe(false);
  });

  it('lets allowedServiceIds break through focus muting', () => {
    const context = createTestDb();
    const workspaceId = seededWorkspaceId(context.db);
    const vip = makeService(context, workspaceId, 'VIP');
    const other = makeService(context, workspaceId, 'Other');
    const notifications = new NotificationService(context.db, () => null, vi.fn());

    upsertFocusMode(context.db, {
      name: 'Deep Work',
      schedule: ALWAYS,
      settings: { muteNotifications: true, allowedServiceIds: [vip.id] }
    });

    expect(notifications.shouldNotify(vip.id)).toBe(true);
    expect(notifications.shouldNotify(other.id)).toBe(false);
  });

  it('blocks blockedServiceIds even when the mode does not mute everything', () => {
    const context = createTestDb();
    const workspaceId = seededWorkspaceId(context.db);
    const noisy = makeService(context, workspaceId, 'Noisy');
    const fine = makeService(context, workspaceId, 'Fine');
    const notifications = new NotificationService(context.db, () => null, vi.fn());

    upsertFocusMode(context.db, {
      name: 'Soft Focus',
      schedule: ALWAYS,
      settings: { blockedServiceIds: [noisy.id] }
    });

    expect(notifications.shouldNotify(noisy.id)).toBe(false);
    expect(notifications.shouldNotify(fine.id)).toBe(true);
  });

  it('scopes a workspace-bound focus mode to services in that workspace', () => {
    const context = createTestDb();
    const homeId = seededWorkspaceId(context.db);
    const work = createWorkspace(context.db, context.deviceId, { name: 'Work' });
    const homeService = makeService(context, homeId, 'Home Chat');
    const workService = makeService(context, work.id, 'Work Chat');
    const notifications = new NotificationService(context.db, () => null, vi.fn());

    upsertFocusMode(context.db, {
      name: 'Work Focus',
      workspace_id: work.id,
      schedule: ALWAYS,
      settings: { muteNotifications: true }
    });

    expect(notifications.shouldNotify(workService.id)).toBe(false);
    expect(notifications.shouldNotify(homeService.id)).toBe(true);
  });

  it('sleeps services faster while an active focus mode sets sleepIdleMinutes', () => {
    const context = createTestDb();
    const service = makeService(context, seededWorkspaceId(context.db), 'Idle Chat');
    upsertFocusMode(context.db, {
      name: 'Battery Focus',
      schedule: ALWAYS,
      settings: { sleepIdleMinutes: 1 }
    });

    const sleep = vi.fn();
    const fakeViews = {
      trimHiddenViews: vi.fn(),
      // Two minutes idle: beyond the focus override (1m), well below the default policy (30m).
      getLastActiveAt: () => Date.now() - 2 * 60_000,
      isFocused: () => false,
      isAudible: () => false,
      sleep
    } as unknown as ServiceViewManager;

    new SleepManager(context.db, fakeViews).tick();

    expect(sleep).toHaveBeenCalledWith(service.id);
  });

  it('does not sleep never-sleep services even during a focus mode', () => {
    const context = createTestDb();
    const service = makeService(context, seededWorkspaceId(context.db), 'Always On');
    updateServiceInstance(context.db, context.deviceId, service.id, {
      sleep_policy: { idleMinutes: null }
    });
    upsertFocusMode(context.db, {
      name: 'Battery Focus',
      schedule: ALWAYS,
      settings: { sleepIdleMinutes: 1 }
    });

    const sleep = vi.fn();
    const fakeViews = {
      trimHiddenViews: vi.fn(),
      getLastActiveAt: () => Date.now() - 10 * 60_000,
      isFocused: () => false,
      isAudible: () => false,
      sleep
    } as unknown as ServiceViewManager;

    new SleepManager(context.db, fakeViews).tick();

    expect(sleep).not.toHaveBeenCalled();
  });

  it('focusModeStatus evaluates schedules against an injected clock', () => {
    const context = createTestDb();
    upsertFocusMode(context.db, {
      name: 'Monday Morning',
      schedule: [{ from: '09:00', to: '11:00', days: [1] }],
      settings: {}
    });

    // 2026-07-06 is a Monday.
    const monday = new Date(2026, 6, 6, 10, 0, 0);
    const sunday = new Date(2026, 6, 5, 10, 0, 0);

    expect(focusModeStatus(context.db, monday).activeMode?.name).toBe('Monday Morning');
    expect(focusModeStatus(context.db, sunday).activeMode).toBe(null);
  });
});
