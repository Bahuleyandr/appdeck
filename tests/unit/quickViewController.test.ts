import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Fake BrowserWindow with an inspectable event registry, so tests can decide exactly when the
 * window "paints" (ready-to-show) relative to hide()/lock.
 */
class FakeWindow {
  static instances: FakeWindow[] = [];
  handlers = new Map<string, Array<(...args: unknown[]) => void>>();
  webContentsHandlers = new Map<string, Array<(...args: unknown[]) => void>>();
  visible = false;
  destroyed = false;
  shown = 0;
  sent: unknown[] = [];
  webContents = {
    send: (_channel: string, payload: unknown) => this.sent.push(payload),
    on: (event: string, cb: (...args: unknown[]) => void) => {
      const list = this.webContentsHandlers.get(event) ?? [];
      list.push(cb);
      this.webContentsHandlers.set(event, list);
    }
  };

  constructor() {
    FakeWindow.instances.push(this);
  }
  private add(event: string, cb: (...args: unknown[]) => void): void {
    const list = this.handlers.get(event) ?? [];
    list.push(cb);
    this.handlers.set(event, list);
  }
  on = (event: string, cb: (...args: unknown[]) => void): void => this.add(event, cb);
  once = (event: string, cb: (...args: unknown[]) => void): void => this.add(event, cb);
  emit(event: string, ...args: unknown[]): void {
    for (const cb of this.handlers.get(event) ?? []) cb(...args);
  }
  emitWebContents(event: string, ...args: unknown[]): void {
    for (const cb of this.webContentsHandlers.get(event) ?? []) cb(...args);
  }
  setPosition = (): void => undefined;
  show = (): void => {
    this.shown += 1;
    this.visible = true;
  };
  hide = (): void => {
    this.visible = false;
  };
  isVisible = (): boolean => this.visible;
  isDestroyed = (): boolean => this.destroyed;
  destroy = (): void => {
    this.destroyed = true;
    this.emit('closed');
  };
  loadURL = (): Promise<void> => Promise.resolve();
  loadFile = (): Promise<void> => Promise.resolve();
}

vi.mock('electron', () => ({
  BrowserWindow: FakeWindow,
  screen: {
    getCursorScreenPoint: () => ({ x: 1900, y: 1050 }),
    getDisplayNearestPoint: () => ({ workArea: { x: 0, y: 0, width: 1920, height: 1040 } })
  }
}));

const { QuickViewController } = await import('../../src/main/windows/quickView.js');

/** Mirrors BLUR_TOGGLE_SUPPRESS_MS in quickView.ts (not exported). */
const BLUR_TOGGLE_SUPPRESS_MS = 300;

const STATE = { services: [], notifications: [], totalUnread: 0, theme: 'dark' };
const TRAY = { x: 1800, y: 1050, width: 24, height: 24 };

/** The single window the controller should have created; throws rather than asserting non-null. */
function onlyWindow(): FakeWindow {
  const [window] = FakeWindow.instances;
  if (!window) throw new Error('expected the controller to have created a window');
  return window;
}

function makeController(): InstanceType<typeof QuickViewController> {
  return new QuickViewController('/preload.cjs', () => STATE, () => undefined);
}

describe('QuickViewController', () => {
  beforeEach(() => {
    FakeWindow.instances = [];
  });

  it('does not show a popover that was dismissed before it finished painting', () => {
    const controller = makeController();
    controller.toggle(TRAY);
    const window = onlyWindow();
    expect(window.shown).toBe(0); // still loading

    // An app lock (or Escape) lands before the first paint.
    controller.hide();
    window.emit('ready-to-show');

    expect(window.shown).toBe(0);
    expect(window.isVisible()).toBe(false);
  });

  it('shows the popover once it paints when it has not been dismissed', () => {
    // Positive control: without this, the assertion above would pass even if show() were dead.
    const controller = makeController();
    controller.toggle(TRAY);
    const window = onlyWindow();

    window.emit('ready-to-show');

    expect(window.shown).toBe(1);
    expect(window.isVisible()).toBe(true);
  });

  it('destroys a window whose load fails instead of leaving it invisible and alive', () => {
    const controller = makeController();
    controller.toggle(TRAY);
    const window = onlyWindow();

    window.emitWebContents('did-fail-load', {}, -6, 'ERR_FILE_NOT_FOUND');

    expect(window.isDestroyed()).toBe(true);
    // A later paint event from the dead window must not resurrect it.
    window.emit('ready-to-show');
    expect(window.shown).toBe(0);
  });

  it('reuses a painted window and pushes fresh state into it', () => {
    // Fake timers so the clock can step past the blur-toggle suppression window; a real-time test
    // would run inside it and the reopen would be swallowed as a duplicate tray click.
    vi.useFakeTimers();
    const controller = makeController();
    controller.toggle(TRAY);
    const window = onlyWindow();
    window.emit('ready-to-show');
    controller.hide();
    vi.advanceTimersByTime(BLUR_TOGGLE_SUPPRESS_MS + 50);

    controller.toggle(TRAY);
    vi.useRealTimers();

    expect(FakeWindow.instances).toHaveLength(1);
    expect(window.shown).toBe(2);
    expect(window.sent).toHaveLength(1);
  });
});
