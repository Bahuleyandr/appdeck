import { ipcMain } from 'electron';
import type { IpcChannel } from '../../shared/ipc-contract.js';
import { catalogHandlers } from './handlers/catalog.js';
import { featureHandlers } from './handlers/features.js';
import { serviceHandlers } from './handlers/services.js';
import { systemHandlers } from './handlers/system.js';
import { workspaceHandlers } from './handlers/workspaces.js';
import type { Handler, IpcContext } from './types.js';

export type { IpcContext } from './types.js';

/**
 * Every renderer-reachable channel is registered here. The groups are split by domain purely to
 * keep the files readable — `tests/unit/ipcHandlers.test.ts` asserts the composed map covers
 * exactly the channel list the preload allowlist is derived from, so a group that forgets to
 * export a handler fails loudly instead of 404-ing at runtime.
 */
export function registerIpcHandlers(ctx: IpcContext): void {
  const handlers: Partial<Record<IpcChannel, Handler>> = {
    ...workspaceHandlers(ctx),
    ...serviceHandlers(ctx),
    ...catalogHandlers(ctx),
    ...featureHandlers(ctx),
    ...systemHandlers(ctx)
  };

  for (const [channel, handler] of Object.entries(handlers) as Array<[IpcChannel, Handler]>) {
    ipcMain.handle(channel, async (_event, payload) => handler(payload));
  }
}
