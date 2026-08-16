import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

interface FakeWebContents {
  handlers: Map<string, (...args: unknown[]) => void>;
  loadURL: ReturnType<typeof vi.fn>;
  executeJavaScript: ReturnType<typeof vi.fn>;
  insertCSS: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  reload: ReturnType<typeof vi.fn>;
  setAudioMuted: ReturnType<typeof vi.fn>;
  setBackgroundThrottling: ReturnType<typeof vi.fn>;
}

const electronMock = vi.hoisted(() => {
  const state = {
    createdViews: [] as Array<{ webContents: FakeWebContents }>,
    partitions: new Map<string, unknown>(),
    addChildView: vi.fn(),
    removeChildView: vi.fn()
  };

  function makePartition(): unknown {
    return {
      setProxy: vi.fn(() => Promise.resolve()),
      setPermissionRequestHandler: vi.fn(),
      setPermissionCheckHandler: vi.fn(),
      webRequest: {
        onBeforeRequest: vi.fn(),
        onBeforeSendHeaders: vi.fn(),
        onHeadersReceived: vi.fn()
      },
      on: vi.fn()
    };
  }

  class FakeWebContentsView {
    webContents: {
      handlers: Map<string, (...args: unknown[]) => void>;
      loadURL: ReturnType<typeof vi.fn>;
      executeJavaScript: ReturnType<typeof vi.fn>;
      insertCSS: ReturnType<typeof vi.fn>;
      setUserAgent: ReturnType<typeof vi.fn>;
      setZoomFactor: ReturnType<typeof vi.fn>;
      setAudioMuted: ReturnType<typeof vi.fn>;
      setBackgroundThrottling: ReturnType<typeof vi.fn>;
      setWindowOpenHandler: ReturnType<typeof vi.fn>;
      on: (event: string, handler: (...args: unknown[]) => void) => void;
      close: ReturnType<typeof vi.fn>;
      focus: ReturnType<typeof vi.fn>;
      reload: ReturnType<typeof vi.fn>;
      isCurrentlyAudible: () => boolean;
      getTitle: () => string;
      getURL: () => string;
    };

    constructor() {
      const handlers = new Map<string, (...args: unknown[]) => void>();
      this.webContents = {
        handlers,
        loadURL: vi.fn(() => Promise.resolve()),
        executeJavaScript: vi.fn(() => Promise.resolve()),
        insertCSS: vi.fn(() => Promise.resolve()),
        setUserAgent: vi.fn(),
        setZoomFactor: vi.fn(),
        setAudioMuted: vi.fn(),
        setBackgroundThrottling: vi.fn(),
        setWindowOpenHandler: vi.fn(),
        on: (event, handler) => {
          handlers.set(event, handler);
        },
        close: vi.fn(),
        focus: vi.fn(),
        reload: vi.fn(),
        isCurrentlyAudible: () => false,
        getTitle: () => '',
        getURL: () => 'https://web.whatsapp.com/'
      };
      state.createdViews.push(this);
    }

    setBounds(): void {}
  }

  return {
    state,
    module: {
      BrowserWindow: vi.fn(),
      WebContentsView: FakeWebContentsView,
      shell: { openExternal: vi.fn(() => Promise.resolve()) },
      session: {
        fromPartition: (key: string) => {
          let partition = state.partitions.get(key);
          if (!partition) {
            partition = makePartition();
            state.partitions.set(key, partition);
          }
          return partition;
        }
      }
    }
  };
});

vi.mock('electron', () => electronMock.module);

import {
  deleteFirewallRule,
  upsertFirewallRule
} from '../../src/main/db/repositories/privacyFirewall.js';
import {
  createServiceInstance,
  updateServiceInstance
} from '../../src/main/db/repositories/serviceInstances.js';
import { ensureDefaultTab } from '../../src/main/db/repositories/serviceTabs.js';
import { listWorkspaces } from '../../src/main/db/repositories/workspaces.js';
import { RecipeLoader } from '../../src/main/recipes/loader.js';
import { approveCustomCode } from '../../src/main/services/customCode.js';
import { TrackerBlocker } from '../../src/main/services/trackerBlock.js';
import { ServiceViewManager } from '../../src/main/views/serviceViewManager.js';
import type { BrowserWindow } from 'electron';
import { createTestDb } from './helpers.js';

