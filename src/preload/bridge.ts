import { contextBridge, ipcRenderer } from 'electron';
import {
  pushChannels,
  rendererInvokeChannels,
  type IpcChannel,
  type PushChannel
} from '../shared/ipc-channels.js';

// Derived from the shared channel list (the same one the zod contract is checked against), so the
// bridge allowlists can never drift from the channels main actually registers. Service-preload-only
// channels (notify:incoming, unread:report) are excluded there and stay blocked here.
const allowedInvokeChannels = new Set<string>(rendererInvokeChannels);
const allowedPushChannels = new Set<string>(pushChannels);

const api = {
  invoke(channel: IpcChannel, payload?: unknown): Promise<unknown> {
    if (!allowedInvokeChannels.has(channel)) {
      return Promise.reject(new Error(`Blocked IPC channel: ${channel}`));
    }
    return ipcRenderer.invoke(channel, payload);
  },
  on(channel: PushChannel, callback: (payload: unknown) => void): () => void {
    if (!allowedPushChannels.has(channel)) {
      throw new Error(`Blocked push channel: ${channel}`);
    }
    const listener = (_event: Electron.IpcRendererEvent, payload: unknown): void =>
      callback(payload);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  }
};

contextBridge.exposeInMainWorld('appdeck', api);
