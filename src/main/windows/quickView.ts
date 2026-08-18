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
  /** Whether the popover should be on screen once it is able to paint. */
  private wantVisible = false;
  /** Whether the current window has finished its first paint. */
  private painted = false;

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
    // Recorded even when there is nothing to hide yet: a hide requested between create() and the
    // first paint (an app lock firing on the idle timer, or Escape) must cancel the pending show,
    // or ready-to-show would put notification previews on top of the lock screen.
    this.wantVisible = false;
    if (!this.window || this.window.isDestroyed()) {
      return;
    }
    if (this.window.isVisible()) {
      this.hiddenAt = Date.now();
      this.window.hide();
    }
    // Armed even for a window that never became visible, so a load that never paints cannot leave
    // a renderer process alive until quit.
    this.scheduleDestroy();
  }

  /** Restore the full app (optionally focused on a service) and dismiss the popover. */
  openApp(instanceId?: string): void {
    // Raise the main window first: hiding the foreground window surrenders foreground ownership,
    // after which a focus() call can degrade to a taskbar flash on Windows.
    this.onOpenApp(instanceId);
    this.hide();
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
    this.wantVisible = true;
    const reused = this.window !== null && !this.window.isDestroyed();
    const window = reused ? (this.window as BrowserWindow) : this.create();
    this.window = window;
    const position = this.computePosition(trayBounds);
    window.setPosition(position.x, position.y);
    if (reused && this.painted) {
      window.webContents.send(quickViewPushChannel, this.getState());
      window.show();
    }
    // Otherwise the ready-to-show handler installed in create() shows it once it can paint, so a
    // frameless window never flashes white and a still-loading window is never shown blank. The
    // renderer pulls its own initial state via quickview:get-state on mount.
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
    this.painted = false;
    window.once('ready-to-show', () => {
      this.painted = true;
      // Re-checked because the popover may have been dismissed while it was still loading.
      if (this.wantVisible && !window.isDestroyed()) {
        window.show();
      }
    });
    window.webContents.on('did-fail-load', (_event, code, description) => {
      // Without this the window would sit invisible and never paint, holding a renderer process.
      console.error(`Quick view failed to load (${code}): ${description}`);
      this.wantVisible = false;
      if (!window.isDestroyed()) {
        window.destroy();
      }
    });
    window.on('blur', () => this.hide());
    window.on('closed', () => {
      // Guarded: a stale window's late 'closed' must not orphan a replacement.
      if (this.window === window) {
        this.cancelDestroy();
        this.window = null;
        this.painted = false;
      }
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
