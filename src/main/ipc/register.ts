import { ipcMain, session } from 'electron';
import type Database from 'better-sqlite3';
import { parseIpcPayload, type IpcChannel } from '../../shared/ipc-contract.js';
import type { PaletteItem } from '../../shared/types.js';
import { createCustomRecipe, tombstoneCustomRecipe, updateCustomRecipe } from '../db/repositories/customRecipes.js';
import { getLayout, setLayout } from '../db/repositories/layouts.js';
import { createProfile, listProfiles, tombstoneProfile, updateProfile } from '../db/repositories/profiles.js';
import {
  createServiceInstance,
  getServiceInstance,
  listServiceInstances,
  tombstoneServiceInstance,
  updateServiceInstance
} from '../db/repositories/serviceInstances.js';
import { closeTab, createTab, deleteTabsForInstance, ensureDefaultTab, listTabs, setActiveTab } from '../db/repositories/serviceTabs.js';
import { createTask, deleteTask, listTasks, reorderTasks, updateTask } from '../db/repositories/tasks.js';
import { reorderWorkspaceServices } from '../db/repositories/workspaceServices.js';
import { createWorkspace, listWorkspaces, reorderWorkspaces, tombstoneWorkspace, updateWorkspace } from '../db/repositories/workspaces.js';
import {
  clearNotifications,
  insertNotification,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  searchNotifications,
  snoozeNotification,
  unreadNotificationCount
} from '../db/repositories/notifications.js';
import { addExtension, listExtensions, removeExtension, setExtensionEnabled } from '../db/repositories/extensions.js';
import { getAllSettings, setSetting } from '../db/repositories/settings.js';
import { AppLockService } from '../services/appLock.js';
import { AiService } from '../services/aiService.js';
import { BadgeService } from '../services/badges.js';
import { collectMetrics } from '../services/metrics.js';
import { importFerdium } from '../services/ferdiumImport.js';
import { LinkRouter } from '../services/linkRouter.js';
import { NotificationService } from '../services/notifications.js';
import { TrackerBlocker } from '../services/trackerBlock.js';
import { UpdaterService } from '../services/updater.js';
import { RecipeLoader } from '../recipes/loader.js';
import { FileSyncService } from '../sync/fileSync.js';
import { ServiceViewManager } from '../views/serviceViewManager.js';

export interface IpcContext {
  db: Database.Database;
  deviceId: string;
  recipeLoader: RecipeLoader;
  viewManager: ServiceViewManager;
  notificationService: NotificationService;
  badgeService: BadgeService;
  lockService: AppLockService;
  fileSyncService: FileSyncService;
  aiService: AiService;
  linkRouter: LinkRouter;
  trackerBlocker: TrackerBlocker;
  updaterService: UpdaterService;
  sendPush: (channel: string, payload?: unknown) => void;
  sendDataChanged: () => void;
  onSettingsChanged: () => void;
}

type Handler = (payload: unknown) => Promise<unknown> | unknown;

