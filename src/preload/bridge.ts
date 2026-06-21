import { contextBridge, ipcRenderer } from 'electron';
import type { IpcChannel, PushChannel } from '../shared/ipc-contract.js';

const allowedInvokeChannels = new Set<string>([
  'workspace:list',
  'workspace:create',
  'workspace:update',
  'workspace:delete',
  'workspace:reorder',
  'profile:list',
  'profile:create',
  'profile:update',
  'profile:delete',
  'service:list',
  'service:create',
  'service:update',
  'service:delete',
  'service:reorder',
  'service:reload',
  'service:navigateBack',
  'service:navigateForward',
  'service:navigate',
  'service:sleep',
  'service:wake',
  'view:setBounds',
  'view:focus',
  'tab:list',
  'tab:create',
  'tab:close',
  'tab:setActive',
  'recipe:catalog',
  'recipe:createCustom',
  'recipe:updateCustom',
  'recipe:deleteCustom',
  'recipe:resolveForInstance',
  'layout:get',
  'layout:set',
  'lock:status',
  'lock:setup',
  'lock:unlock',
  'lock:lock',
  'sync:status',
  'sync:configure',
  'sync:join',
  'sync:exportVault',
  'sync:importVault',
  'sync:now',
  'task:list',
  'task:create',
  'task:update',
  'task:delete',
  'task:reorder',
  'palette:query',
  'notification:list',
  'notification:search',
  'notification:markRead',
  'notification:markAllRead',
  'notification:snooze',
  'notification:clear',
  'notification:unreadCount',
  'ai:status',
  'ai:configure',
  'ai:clearKey',
  'ai:brief',
  'ai:triage',
  'extension:list',
  'extension:add',
  'extension:remove',
  'extension:setEnabled',
  'import:ferdium',
  'metrics:get',
  'settings:get',
  'settings:set',
  'update:status',
  'update:check',
  'update:install'
]);
const allowedPushChannels = new Set<string>([
  'event:unread',
  'event:notification-clicked',
  'event:service-state',
  'event:locked',
  'event:data-changed',
  'event:notification',
  'event:update-status',
  'event:settings-changed'
]);

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
    const listener = (_event: Electron.IpcRendererEvent, payload: unknown): void => callback(payload);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  }
};

contextBridge.exposeInMainWorld('appdeck', api);

export type AppDeckBridge = typeof api;
