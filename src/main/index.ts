import {
  app,
  BrowserWindow,
  dialog,
  globalShortcut,
  ipcMain,
  Menu,
  nativeImage,
  Notification,
  powerMonitor,
  Tray
} from 'electron';
import { join } from 'node:path';
import { APP_NAME, APP_PROTOCOL, DEFAULT_GLOBAL_HOTKEY } from '../shared/constants.js';
import { openDatabase } from './db/connection.js';
import { pruneOldNotifications } from './db/repositories/notifications.js';
import { getBoolSetting, getSetting } from './db/repositories/settings.js';
import { listServiceInstances } from './db/repositories/serviceInstances.js';
import { registerIpcHandlers } from './ipc/register.js';
import { RecipeLoader } from './recipes/loader.js';
import { AiService } from './services/aiService.js';
import { AppLockService } from './services/appLock.js';
import { AutomationRuntime } from './services/automationRuntime.js';
import { BadgeService } from './services/badges.js';
import { ExtensionManager } from './services/extensionManager.js';
import { LinkRouter } from './services/linkRouter.js';
import { logError } from './services/log.js';
import { NotificationService } from './services/notifications.js';
import { PeerSyncRuntime } from './services/peerSyncRuntime.js';
import { applyPortableMode } from './services/portableMode.js';
import { SleepManager } from './services/sleepManager.js';
import { TrackerBlocker } from './services/trackerBlock.js';
import { UpdaterService } from './services/updater.js';
import { CloudSyncService } from './sync/cloudSync.js';
import { FileSyncService } from './sync/fileSync.js';
import { ServiceViewManager } from './views/serviceViewManager.js';
import { restoreWindowForUserAttention } from './windows/attention.js';
import { createMainWindow } from './windows/mainWindow.js';

let mainWindow: BrowserWindow | null = null;
let viewManager: ServiceViewManager | null = null;
let sleepManager: SleepManager | null = null;
let lockService: AppLockService | null = null;
let linkRouter: LinkRouter | null = null;
let automationRuntime: AutomationRuntime | null = null;
let peerSyncRuntime: PeerSyncRuntime | null = null;
let notificationService: NotificationService | null = null;
let tray: Tray | null = null;
let isQuitting = false;
let notificationPruneTimer: NodeJS.Timeout | null = null;
/** Deep link that arrived before LinkRouter was constructed; flushed by flushPendingDeepLink. */
let pendingDeepLink: string | null = null;

const NOTIFICATION_PRUNE_INTERVAL_MS = 60 * 60 * 1000;

function routeDeepLink(url: string): void {
  if (linkRouter) {
    linkRouter.route(url);
    return;
  }
  pendingDeepLink = url;
}

function flushPendingDeepLink(argv: string[]): void {
  const url = pendingDeepLink ?? argv.find((arg) => arg.startsWith(`${APP_PROTOCOL}://`)) ?? null;
  pendingDeepLink = null;
  if (url) {
    linkRouter?.route(url);
  }
}

// Log first, then fall back to the platform default. Swallowing an uncaught exception would
// leave the main process running on half-applied state; a stray rejection is not worth killing
// the whole workspace over.
process.on('uncaughtException', (error) => {
  logError('uncaughtException', error);
  app.exit(1);
});
process.on('unhandledRejection', (reason) => logError('unhandledRejection', reason));

// Must run before anything resolves userData — the database, logs, encrypted vault and every
// service's Chromium partition all live under it.
const portableRoot = applyPortableMode();
if (portableRoot) {
  console.log(`[portable] user data directory: ${portableRoot}`);
}

app.setAsDefaultProtocolClient(APP_PROTOCOL);
if (process.platform === 'win32') {
  app.setAppUserModelId('com.appdeck.app');
}

