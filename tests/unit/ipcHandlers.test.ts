import { describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';
import type { IpcContext } from '../../src/main/ipc/register.js';
import { registerIpcHandlers } from '../../src/main/ipc/register.js';
import { createServiceInstance } from '../../src/main/db/repositories/serviceInstances.js';
import { RecipeLoader } from '../../src/main/recipes/loader.js';
import { listWorkspaces } from '../../src/main/db/repositories/workspaces.js';
import type { Workspace } from '../../src/shared/types.js';
import { createTestDb } from './helpers.js';

type IpcHandler = (event: unknown, payload?: unknown) => Promise<unknown>;

const electronMock = vi.hoisted(() => ({
  handlers: new Map<string, (event: unknown, payload?: unknown) => Promise<unknown>>()
}));

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/tmp'),
    setLoginItemSettings: vi.fn(),
    setBadgeCount: vi.fn()
  },
  ipcMain: {
    handle: vi.fn((channel: string, handler: (event: unknown, payload?: unknown) => Promise<unknown>) => {
      electronMock.handlers.set(channel, handler);
    })
  },
  nativeImage: { createFromBitmap: vi.fn() },
  session: { fromPartition: vi.fn() },
  shell: { openExternal: vi.fn(), openPath: vi.fn() },
  Notification: vi.fn()
}));

function getHandler(handlers: Map<string, IpcHandler>, channel: string): IpcHandler {
  const handler = handlers.get(channel);
  if (!handler) throw new Error(`Handler not registered: ${channel}`);
  return handler;
}

function setup(): {
  handlers: Map<string, IpcHandler>;
  ctx: IpcContext;
  workspace: Workspace;
} {
  electronMock.handlers.clear();
  const { db, deviceId } = createTestDb();
  const ctx = {
    db,
    deviceId,
    recipeLoader: new RecipeLoader(db),
    viewManager: { setBounds: vi.fn(), focus: vi.fn(), reload: vi.fn(), setZoom: vi.fn() },
    sendPush: vi.fn(),
    sendDataChanged: vi.fn(),
    onSettingsChanged: vi.fn()
  } as unknown as IpcContext;
  registerIpcHandlers(ctx);
  const workspace = listWorkspaces(db)[0];
  if (!workspace) throw new Error('Expected default workspace');
  return { handlers: electronMock.handlers, ctx, workspace };
}

