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
  activeFocusMode,
  deleteFocusMode,
  focusModeStatus,
  focusNotificationDecision,
  manualFocusModeId,
  setManualFocusMode,
  upsertFocusMode
} from '../../src/main/db/repositories/focusModes.js';
import { createServiceInstance } from '../../src/main/db/repositories/serviceInstances.js';
import { listWorkspaces } from '../../src/main/db/repositories/workspaces.js';
import { NotificationService } from '../../src/main/services/notifications.js';
import { createTestDb } from './helpers.js';

// A schedule that is never active: Sundays 03:00-03:01.
const NEVER = [{ from: '03:00', to: '03:01', days: [0] }];
// Monday 2026-07-06 at 10:00 — deliberately outside NEVER.
const MONDAY_10AM = new Date(2026, 6, 6, 10, 0, 0);

function makeService(context: ReturnType<typeof createTestDb>, name: string) {
  const workspace = listWorkspaces(context.db)[0];
  if (!workspace) throw new Error('Expected default workspace');
  return createServiceInstance(context.db, context.deviceId, {
    recipeId: 'whatsapp',
    workspaceId: workspace.id,
    displayName: name
  });
}

describe('manual focus mode activation', () => {
  it('activates a mode outside its schedule and clears again', () => {
    const context = createTestDb();
    const mode = upsertFocusMode(context.db, {
      name: 'Deep Work',
      schedule: NEVER,
      settings: { muteNotifications: true }
    });

    expect(activeFocusMode(context.db, MONDAY_10AM)).toBe(null);

    setManualFocusMode(context.db, mode.id);
    expect(activeFocusMode(context.db, MONDAY_10AM)?.id).toBe(mode.id);
    expect(manualFocusModeId(context.db)).toBe(mode.id);

    setManualFocusMode(context.db, null);
    expect(activeFocusMode(context.db, MONDAY_10AM)).toBe(null);
    expect(manualFocusModeId(context.db)).toBe(null);
  });

  it('actually mutes notifications once activated', () => {
    const context = createTestDb();
    const service = makeService(context, 'Chat');
    const mode = upsertFocusMode(context.db, {
      name: 'Deep Work',
      schedule: NEVER,
      settings: { muteNotifications: true }
    });
    const notifications = new NotificationService(context.db, () => null, vi.fn());

    expect(notifications.shouldNotify(service.id)).toBe(true);
    setManualFocusMode(context.db, mode.id);
    expect(notifications.shouldNotify(service.id)).toBe(false);
    setManualFocusMode(context.db, null);
    expect(notifications.shouldNotify(service.id)).toBe(true);
  });

  it('honours allow-list breakthrough while manually active', () => {
    const context = createTestDb();
    const vip = makeService(context, 'VIP');
    const other = makeService(context, 'Other');
    const mode = upsertFocusMode(context.db, {
      name: 'Deep Work',
      schedule: NEVER,
      settings: { muteNotifications: true, allowedServiceIds: [vip.id] }
    });

    setManualFocusMode(context.db, mode.id);

    expect(focusNotificationDecision(context.db, vip.id, MONDAY_10AM)).toBe('allow');
    expect(focusNotificationDecision(context.db, other.id, MONDAY_10AM)).toBe('block');
  });

  it('reports manual activation in the status payload', () => {
    const context = createTestDb();
    const mode = upsertFocusMode(context.db, { name: 'Deep Work', schedule: NEVER, settings: {} });

    expect(focusModeStatus(context.db, MONDAY_10AM).manuallyActivated).toBe(false);
    setManualFocusMode(context.db, mode.id);
    const status = focusModeStatus(context.db, MONDAY_10AM);
    expect(status.manuallyActivated).toBe(true);
    expect(status.activeMode?.id).toBe(mode.id);
  });

  it('drops the override when the mode is deleted or disabled', () => {
    const context = createTestDb();
    const mode = upsertFocusMode(context.db, { name: 'Temp', schedule: NEVER, settings: {} });
    setManualFocusMode(context.db, mode.id);
    expect(activeFocusMode(context.db, MONDAY_10AM)?.id).toBe(mode.id);

    upsertFocusMode(context.db, { ...mode, enabled: false });
    expect(activeFocusMode(context.db, MONDAY_10AM)).toBe(null);

    upsertFocusMode(context.db, { ...mode, enabled: true });
    expect(activeFocusMode(context.db, MONDAY_10AM)?.id).toBe(mode.id);

    deleteFocusMode(context.db, mode.id);
    expect(activeFocusMode(context.db, MONDAY_10AM)).toBe(null);
    expect(manualFocusModeId(context.db)).toBe(null);
  });

  it('ignores a scheduled mode while a different one is manually active', () => {
    const context = createTestDb();
    const scheduled = upsertFocusMode(context.db, {
      name: 'Scheduled',
      schedule: [{ from: '00:00', to: '23:59', days: [0, 1, 2, 3, 4, 5, 6] }],
      settings: {}
    });
    const manual = upsertFocusMode(context.db, { name: 'Manual', schedule: NEVER, settings: {} });

    expect(activeFocusMode(context.db, MONDAY_10AM)?.id).toBe(scheduled.id);
    setManualFocusMode(context.db, manual.id);
    expect(activeFocusMode(context.db, MONDAY_10AM)?.id).toBe(manual.id);
  });
});