const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    const deepLink = argv.find((arg) => arg.startsWith(`${APP_PROTOCOL}://`));
    if (deepLink) {
      routeDeepLink(deepLink);
    }
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    }
  });

  // A cold launch by deep link fires open-url (macOS) or carries the URL in argv (Windows/Linux)
  // long before linkRouter exists, so buffer it and flush once routing is up.
  app.on('open-url', (event, url) => {
    event.preventDefault();
    routeDeepLink(url);
  });

  void app
    .whenReady()
    .then(() => {
      // Strip the Electron + app tokens from the UA so UA-sniffing services (WhatsApp Web, Google,
      // etc.) treat us as plain Chrome instead of rejecting an unknown browser.
      app.userAgentFallback = app.userAgentFallback
        .replace(/ Electron\/[\d.]+/i, '')
        .replace(new RegExp(` ${app.getName()}\\/[\\d.]+`, 'i'), '');

      const dbContext = openDatabase();
      const db = dbContext.db;
      const recipeLoader = new RecipeLoader(db);
      const bridgePreload = join(__dirname, '../preload/bridge.cjs');
      const servicePreload = join(__dirname, '../preload/service.cjs');
      mainWindow = createMainWindow(bridgePreload);

      const sendPush = (channel: string, payload?: unknown): void => {
        mainWindow?.webContents.send(channel, payload);
      };

      const trackerBlocker = new TrackerBlocker();
      trackerBlocker.setEnabled(getBoolSetting(db, 'tracker_block'));
      // Engine load is async and off the critical startup path (deserialize measures ~10ms,
      // but the 3MB read stays out of first-paint). Requests pass through until it's ready.
      // A user-updated snapshot in userData wins over the bundled one when it is newer.
      const bundledEnginePath = app.isPackaged
        ? join(process.resourcesPath, 'adblock-engine.bin')
        : join(app.getAppPath(), 'resources', 'adblock-engine.bin');
      void trackerBlocker
        .loadEngine([join(app.getPath('userData'), 'adblock-engine.bin'), bundledEnginePath])
        .catch(() => undefined);
      const extensionManager = new ExtensionManager(db);

      lockService = new AppLockService(db, () => {
        viewManager?.hideAll();
        sendPush('event:locked');
      });
      lockService.setIdleTimeoutMinutes(getSetting(db, 'auto_lock_minutes'));

      viewManager = new ServiceViewManager(
        db,
        dbContext.deviceId,
        recipeLoader,
        servicePreload,
        sendPush,
        () => lockService?.bumpIdleTimer(),
        () => lockService?.status().locked ?? false,
        extensionManager,
        trackerBlocker,
        mainWindow
      );

      const badgeService = new BadgeService(() => mainWindow);
      notificationService = new NotificationService(
        db,
        () => mainWindow,
        (instanceId) => {
          restoreWindowForUserAttention(mainWindow);
          sendPush('event:notification-clicked', { instanceId });
        },
        () => getBoolSetting(db, 'global_dnd')
      );
      const sendDataChanged = (): void => {
        sendPush('event:data-changed');
        fileSyncService.scheduleSync();
        cloudSyncService.scheduleSync();
      };
      // Background syncs (folder watcher, debounced pushes) can apply remote changes with no
      // IPC call in flight — surface those to the renderer the same way local edits are.
      const fileSyncService = new FileSyncService(db, () => sendDataChanged());
      fileSyncService.init();
      const cloudSyncService = new CloudSyncService(db, () => sendDataChanged());
      const aiService = new AiService(db);
      const updaterService = new UpdaterService(sendPush);
      updaterService.init();
      linkRouter = new LinkRouter(db, recipeLoader, viewManager, sendPush);
      // A URL that launched the app (argv on Windows/Linux, buffered open-url on macOS) is only
      // routable now that LinkRouter exists.
      flushPendingDeepLink(process.argv);
      peerSyncRuntime = new PeerSyncRuntime(db);
      // Serving exposes a listening socket on the LAN/tailnet, so it's opt-in (default off). Pulling
      // from peers is an outbound fetch and needs no local server. The share server requires a bearer
      // secret even when on. Toggle via the `peer_sync_serve` setting.
      if (getBoolSetting(db, 'peer_sync_serve')) {
        void peerSyncRuntime.startServer().catch(() => undefined);
      }
      automationRuntime = new AutomationRuntime({
        db,
        viewManager,
        sendPush,
        sendDataChanged,
        aiService,
        notifyUser: (title, body) => {
          if (getBoolSetting(db, 'global_dnd') || !Notification.isSupported()) {
            return;
          }
          const toast = new Notification({ title, body });
          toast.on('click', () => restoreWindowForUserAttention(mainWindow));
          toast.show();
        }
      });
      automationRuntime.start();

      pruneOldNotifications(db);
      notificationPruneTimer = setInterval(
        () => pruneOldNotifications(db),
        NOTIFICATION_PRUNE_INTERVAL_MS
      );
      notificationPruneTimer.unref();
      badgeService.reconcile(listServiceInstances(db).map((service) => service.id));
      sleepManager = new SleepManager(db, viewManager, () => !(mainWindow?.isVisible() ?? false));
      sleepManager.start();

      const toggleWindow = (): void => {
        if (!mainWindow) {
          return;
        }
        if (mainWindow.isVisible() && mainWindow.isFocused()) {
          mainWindow.hide();
        } else {
          if (!mainWindow.isVisible()) mainWindow.show();
          mainWindow.focus();
        }
      };

      const registerHotkey = (): void => {
        globalShortcut.unregisterAll();
        const accelerator = getSetting(db, 'global_hotkey') || DEFAULT_GLOBAL_HOTKEY;
        try {
          globalShortcut.register(accelerator, toggleWindow);
        } catch {
          // Ignore invalid accelerator strings — the user can fix it in Settings.
        }
      };

      registerIpcHandlers({
        db,
        deviceId: dbContext.deviceId,
        recipeLoader,
        viewManager,
        notificationService,
        automationRuntime,
        badgeService,
        lockService,
        fileSyncService,
        cloudSyncService,
        aiService,
        linkRouter,
        trackerBlocker,
        updaterService,
        peerSyncRuntime,
        sendPush,
        sendDataChanged,
        onSettingsChanged: () => {
          trackerBlocker.setEnabled(getBoolSetting(db, 'tracker_block'));
          lockService?.setIdleTimeoutMinutes(getSetting(db, 'auto_lock_minutes'));
          registerHotkey();
          if (getBoolSetting(db, 'peer_sync_serve')) {
            void peerSyncRuntime?.startServer().catch(() => undefined);
          } else {
            peerSyncRuntime?.dispose();
          }
        }
      });

      const wireWindow = (window: BrowserWindow): void => {
        window.on('focus', () => lockService?.bumpIdleTimer());
        // Park every service view while the window sits in the tray so trim/doze can reclaim RAM;
        // clearing the active instance lets idle tracking park the previously focused pane too.
        window.on('hide', () => {
          viewManager?.hideAll();
          viewManager?.clearActive();
        });
        // Deliberately NOT cleared on blur: alt-tabbing away leaves the pane on screen, and
        // dropping the active id would strip the isFocused guard that keeps SleepManager from
        // tearing down a visible pane. Only hiding to the tray parks views.
        // Ask the renderer to re-send bounds so parked views re-attach. If the renderer never
        // responds, nothing breaks — views stay parked until the next natural bounds sync.
        window.on('show', () => sendPush('event:views-resync-requested'));
        (
          window as BrowserWindow & {
            on(event: 'minimize', listener: (event: Electron.Event) => void): BrowserWindow;
          }
        ).on('minimize', (event: Electron.Event) => {
          if (getBoolSetting(db, 'minimize_to_tray')) {
            event.preventDefault();
            window.hide();
          }
        });
        window.on('close', (event) => {
          if (!isQuitting && getBoolSetting(db, 'close_to_tray')) {
            event.preventDefault();
            window.hide();
          }
        });
        window.on('closed', () => {
          viewManager?.destroyAll();
          mainWindow = null;
        });
      };
      wireWindow(mainWindow);

      tray = new Tray(trayIcon());
      tray.setToolTip(APP_NAME);
      tray.setContextMenu(
        Menu.buildFromTemplate([
          { label: 'Show AppDeck', click: toggleWindow },
          { type: 'separator' },
          {
            label: 'Quit',
            click: () => {
              isQuitting = true;
              app.quit();
            }
          }
        ])
      );
      tray.on('click', toggleWindow);

      registerHotkey();

      powerMonitor.on('lock-screen', () => lockService?.lock());
      powerMonitor.on('suspend', () => lockService?.lock());

      app.on('activate', () => {
        if (!mainWindow) {
          mainWindow = createMainWindow(bridgePreload);
          viewManager?.setWindow(mainWindow);
          wireWindow(mainWindow);
        } else if (!mainWindow.isVisible()) {
          mainWindow.show();
        }
      });

      app.on('before-quit', () => {
        isQuitting = true;
        sleepManager?.stop();
        notificationService?.dispose();
        notificationService = null;
        automationRuntime?.dispose();
        automationRuntime = null;
        peerSyncRuntime?.dispose();
        peerSyncRuntime = null;
        if (notificationPruneTimer) {
          clearInterval(notificationPruneTimer);
          notificationPruneTimer = null;
        }
        fileSyncService.dispose();
        cloudSyncService.dispose();
        globalShortcut.unregisterAll();
        viewManager?.destroyAll();
        ipcMain.removeAllListeners();
      });
    })
    .catch((error: unknown) => {
      logError('startup', error);
      dialog.showErrorBox(
        'AppDeck failed to start',
        error instanceof Error ? error.message : String(error)
      );
      app.exit(1);
    });

  app.on('window-all-closed', () => {
    // With close-to-tray the window hides rather than closes, so this only fires on a real quit.
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}

// 16x16 BGRA app-tinted square for the tray (no asset file needed).
function trayIcon(): Electron.NativeImage {
  const size = 16;
  const buffer = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i += 1) {
    const offset = i * 4;
    buffer[offset] = 246; // B
    buffer[offset + 1] = 130; // G
    buffer[offset + 2] = 59; // R  -> #3b82f6-ish
    buffer[offset + 3] = 255; // A
  }
  return nativeImage.createFromBitmap(buffer, { width: size, height: size });
}
