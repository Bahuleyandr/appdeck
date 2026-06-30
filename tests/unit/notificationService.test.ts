import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createServiceInstance } from '../../src/main/db/repositories/serviceInstances.js';
import { listWorkspaces } from '../../src/main/db/repositories/workspaces.js';
import { NotificationService } from '../../src/main/services/notifications.js';
import { createTestDb } from './helpers.js';

const electronMock = vi.hoisted(() => ({
  created: [] as Array<{
    options: { title: string; body?: string; icon?: string | null };
    click?: () => void;
    show: () => void;
  }>
}));

vi.mock('electron', () => ({
  BrowserWindow: vi.fn(),
  Notification: class MockNotification {
    private readonly entry: (typeof electronMock.created)[number];

    static isSupported(): boolean {
      return true;
    }

    constructor(options: { title: string; body?: string; icon?: string | null }) {
      this.entry = { options, show: vi.fn() };
      electronMock.created.push(this.entry);
    }

    on(event: string, handler: () => void): void {
      if (event === 'click') {
        this.entry.click = handler;
      }
    }

    show(): void {
      this.entry.show();
    }
  }
}));

describe('notification service', () => {
  beforeEach(() => {
    electronMock.created.length = 0;
    vi.useRealTimers();
  });

  it('labels PC toasts by service and suppresses duplicate or burst noise', () => {
    vi.useFakeTimers();
    const { db, deviceId } = createTestDb();
    const workspace = listWorkspaces(db)[0];
    if (!workspace) throw new Error('Expected default workspace');
    const service = createServiceInstance(db, deviceId, {
      recipeId: 'whatsapp',
      workspaceId: workspace.id,
      displayName: 'WhatsApp Personal'
    });
    const onClick = vi.fn();
    const window = { show: vi.fn() };
    const notifications = new NotificationService(db, () => window as never, onClick);

    notifications.show({
      instanceId: service.id,
      title: 'Maya',
      body: 'Can you check this?'
    });
    notifications.show({
      instanceId: service.id,
      title: 'Maya',
      body: 'Can you check this?'
    });
    notifications.show({
      instanceId: service.id,
      title: 'Ravi',
      body: 'New file uploaded'
    });

    expect(electronMock.created).toHaveLength(1);
    expect(electronMock.created[0]?.options).toMatchObject({
      title: 'WhatsApp Personal · Maya',
      body: 'Can you check this?'
    });

    vi.advanceTimersByTime(8_000);

    expect(electronMock.created).toHaveLength(2);
    expect(electronMock.created[1]?.options).toMatchObject({
      title: 'WhatsApp Personal · 1 more notification',
      body: 'Ravi: New file uploaded'
    });
    electronMock.created[1]?.click?.();
    expect(window.show).toHaveBeenCalled();
    expect(onClick).toHaveBeenCalledWith(service.id);
  });
});
