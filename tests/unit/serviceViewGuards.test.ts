import { beforeEach, describe, expect, it, vi } from 'vitest';

interface FakeWebContents {
  handlers: Map<string, (...args: unknown[]) => void>;
  loadURL: ReturnType<typeof vi.fn>;
  executeJavaScript: ReturnType<typeof vi.fn>;
  insertCSS: ReturnType<typeof vi.fn>;
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

import { createServiceInstance, updateServiceInstance } from '../../src/main/db/repositories/serviceInstances.js';
import { ensureDefaultTab } from '../../src/main/db/repositories/serviceTabs.js';
import { listWorkspaces } from '../../src/main/db/repositories/workspaces.js';
import { RecipeLoader } from '../../src/main/recipes/loader.js';
import { approveCustomCode } from '../../src/main/services/customCode.js';
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

function setup(options: { locked: () => boolean }) {
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
    null,
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
});