export function registerIpcHandlers(ctx: IpcContext): void {
  const handlers: Partial<Record<IpcChannel, Handler>> = {
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
    },

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
      ctx.sendDataChanged();
      return service;
    },
    'service:delete': async (payload) => {
      const input = parseIpcPayload('service:delete', payload);
      const service = listServiceInstances(ctx.db, undefined, true).find((candidate) => candidate.id === input.id);
      ctx.viewManager.sleep(input.id);
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
    'service:reload': (payload) => ctx.viewManager.reload(parseIpcPayload('service:reload', payload).id),
    'service:navigateBack': (payload) => ctx.viewManager.navigateBack(parseIpcPayload('service:navigateBack', payload).id),
    'service:navigateForward': (payload) => ctx.viewManager.navigateForward(parseIpcPayload('service:navigateForward', payload).id),
    'service:navigate': (payload) => {
      const input = parseIpcPayload('service:navigate', payload);
      ctx.viewManager.navigate(input.id, input.url);
    },
    'service:sleep': (payload) => ctx.viewManager.sleep(parseIpcPayload('service:sleep', payload).id),
    'service:wake': (payload) => ctx.viewManager.wake(parseIpcPayload('service:wake', payload).id),

    'view:setBounds': (payload) => {
      const input = parseIpcPayload('view:setBounds', payload);
      ctx.viewManager.setBounds(input.entries, input.visibleIds);
    },
    'view:focus': (payload) => ctx.viewManager.focus(parseIpcPayload('view:focus', payload).instanceId),

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
    },

    'recipe:catalog': () => ctx.recipeLoader.catalog(),
    'recipe:createCustom': (payload) => {
      const input = parseIpcPayload('recipe:createCustom', payload);
      const recipe = createCustomRecipe(ctx.db, ctx.deviceId, input);
      ctx.sendDataChanged();
      return recipe;
    },
    'recipe:updateCustom': (payload) => {
      const input = parseIpcPayload('recipe:updateCustom', payload);
      const recipe = updateCustomRecipe(ctx.db, ctx.deviceId, input.id, input.patch);
      ctx.sendDataChanged();
      return recipe;
    },
    'recipe:deleteCustom': (payload) => {
      const input = parseIpcPayload('recipe:deleteCustom', payload);
      tombstoneCustomRecipe(ctx.db, ctx.deviceId, input.id);
      ctx.sendDataChanged();
    },
    'recipe:resolveForInstance': (payload) => ctx.recipeLoader.resolveForInstance(parseIpcPayload('recipe:resolveForInstance', payload).instanceId),

    'layout:get': (payload) => {
      const input = parseIpcPayload('layout:get', payload);
      return getLayout(ctx.db, ctx.deviceId, input.workspaceId);
    },
    'layout:set': (payload) => {
      const input = parseIpcPayload('layout:set', payload);
      setLayout(ctx.db, ctx.deviceId, input.workspaceId, input.mode, input.selectedServiceIds, input.tileSizing);
      ctx.sendDataChanged();
    },

    'lock:status': () => ctx.lockService.status(),
    'lock:setup': async (payload) => {
      const input = parseIpcPayload('lock:setup', payload);
      await ctx.lockService.setup(input.passphrase);
      ctx.sendDataChanged();
    },
    'lock:unlock': (payload) => ctx.lockService.unlock(parseIpcPayload('lock:unlock', payload).passphrase),
    'lock:lock': () => ctx.lockService.lock(),

    'sync:status': () => ctx.fileSyncService.status(),
    'sync:configure': (payload) => {
      const input = parseIpcPayload('sync:configure', payload);
      return ctx.fileSyncService.configure(input.folderPath, input.passphrase);
    },
    'sync:join': (payload) => {
      const input = parseIpcPayload('sync:join', payload);
      return ctx.fileSyncService.join(input.folderPath, input.recoveryPhrase, input.passphrase);
    },
    'sync:exportVault': (payload) => {
      const input = parseIpcPayload('sync:exportVault', payload);
      return ctx.fileSyncService.exportVault(input.targetPath, input.passphrase);
    },
    'sync:importVault': (payload) => {
      const input = parseIpcPayload('sync:importVault', payload);
      return ctx.fileSyncService.importVault(input.sourcePath, input.passphrase);
    },
    'sync:now': () => ctx.fileSyncService.syncNow(),

    'task:list': () => listTasks(ctx.db),
    'task:create': (payload) => createTask(ctx.db, parseIpcPayload('task:create', payload).title),
    'task:update': (payload) => {
      const input = parseIpcPayload('task:update', payload);
      return updateTask(ctx.db, input.id, input.patch);
    },
    'task:delete': (payload) => deleteTask(ctx.db, parseIpcPayload('task:delete', payload).id),
    'task:reorder': (payload) => reorderTasks(ctx.db, parseIpcPayload('task:reorder', payload).orderedIds),

    'palette:query': (payload) => {
      const input = parseIpcPayload('palette:query', payload);
      return queryPalette(ctx, input.q);
    },

    'notify:incoming': (payload) => {
      const input = parseIpcPayload('notify:incoming', payload);
      const record = insertNotification(ctx.db, input);
      ctx.notificationService.show(input);
      ctx.sendPush('event:notification', { record, unread: unreadNotificationCount(ctx.db) });
    },
    'unread:report': (payload) => {
      const input = parseIpcPayload('unread:report', payload);
      ctx.badgeService.setCount(input.instanceId, input.count);
      ctx.sendPush('event:unread', input);
    },

    'notification:list': (payload) => {
      const input = parseIpcPayload('notification:list', payload);
      return listNotifications(ctx.db, input?.limit, input?.unreadOnly);
    },
    'notification:search': (payload) => searchNotifications(ctx.db, parseIpcPayload('notification:search', payload).q),
    'notification:markRead': (payload) => {
      markNotificationRead(ctx.db, parseIpcPayload('notification:markRead', payload).id);
      ctx.sendPush('event:notification', { unread: unreadNotificationCount(ctx.db) });
    },
    'notification:markAllRead': () => {
      markAllNotificationsRead(ctx.db);
      ctx.sendPush('event:notification', { unread: 0 });
    },
    'notification:snooze': (payload) => {
      const input = parseIpcPayload('notification:snooze', payload);
      snoozeNotification(ctx.db, input.id, input.until);
    },
    'notification:clear': () => {
      clearNotifications(ctx.db);
      ctx.sendPush('event:notification', { unread: 0 });
    },
    'notification:unreadCount': () => unreadNotificationCount(ctx.db),

    'ai:status': () => ctx.aiService.status(),
    'ai:configure': (payload) => {
      ctx.aiService.configure(parseIpcPayload('ai:configure', payload).apiKey);
      ctx.sendDataChanged();
    },
    'ai:clearKey': () => {
      ctx.aiService.clearKey();
      ctx.sendDataChanged();
    },
    'ai:brief': () => ctx.aiService.brief(),
    'ai:triage': () => ctx.aiService.triage(),

    'extension:list': () => listExtensions(ctx.db),
    'extension:add': (payload) => {
      const extension = addExtension(ctx.db, parseIpcPayload('extension:add', payload).path);
      ctx.sendDataChanged();
      return extension;
    },
    'extension:remove': (payload) => {
      removeExtension(ctx.db, parseIpcPayload('extension:remove', payload).id);
      ctx.sendDataChanged();
    },
    'extension:setEnabled': (payload) => {
      const input = parseIpcPayload('extension:setEnabled', payload);
      setExtensionEnabled(ctx.db, input.id, input.enabled);
      ctx.sendDataChanged();
    },

    'import:ferdium': (payload) => {
      const input = parseIpcPayload('import:ferdium', payload);
      const result = importFerdium(ctx.db, ctx.deviceId, ctx.recipeLoader, input.data, input.workspaceId);
      ctx.sendDataChanged();
      return result;
    },

    'metrics:get': () => collectMetrics(),

    'settings:get': () => getAllSettings(ctx.db),
    'settings:set': (payload) => {
      const input = parseIpcPayload('settings:set', payload);
      setSetting(ctx.db, input.key, input.value);
      if (input.key === 'tracker_block') {
        ctx.trackerBlocker.setEnabled(input.value === 'true');
      }
      ctx.onSettingsChanged();
      ctx.sendPush('event:settings-changed', getAllSettings(ctx.db));
    },

    'update:status': () => ctx.updaterService.status(),
    'update:check': () => ctx.updaterService.check(),
    'update:install': () => ctx.updaterService.install()
  };

  for (const [channel, handler] of Object.entries(handlers) as Array<[IpcChannel, Handler]>) {
    ipcMain.handle(channel, async (_event, payload) => handler(payload));
  }
}

