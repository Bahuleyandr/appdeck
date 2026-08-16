import type { IpcChannel } from '../../../shared/ipc-contract.js';
import { parseIpcPayload } from '../../../shared/ipc-contract.js';
import { createProfile, listProfiles, tombstoneProfile, updateProfile } from '../../db/repositories/profiles.js';
import { createWorkspace, listWorkspaces, reorderWorkspaces, tombstoneWorkspace, updateWorkspace } from '../../db/repositories/workspaces.js';
import type { Handler, IpcContext } from '../types.js';

export function workspaceHandlers(ctx: IpcContext): Partial<Record<IpcChannel, Handler>> {
  return {
    'workspace:list': () => listWorkspaces(ctx.db),
    'workspace:create': (payload) => {
      const input = parseIpcPayload('workspace:create', payload);
      const workspace = createWorkspace(ctx.db, ctx.deviceId, input);
      ctx.sendDataChanged();
      return workspace;
    },
    'workspace:update': (payload) => {
      const input = parseIpcPayload('workspace:update', payload);
      const workspace = updateWorkspace(ctx.db, ctx.deviceId, input.id, input.patch);
      ctx.sendDataChanged();
      return workspace;
    },
    'workspace:delete': (payload) => {
      const input = parseIpcPayload('workspace:delete', payload);
      tombstoneWorkspace(ctx.db, ctx.deviceId, input.id);
      ctx.sendDataChanged();
    },
    'workspace:reorder': (payload) => {
      const input = parseIpcPayload('workspace:reorder', payload);
      reorderWorkspaces(ctx.db, ctx.deviceId, input.orderedIds);
      ctx.sendDataChanged();
    },

    'profile:list': () => listProfiles(ctx.db),
    'profile:create': (payload) => {
      const input = parseIpcPayload('profile:create', payload);
      const profile = createProfile(ctx.db, ctx.deviceId, input);
      ctx.sendDataChanged();
      return profile;
    },
    'profile:update': (payload) => {
      const input = parseIpcPayload('profile:update', payload);
      const profile = updateProfile(ctx.db, ctx.deviceId, input.id, input.patch);
      ctx.sendDataChanged();
      return profile;
    },
    'profile:delete': (payload) => {
      const input = parseIpcPayload('profile:delete', payload);
      tombstoneProfile(ctx.db, ctx.deviceId, input.id);
      ctx.sendDataChanged();
    }
  };
}
