import { contextBridge, ipcRenderer } from 'electron';

/**
 * Kept as a literal instead of importing `quickViewPushChannel` from ../shared/ipc-channels.js:
 * a shared import would make Rollup split ipc-channels into a common chunk for bridge.cjs +
 * quickview.cjs, and sandboxed preloads cannot require() sibling chunk files at runtime.
 * tests/unit/preloadBridge.test.ts pins this literal against the shared constant.
 */
const QUICK_VIEW_PUSH_CHANNEL = 'event:quickview-state';

/**
 * Minimal bridge for the tray quick-view popover. Deliberately not the main bridge: this window
 * only ever needs the three quickview channels plus the state push, so nothing else is exposed.
 */
const api = {
  getState(): Promise<unknown> {
    return ipcRenderer.invoke('quickview:get-state');
  },
  openService(instanceId: string): Promise<unknown> {
    return ipcRenderer.invoke('quickview:open-service', { instanceId });
  },
  openApp(): Promise<unknown> {
    return ipcRenderer.invoke('quickview:open-service', {});
  },
  close(): Promise<unknown> {
    return ipcRenderer.invoke('quickview:close');
  },
  onState(callback: (state: unknown) => void): () => void {
    const listener = (_event: Electron.IpcRendererEvent, payload: unknown): void =>
      callback(payload);
    ipcRenderer.on(QUICK_VIEW_PUSH_CHANNEL, listener);
    return () => ipcRenderer.removeListener(QUICK_VIEW_PUSH_CHANNEL, listener);
  }
};

contextBridge.exposeInMainWorld('appdeckQuickView', api);

export type QuickViewBridge = typeof api;