function queryPalette(ctx: IpcContext, query: string): PaletteItem[] {
  const q = query.trim().toLowerCase();
  const allServices = listServiceInstances(ctx.db);
  const serviceName = (instanceId: string): string => allServices.find((service) => service.id === instanceId)?.display_name ?? 'Service';
  const services = allServices
    .filter((service) => service.display_name.toLowerCase().includes(q))
    .slice(0, 6)
    .map<PaletteItem>((service) => ({ type: 'service', id: service.id, label: service.display_name, action: 'select-service' }));
  const workspaces = listWorkspaces(ctx.db)
    .filter((workspace) => workspace.name.toLowerCase().includes(q))
    .slice(0, 6)
    .map<PaletteItem>((workspace) => ({ type: 'workspace', id: workspace.id, label: workspace.name, action: 'select-workspace' }));
  const commandItems: PaletteItem[] = [
    { type: 'command', id: 'lock', label: 'Lock AppDeck', action: 'lock' },
    { type: 'command', id: 'reload', label: 'Reload selected service', action: 'reload' }
  ];
  const commands = commandItems.filter((command) => command.label.toLowerCase().includes(q));
  // Cross-service message search — the headline ⌘K feature.
  const notifications = q
    ? searchNotifications(ctx.db, query.trim(), 8).map<PaletteItem>((notification) => ({
        type: 'notification',
        id: String(notification.id),
        label: notification.title || notification.body || 'Notification',
        sublabel: serviceName(notification.instance_id),
        action: 'open-notification',
        instanceId: notification.instance_id
      }))
    : [];
  return [...notifications, ...services, ...workspaces, ...commands].slice(0, 20);
}
