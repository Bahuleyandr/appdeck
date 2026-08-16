import type { IpcChannel } from '../../../shared/ipc-contract.js';
import { parseIpcPayload } from '../../../shared/ipc-contract.js';
import { createServiceInstance, getServiceInstance, listServiceInstances, tombstoneServiceInstance, updateServiceInstance } from '../../db/repositories/serviceInstances.js';
import { closeTab, createTab, deleteTabsForInstance, ensureDefaultTab, listTabs, setActiveTab } from '../../db/repositories/serviceTabs.js';
import { reorderWorkspaceServices } from '../../db/repositories/workspaceServices.js';
import { approveCustomCode, listPendingCustomCode } from '../../services/customCode.js';
import { session } from 'electron';
import type { Handler, IpcContext } from '../types.js';

export function serviceHandlers(ctx: IpcContext): Partial<Record<IpcChannel, Handler>> {
  return {
    'service:list': (payload) => {
      const input = parseIpcPayload('service:list', payload);
      return listServiceInstances(ctx.db, input?.workspaceId);
    },
    'service:create': (payload) => {
      const input = parseIpcPayload('service:create', payload);
      const service = createServiceInstance(ctx.db, ctx.deviceId, input);
      ctx.sendDataChanged();
      return service;
    },
    'service:update': (payload) => {
      const input = parseIpcPayload('service:update', payload);
      const service = updateServiceInstance(ctx.db, ctx.deviceId, input.id, input.patch);
      // Editing custom code over local IPC is explicit user intent — approve it here so only
      // code arriving via sync/import stays gated until the user reviews it.
      if (input.patch.custom_css !== undefined || input.patch.custom_js !== undefined) {
        approveCustomCode(ctx.db, input.id);
      }
      ctx.sendDataChanged();
      return service;
    },
    'service:pendingCustomCode': () => listPendingCustomCode(ctx.db),
    'service:approveCustomCode': (payload) => {
      const input = parseIpcPayload('service:approveCustomCode', payload);
      approveCustomCode(ctx.db, input.id);
      ctx.viewManager.reload(input.id);
      ctx.sendDataChanged();
    },
    'service:delete': async (payload) => {
      const input = parseIpcPayload('service:delete', payload);
      const service = listServiceInstances(ctx.db, undefined, true).find(
        (candidate) => candidate.id === input.id
      );
      ctx.viewManager.sleep(input.id);
      ctx.viewManager.forgetInstance(input.id);
      ctx.badgeService.clear(input.id);
      tombstoneServiceInstance(ctx.db, ctx.deviceId, input.id);
      deleteTabsForInstance(ctx.db, input.id);
      if (input.wipeData && service) {
        await session.fromPartition(service.partition_key).clearStorageData();
      }
      ctx.sendDataChanged();
    },
    'service:reorder': (payload) => {
      const input = parseIpcPayload('service:reorder', payload);
      reorderWorkspaceServices(ctx.db, ctx.deviceId, input.workspaceId, input.orderedIds);
      ctx.sendDataChanged();
    },
    'service:reload': (payload) =>
      ctx.viewManager.reload(parseIpcPayload('service:reload', payload).id),
    'service:navigateBack': (payload) =>
      ctx.viewManager.navigateBack(parseIpcPayload('service:navigateBack', payload).id),
    'service:navigateForward': (payload) =>
      ctx.viewManager.navigateForward(parseIpcPayload('service:navigateForward', payload).id),
    'service:sleep': (payload) =>
      ctx.viewManager.sleep(parseIpcPayload('service:sleep', payload).id),
    'service:wake': (payload) => ctx.viewManager.wake(parseIpcPayload('service:wake', payload).id),
    'service:openExternal': (payload) =>
      ctx.viewManager.openExternal(parseIpcPayload('service:openExternal', payload).id),
    'service:currentUrl': (payload) => ({
      url: ctx.viewManager.currentUrl(parseIpcPayload('service:currentUrl', payload).id)
    }),
    'service:clearStorage': async (payload) => {
      const { id } = parseIpcPayload('service:clearStorage', payload);
      const service = getServiceInstance(ctx.db, id);
      if (!service) throw new Error('Service not found');
      await session.fromPartition(service.partition_key).clearStorageData();
      ctx.viewManager.reload(id);
    },
    'service:setZoom': (payload) => {
      const input = parseIpcPayload('service:setZoom', payload);
      ctx.viewManager.setZoom(input.id, input.zoomFactor);
      updateServiceInstance(ctx.db, ctx.deviceId, input.id, { zoom_factor: input.zoomFactor });
      ctx.sendDataChanged();
    },
    'service:find': (payload) => {
      const input = parseIpcPayload('service:find', payload);
      ctx.viewManager.find(input.id, input.text, input.forward ?? true);
    },
    'service:stopFind': (payload) =>
      ctx.viewManager.stopFind(parseIpcPayload('service:stopFind', payload).id),

    'view:setBounds': (payload) => {
      const input = parseIpcPayload('view:setBounds', payload);
      ctx.viewManager.setBounds(input.entries, input.visibleIds);
    },
    'view:focus': (payload) =>
      ctx.viewManager.focus(parseIpcPayload('view:focus', payload).instanceId),

    'tab:list': (payload) => {
      const { instanceId } = parseIpcPayload('tab:list', payload);
      const instance = getServiceInstance(ctx.db, instanceId);
      if (!instance) return [];
      const resolved = ctx.recipeLoader.resolveForInstance(instance);
      if (resolved.startUrl && !resolved.isLauncherOnly) {
        ensureDefaultTab(ctx.db, instanceId, instance.last_url ?? resolved.startUrl);
      }
      return listTabs(ctx.db, instanceId);
    },
    'tab:create': (payload) => {
      const input = parseIpcPayload('tab:create', payload);
      const instance = getServiceInstance(ctx.db, input.instanceId);
      if (!instance) throw new Error('Service not found');
      const resolved = ctx.recipeLoader.resolveForInstance(instance);
      const url = input.url ?? resolved.startUrl ?? instance.last_url ?? 'about:blank';
      const tab = createTab(ctx.db, input.instanceId, url);
      ctx.sendDataChanged();
      return tab;
    },
    'tab:close': (payload) => {
      closeTab(ctx.db, parseIpcPayload('tab:close', payload).id);
      ctx.sendDataChanged();
    },
    'tab:setActive': (payload) => {
      const input = parseIpcPayload('tab:setActive', payload);
      setActiveTab(ctx.db, input.instanceId, input.id);
    }
  };
}
