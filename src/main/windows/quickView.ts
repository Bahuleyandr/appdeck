import { BrowserWindow, screen } from 'electron';
import { join } from 'node:path';
import { quickViewPushChannel } from '../../shared/ipc-channels.js';
import type { QuickViewState } from '../../shared/types.js';
import {
  computeQuickViewPosition,
  isUsableTrayBounds,
  type Point,
  type Rect
} from './quickViewPosition.js';

export const QUICK_VIEW_WIDTH = 360;
export const QUICK_VIEW_HEIGHT = 500;

/**
 * Grace period between hiding the popover and destroying its BrowserWindow. Hiding first keeps
 * open→close→open toggles instant; the delayed destroy guarantees the popover holds zero renderer
 * RAM shortly after the user walks away. 15s is long enough to cover "oops, reopen it" and short
 * enough that the window never idles in the background.
 */
export const QUICK_VIEW_DESTROY_GRACE_MS = 15_000;

/**
 * A tray click that closes the popover arrives as blur (hides the window) followed by the tray
 * click event; without this window the toggle would instantly reopen it.
 */
const BLUR_TOGGLE_SUPPRESS_MS = 300;

/**
 * The tray quick-view popover: a small frameless always-on-top window fed exclusively with
 * main-process data (badge counts + the SQLite notification archive). It never attaches, wakes or
 * un-parks a service view — restoring the app goes through the normal window-show path instead.
 *
 * Lifecycle: created lazily on first tray click, hidden on blur/Escape/toggle, destroyed after a
 * short grace period so it costs nothing while unused.
 */
export class QuickViewController {
  private window: BrowserWindow | null = null;
  private destroyTimer: NodeJS.Timeout | null = null;
  private hiddenAt = 0;

  constructor(
    private readonly preloadPath: string,
    private readonly getState: () => QuickViewState,
    private readonly onOpenApp: (instanceId?: string) => void
  ) {}

  /** Left tray click: open near the tray icon, or close when already open. */
  toggle(trayBounds: Rect | null): void {
    if (this.isOpen()) {
      this.hide();
      return;
    }
    if (Date.now() - this.hiddenAt < BLUR_TOGGLE_SUPPRESS_MS) {
      // The click that dismissed the popover (via blur) also fired the tray click; swallow it.
      return;
    }
    this.showAt(trayBounds);
  }

  isOpen(): boolean {
    return this.window !== null && !this.window.isDestroyed() && this.window.isVisible();
  }

  hide(): void {
    if (!this.window || this.window.isDestroyed() || !this.window.isVisible()) {
      return;
    }
    this.hiddenAt = Date.now();
    this.window.hide();
    this.scheduleDestroy();
  }

  /** Restore the full app (optionally focused on a service) and dismiss the popover. */
  openApp(instanceId?: string): void {
    this.hide();
    this.onOpenApp(instanceId);
  }

  /** Push a fresh snapshot while the popover is open; a no-op (zero cost) while it is closed. */
  notifyStateChanged(): void {
    if (!this.isOpen()) {
      return;
    }
    this.window?.webContents.send(quickViewPushChannel, this.getState());
  }

  dispose(): void {
    this.cancelDestroy();
    if (this.window && !this.window.isDestroyed()) {
      this.window.destroy();
    }
    this.window = null;
  }

  private showAt(trayBounds: Rect | null): void {
    this.cancelDestroy();
    const reused = this.window !== null && !this.window.isDestroyed();
    const window = reused ? (this.window as BrowserWindow) : this.create();
    this.window = window;
    const position = this.computePosition(trayBounds);
    window.setPosition(position.x, position.y);
    if (reused) {
      window.webContents.send(quickViewPushChannel, this.getState());
      window.show();
    } else {
      // First open: wait for paint so the frameless window doesn't flash white. The renderer
      // pulls its initial state itself via quickview:get-state on mount.
      window.once('ready-to-show', () => {
        if (!window.isDestroyed()) {
          window.show();
        }
      });
    }
  }

  private create(): BrowserWindow {
    const window = new BrowserWindow({
      width: QUICK_VIEW_WIDTH,
      height: QUICK_VIEW_HEIGHT,
      frame: false,
      resizable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      show: false,
      backgroundColor: '#101216',
      webPreferences: {
        preload: this.preloadPath,
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false
      }
    });
    window.on('blur', () => this.hide());
    window.on('closed', () => {
      this.cancelDestroy();
      this.window = null;
    });
    const rendererUrl = process.env.ELECTRON_RENDERER_URL;
    if (rendererUrl) {
      void window.loadURL(`${rendererUrl}/quickview.html`);
    } else {
      // Same session as the main window, so the packaged-shell CSP registered by createMainWindow
      // applies here too.
      void window.loadFile(join(__dirname, '../renderer/quickview.html'));
    }
    return window;
  }

  private computePosition(trayBounds: Rect | null): Point {
    const cursor = screen.getCursorScreenPoint();
    const anchor = isUsableTrayBounds(trayBounds)
      ? { x: trayBounds.x + trayBounds.width / 2, y: trayBounds.y + trayBounds.height / 2 }
      : cursor;
    const workArea = screen.getDisplayNearestPoint(anchor).workArea;
    return computeQuickViewPosition({
      platform: process.platform,
      trayBounds,
      cursor,
      workArea,
      windowSize: { width: QUICK_VIEW_WIDTH, height: QUICK_VIEW_HEIGHT }
    });
  }

  private scheduleDestroy(): void {
    this.cancelDestroy();
    this.destroyTimer = setTimeout(() => {
      this.destroyTimer = null;
      if (this.window && !this.window.isDestroyed() && !this.window.isVisible()) {
        this.window.destroy();
        this.window = null;
      }
    }, QUICK_VIEW_DESTROY_GRACE_MS);
    this.destroyTimer.unref?.();
  }

  private cancelDestroy(): void {
    if (this.destroyTimer) {
      clearTimeout(this.destroyTimer);
      this.destroyTimer = null;
    }
  }
}