describe('ipc handlers', () => {
  it('registers real handlers for the covered channels', () => {
    const { handlers } = setup();
    for (const channel of ['workspace:create', 'service:update', 'view:setBounds']) {
      expect(handlers.has(channel)).toBe(true);
    }
  });

  it('workspace:create validates and creates a workspace', async () => {
    const { handlers, ctx } = setup();
    const handler = getHandler(handlers, 'workspace:create');

    const created = (await handler(null, { name: 'Focus' })) as Workspace;
    expect(created.name).toBe('Focus');
    expect(listWorkspaces(ctx.db).map((entry) => entry.name)).toContain('Focus');
    expect(ctx.sendDataChanged).toHaveBeenCalled();

    // Empty name and malformed payload reject via zod instead of crashing.
    await expect(handler(null, { name: '' })).rejects.toThrow();
    await expect(handler(null, 'not-an-object')).rejects.toThrow();
  });

  it('service:update validates the patch and persists it', async () => {
    const { handlers, ctx, workspace } = setup();
    const service = createServiceInstance(ctx.db, ctx.deviceId, {
      recipeId: 'whatsapp',
      workspaceId: workspace.id,
      displayName: 'WhatsApp'
    });
    const handler = getHandler(handlers, 'service:update');

    const updated = (await handler(null, {
      id: service.id,
      patch: { display_name: 'Personal WhatsApp', muted: true }
    })) as { display_name: string; muted: number | boolean };
    expect(updated.display_name).toBe('Personal WhatsApp');
    expect(Boolean(updated.muted)).toBe(true);

    // Unknown patch keys are stripped by the contract, so protected columns cannot be hijacked.
    const stripped = (await handler(null, {
      id: service.id,
      patch: { partition_key: 'persist:hijack' }
    })) as { partition_key: string };
    expect(stripped.partition_key).toBe(service.partition_key);
    // Wrong types reject.
    await expect(handler(null, { id: service.id, patch: { muted: 'yes' } })).rejects.toThrow();
    await expect(handler(null, { patch: {} })).rejects.toThrow();
  });

  it('view:setBounds validates entries before touching the view manager', async () => {
    const { handlers, ctx } = setup();
    const handler = getHandler(handlers, 'view:setBounds');
    const setBounds = (ctx.viewManager as unknown as { setBounds: ReturnType<typeof vi.fn> })
      .setBounds;

    await handler(null, {
      entries: [{ viewId: 'svc-1', rect: { x: 0, y: 0, width: 800.4, height: 600.2 } }],
      visibleIds: ['svc-1']
    });
    expect(setBounds).toHaveBeenCalledWith(
      [{ viewId: 'svc-1', rect: { x: 0, y: 0, width: 800.4, height: 600.2 } }],
      ['svc-1']
    );

    setBounds.mockClear();
    await expect(
      handler(null, { entries: [{ viewId: 'svc-1', rect: { x: 0, y: 0 } }], visibleIds: [] })
    ).rejects.toThrow();
    await expect(handler(null, undefined)).rejects.toThrow();
    expect(setBounds).not.toHaveBeenCalled();
  });

  it('service:setZoom rejects non-positive zoom factors but accepts valid ones', async () => {
    const { handlers, ctx, workspace } = setup();
    const service = createServiceInstance(ctx.db, ctx.deviceId, {
      recipeId: 'whatsapp',
      workspaceId: workspace.id,
      displayName: 'WhatsApp'
    });
    const handler = getHandler(handlers, 'service:setZoom');
    const setZoom = (ctx.viewManager as unknown as { setZoom: ReturnType<typeof vi.fn> }).setZoom;

    await expect(handler(null, { id: service.id, zoomFactor: 0 })).rejects.toThrow(ZodError);
    await expect(handler(null, { id: service.id, zoomFactor: -1 })).rejects.toThrow(ZodError);
    expect(setZoom).not.toHaveBeenCalled();

    // Positive control: without this the rejections above would also pass if the handler were
    // simply broken (e.g. a missing viewManager method throwing TypeError on every payload).
    await handler(null, { id: service.id, zoomFactor: 1.25 });
    expect(setZoom).toHaveBeenCalledWith(service.id, 1.25);
  });

  it('rejects non-http(s) URLs at the navigation boundary', async () => {
    const { handlers, ctx, workspace } = setup();
    const service = createServiceInstance(ctx.db, ctx.deviceId, {
      recipeId: 'whatsapp',
      workspaceId: workspace.id,
      displayName: 'WhatsApp'
    });
    const tabCreate = getHandler(handlers, 'tab:create');
    const serviceUpdate = getHandler(handlers, 'service:update');

    for (const url of [
      'javascript:alert(1)',
      'file:///etc/passwd',
      'data:text/html,<h1>x</h1>',
      'not-a-url'
    ]) {
      await expect(tabCreate(null, { instanceId: service.id, url })).rejects.toThrow(ZodError);
      await expect(
        serviceUpdate(null, { id: service.id, patch: { last_url: url } })
      ).rejects.toThrow(ZodError);
    }

    // https still works, so the guard is a scheme check and not a blanket rejection.
    await expect(
      tabCreate(null, { instanceId: service.id, url: 'https://web.whatsapp.com/' })
    ).resolves.toBeTruthy();
  });

  it('settings:set only accepts known setting keys', async () => {
    const { handlers } = setup();
    const handler = getHandler(handlers, 'settings:set');

    await expect(handler(null, { key: 'not_a_setting', value: 'x' })).rejects.toThrow(ZodError);
    await expect(handler(null, { key: 'theme', value: 'dark' })).resolves.toBeUndefined();
  });
});