const RECT = { x: 0, y: 0, width: 800, height: 600 };

function fakeWindow(): BrowserWindow {
  return {
    isDestroyed: () => false,
    contentView: {
      addChildView: electronMock.state.addChildView,
      removeChildView: electronMock.state.removeChildView
    }
  } as unknown as BrowserWindow;
}

function setup(options: { locked: () => boolean; trackerBlocker?: TrackerBlocker }) {
  const context = createTestDb();
  const workspace = listWorkspaces(context.db)[0];
  if (!workspace) throw new Error('Expected default workspace');
  const service = createServiceInstance(context.db, context.deviceId, {
    recipeId: 'whatsapp',
    workspaceId: workspace.id,
    displayName: 'Guarded'
  });
  const tab = ensureDefaultTab(context.db, service.id, 'https://web.whatsapp.com/');
  const sendPush = vi.fn();
  const manager = new ServiceViewManager(
    context.db,
    context.deviceId,
    new RecipeLoader(context.db),
    'preload.cjs',
    sendPush,
    () => {},
    options.locked,
    null,
    options.trackerBlocker ?? null,
    fakeWindow()
  );
  return { context, service, viewId: `${service.id}#${tab.id}`, manager, sendPush };
}

describe('service view guards', () => {
  beforeEach(() => {
    electronMock.state.createdViews.length = 0;
    electronMock.state.partitions.clear();
    electronMock.state.addChildView.mockClear();
    electronMock.state.removeChildView.mockClear();
  });

  it('refuses to create or attach service views while the app is locked', () => {
    let locked = true;
    const { viewId, manager } = setup({ locked: () => locked });

    manager.setBounds([{ viewId, rect: RECT }], [viewId]);

    expect(electronMock.state.createdViews).toHaveLength(0);
    expect(electronMock.state.addChildView).not.toHaveBeenCalled();

    locked = false;
    manager.setBounds([{ viewId, rect: RECT }], [viewId]);

    expect(electronMock.state.createdViews).toHaveLength(1);
    expect(electronMock.state.addChildView).toHaveBeenCalledTimes(1);
  });

  it('blocks unapproved synced custom code and runs it after approval', () => {
    const { context, service, viewId, manager, sendPush } = setup({ locked: () => false });
    // Written directly to the repo, exactly like a sync merge — never approved on this device.
    updateServiceInstance(context.db, context.deviceId, service.id, {
      custom_js: 'document.title = "owned"',
      custom_css: 'body { outline: 1px solid red; }'
    });

    manager.setBounds([{ viewId, rect: RECT }], [viewId]);
    const view = electronMock.state.createdViews[0];
    if (!view) throw new Error('Expected a created view');
    const finishLoad = view.webContents.handlers.get('did-finish-load');
    if (!finishLoad) throw new Error('Expected did-finish-load handler');

    finishLoad();
    expect(view.webContents.executeJavaScript).not.toHaveBeenCalledWith(
      'document.title = "owned"',
      true
    );
    expect(view.webContents.insertCSS).not.toHaveBeenCalled();
    expect(sendPush).toHaveBeenCalledWith('event:custom-code-pending', {
      instanceId: service.id
    });

    approveCustomCode(context.db, service.id);
    finishLoad();
    expect(view.webContents.executeJavaScript).toHaveBeenCalledWith(
      'document.title = "owned"',
      true
    );
    expect(view.webContents.insertCSS).toHaveBeenCalledWith('body { outline: 1px solid red; }');
  });

  it('doze keeps the view alive but detached, muted, and throttled; re-attach un-dozes', () => {
    const { service, viewId, manager, sendPush } = setup({ locked: () => false });

    manager.setBounds([{ viewId, rect: RECT }], [viewId]);
    const view = electronMock.state.createdViews[0];
    if (!view) throw new Error('Expected a created view');

    manager.doze(service.id);

    expect(electronMock.state.removeChildView).toHaveBeenCalled();
    expect(view.webContents.close).not.toHaveBeenCalled();
    expect(view.webContents.setAudioMuted).toHaveBeenCalledWith(true);
    expect(view.webContents.setBackgroundThrottling).toHaveBeenCalledWith(true);
    expect(manager.isDozing(service.id)).toBe(true);
    expect(manager.dozeStartedAt(service.id)).toBeTypeOf('number');
    expect(sendPush).toHaveBeenCalledWith('event:service-state', {
      instanceId: service.id,
      state: 'dozing'
    });

    // Selecting the pane again re-sends bounds: the SAME view re-attaches instantly (no reload).
    manager.setBounds([{ viewId, rect: RECT }], [viewId]);
    expect(electronMock.state.createdViews).toHaveLength(1);
    expect(view.webContents.setAudioMuted).toHaveBeenCalledWith(false);
    expect(manager.isDozing(service.id)).toBe(false);
    expect(view.webContents.loadURL).toHaveBeenCalledTimes(1);
  });

  it('estimates memory saved by sleeping from the last known usage', () => {
    const { context, service, viewId, manager } = setup({ locked: () => false });
    manager.setBounds([{ viewId, rect: RECT }], [viewId]);

    manager.recordMemory(service.id, 320);
    // Live view: nothing is being "saved" yet.
    expect(manager.estimatedSavedMB()).toBe(0);

    manager.sleep(service.id);
    expect(manager.estimatedSavedMB()).toBe(320);

    // Disabled (and deleted) services don't count as savings — they simply don't run.
    updateServiceInstance(context.db, context.deviceId, service.id, { disabled: true });
    expect(manager.estimatedSavedMB()).toBe(0);

    updateServiceInstance(context.db, context.deviceId, service.id, { disabled: false });
    expect(manager.estimatedSavedMB()).toBe(320);
    manager.forgetInstance(service.id);
    expect(manager.estimatedSavedMB()).toBe(0);
  });

  it('auto-reloads an attached pane after a transient crash', () => {
    vi.useFakeTimers();
    try {
      const { service, viewId, manager, sendPush } = setup({ locked: () => false });
      manager.setBounds([{ viewId, rect: RECT }], [viewId]);
      const view = electronMock.state.createdViews[0];
      if (!view) throw new Error('Expected a created view');
      const crash = view.webContents.handlers.get('render-process-gone');
      if (!crash) throw new Error('Expected render-process-gone handler');

      sendPush.mockClear();
      crash(undefined, { reason: 'crashed' });
      expect(sendPush).toHaveBeenCalledWith('event:service-state', {
        instanceId: service.id,
        state: 'loading'
      });
      vi.advanceTimersByTime(1100);
      expect(view.webContents.reload).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('parks a crashed detached pane instead of reloading it off-screen', () => {
    const { service, viewId, manager, sendPush } = setup({ locked: () => false });
    manager.setBounds([{ viewId, rect: RECT }], [viewId]);
    const view = electronMock.state.createdViews[0];
    if (!view) throw new Error('Expected a created view');
    const crash = view.webContents.handlers.get('render-process-gone');
    if (!crash) throw new Error('Expected render-process-gone handler');

    // Detach it (hidden pane), then crash.
    manager.setBounds([], []);
    sendPush.mockClear();
    crash(undefined, { reason: 'oom' });

    expect(view.webContents.reload).not.toHaveBeenCalled();
    expect(view.webContents.close).toHaveBeenCalled();
    expect(sendPush).toHaveBeenCalledWith('event:service-state', {
      instanceId: service.id,
      state: 'sleeping'
    });
  });

  it('enforces firewall rules and tracker blocking from one merged onBeforeRequest handler', async () => {
    const blocker = new TrackerBlocker();
    blocker.setEnabled(true);
    // The real bundled EasyList+EasyPrivacy snapshot drives the decisions under test.
    const loaded = await blocker.loadEngine([
      join(process.cwd(), 'resources', 'adblock-engine.bin')
    ]);
    expect(loaded).toBe(true);
    const { context, viewId, manager } = setup({ locked: () => false, trackerBlocker: blocker });

    manager.setBounds([{ viewId, rect: RECT }], [viewId]);
    const partition = [...electronMock.state.partitions.values()][0] as {
      webRequest: { onBeforeRequest: ReturnType<typeof vi.fn> };
    };
    expect(partition.webRequest.onBeforeRequest).toHaveBeenCalledTimes(1);
    const handler = partition.webRequest.onBeforeRequest.mock.calls[0]?.[0] as (
      details: { url: string; resourceType: string; referrer?: string },
      callback: (response: { cancel?: boolean }) => void
    ) => void;

    const cancels = (url: string): boolean => {
      let cancelled = false;
      handler(
        { url, resourceType: 'script', referrer: 'https://web.whatsapp.com/' },
        (response) => {
          cancelled = Boolean(response.cancel);
        }
      );
      return cancelled;
    };

    // Tracker blocking works without any firewall rules configured.
    expect(cancels('https://www.google-analytics.com/collect')).toBe(true);
    expect(blocker.stats().blockedTotal).toBe(1);
    expect(cancels('https://blocked.example.com/app.js')).toBe(false);

    // Firewall rules apply through the same handler, and the rule cache sees writes.
    const rule = upsertFirewallRule(context.db, {
      rule_type: 'domain',
      pattern: 'blocked.example.com',
      action: 'block'
    });
    expect(cancels('https://blocked.example.com/app.js')).toBe(true);
    deleteFirewallRule(context.db, rule.id);
    expect(cancels('https://blocked.example.com/app.js')).toBe(false);

    // Firewall rules stay enforced even where the tracker engine would also match —
    // and they win regardless of the tracker toggle.
    const trackerRule = upsertFirewallRule(context.db, {
      rule_type: 'domain',
      pattern: 'google-analytics.com',
      action: 'block'
    });
    blocker.setEnabled(false);
    expect(cancels('https://www.google-analytics.com/collect')).toBe(true);
    deleteFirewallRule(context.db, trackerRule.id);

    // Disabled tracker blocking passes tracker URLs through.
    expect(cancels('https://www.google-analytics.com/collect')).toBe(false);
  });

  it('reports instance visibility from the last bounds sync', () => {
    const { viewId, manager, service } = setup({ locked: () => false });
    expect(manager.isInstanceVisible(service.id)).toBe(false);
    manager.setBounds([{ viewId, rect: RECT }], [viewId]);
    expect(manager.isInstanceVisible(service.id)).toBe(true);
    manager.setBounds([], []);
    expect(manager.isInstanceVisible(service.id)).toBe(false);
  });

  it('never trims a service the user marked never-sleep, even parked in the tray', () => {
    const { context, service, viewId, manager } = setup({ locked: () => false });
    // Explicit never-sleep, and muted so the tier would otherwise be deep (destroy).
    updateServiceInstance(context.db, context.deviceId, service.id, {
      muted: true,
      sleep_policy: { idleMinutes: null }
    });
    manager.setBounds([{ viewId, rect: RECT }], [viewId]);
    const view = electronMock.state.createdViews[0];
    if (!view) throw new Error('Expected a created view');

    // Window hidden to the tray: every view is detached, then the trim sweep runs well past
    // the hidden-view window.
    manager.hideAll();
    const trimmed = manager.trimHiddenViews(0, Date.now() + 60 * 60_000);

    expect(trimmed).toBe(0);
    expect(view.webContents.close).not.toHaveBeenCalled();
    expect(manager.isDozing(service.id)).toBe(false);
  });

  it('still trims an ordinary hidden service', () => {
    const { service, viewId, manager } = setup({ locked: () => false });
    manager.setBounds([{ viewId, rect: RECT }], [viewId]);
    manager.hideAll();

    manager.trimHiddenViews(0, Date.now() + 60 * 60_000);

    // Default policy + unmuted => doze tier (renderer kept alive, notifications flowing).
    expect(manager.isDozing(service.id)).toBe(true);
  });
});
