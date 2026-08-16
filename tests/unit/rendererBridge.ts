import { vi } from 'vitest';
import type { IpcChannel, PushChannel } from '../../src/shared/ipc-contract.js';

/**
 * Typed test double for the preload bridge (`window.appdeck`) used by renderer component tests.
 *
 * `handlers` maps IPC channels to responses; anything unhandled resolves to `undefined` so a
 * component under test never hangs on an unexpected call. `emit` drives push events into any
 * `api.on(...)` subscriptions the component registered.
 */
export type BridgeHandlers = Partial<Record<IpcChannel, (payload?: unknown) => unknown>>;

export interface TestBridge {
  invoke: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  emit: (channel: PushChannel, payload?: unknown) => void;
  /** Live listener count per channel; lets tests assert unsubscribe-on-unmount. */
  listenerCount: (channel: PushChannel) => number;
}

export function installTestBridge(handlers: BridgeHandlers = {}): TestBridge {
  const listeners = new Map<PushChannel, Set<(payload: unknown) => void>>();
  const invoke = vi.fn(async (channel: IpcChannel, payload?: unknown): Promise<unknown> => {
    const handler = handlers[channel];
    return handler ? await handler(payload) : undefined;
  });
  const on = vi.fn((channel: PushChannel, callback: (payload: unknown) => void): (() => void) => {
    const set = listeners.get(channel) ?? new Set();
    set.add(callback);
    listeners.set(channel, set);
    return () => {
      set.delete(callback);
    };
  });
  Object.defineProperty(window, 'appdeck', {
    configurable: true,
    value: { invoke, on }
  });
  return {
    invoke,
    on,
    emit: (channel, payload) => {
      for (const callback of listeners.get(channel) ?? []) callback(payload);
    },
    listenerCount: (channel) => listeners.get(channel)?.size ?? 0
  };
}

/** jsdom has no matchMedia; the store's theme code touches it on load/applySettings. */
export function mockMatchMedia(): void {
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  });
}

/**
 * The minimal channel set `useAppStore.getState().load()` touches, so store-driven components
 * can render without each test re-listing every startup call. Override per test as needed.
 */
export function storeLoadHandlers(overrides: BridgeHandlers = {}): BridgeHandlers {
  return {
    'workspace:list': () => [],
    'profile:list': () => [],
    'recipe:catalog': () => [],
    'task:list': () => [],
    'lock:status': () => ({ locked: false, configured: false }),
    'sync:status': () => ({ configured: false }),
    'settings:get': () => ({ onboarded: 'true' }),
    'notification:unreadCount': () => 0,
    'ai:status': () => ({ configured: false }),
    'service:list': () => [],
    'layout:get': (payload) => ({
      workspace_id: (payload as { workspaceId: string }).workspaceId,
      mode: 'single',
      selected_service_ids: [],
      tile_sizing: {}
    }),
    ...overrides
  };
}
