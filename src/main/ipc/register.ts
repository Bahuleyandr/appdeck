import { app, ipcMain, session, shell } from 'electron';
import type Database from 'better-sqlite3';
import { parseIpcPayload, type IpcChannel } from '../../shared/ipc-contract.js';
import type { PaletteItem } from '../../shared/types.js';
import {
  createCustomRecipe,
  tombstoneCustomRecipe,
  updateCustomRecipe
} from '../db/repositories/customRecipes.js';
import { getLayout, setLayout } from '../db/repositories/layouts.js';
import {
  createProfile,
  listProfiles,
  tombstoneProfile,
  updateProfile
} from '../db/repositories/profiles.js';
import {
  createServiceInstance,
  getServiceInstance,
  listServiceInstances,
  tombstoneServiceInstance,
  updateServiceInstance
} from '../db/repositories/serviceInstances.js';
import {
  closeTab,
  createTab,
  deleteTabsForInstance,
  ensureDefaultTab,
  listTabs,
  setActiveTab
} from '../db/repositories/serviceTabs.js';
import {
  createTask,
  deleteTask,
  listTasks,
  reorderTasks,
  updateTask
} from '../db/repositories/tasks.js';
import { reorderWorkspaceServices } from '../db/repositories/workspaceServices.js';
import {
  createWorkspace,
  listWorkspaces,
  reorderWorkspaces,
  tombstoneWorkspace,
  updateWorkspace
} from '../db/repositories/workspaces.js';
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
import {
  addExtension,
  listExtensions,
  removeExtension,
  setExtensionEnabled
} from '../db/repositories/extensions.js';
import {
  importRecipeRegistryPack,
  listRecipeRegistryEntries,
  recipeRegistryStats,
  validateRecipeRegistryPack
} from '../db/repositories/recipeRegistry.js';
import {
  deleteLinkRule,
  listLinkRules,
  testLinkRules,
  upsertLinkRule
} from '../db/repositories/linkRules.js';
import { deleteDashboard, listDashboards, upsertDashboard } from '../db/repositories/dashboards.js';
import { deleteShortcut, listShortcuts, upsertShortcut } from '../db/repositories/shortcuts.js';
import {
  deletePermissionPolicy,
  listPermissionPolicies,
  upsertPermissionPolicy
} from '../db/repositories/permissionPolicies.js';
import { clearDownloads, listDownloads } from '../db/repositories/downloads.js';
import {
  deleteAiPrompt,
  getAiPrompt,
  listAiPrompts,
  upsertAiPrompt
} from '../db/repositories/aiPrompts.js';
import {
  deleteAutomation,
  getAutomation,
  listAutomations,
  testAutomation,
  upsertAutomation
} from '../db/repositories/automations.js';
import { createSavedTabSession } from '../db/repositories/savedSessions.js';
import {
  deleteFocusMode,
  focusModeStatus,
  listFocusModes,
  upsertFocusMode
} from '../db/repositories/focusModes.js';
import {
  deleteFirewallRule,
  listFirewallRules,
  testFirewallRules,
  upsertFirewallRule
} from '../db/repositories/privacyFirewall.js';
import {
  createWorkspaceSnapshot,
  deleteWorkspaceSnapshot,
  listWorkspaceSnapshots,
  restoreWorkspaceSnapshot
} from '../db/repositories/workspaceSnapshots.js';
import {
  deletePeerSyncPeer,
  listPeerSyncPeers,
  upsertPeerSyncPeer
} from '../db/repositories/peerSync.js';
import { listWorkKits } from '../db/repositories/workKits.js';
import { getAllSettings, setSetting } from '../db/repositories/settings.js';
import { AppLockService } from '../services/appLock.js';
import { AiService } from '../services/aiService.js';
import { BadgeService } from '../services/badges.js';
import { previewBrowserImport, runBrowserImport } from '../services/browserImport.js';
import { collectMetrics, collectPerformanceStatus } from '../services/metrics.js';
import { importFerdium } from '../services/ferdiumImport.js';
import { buildDashboardSnapshot } from '../services/dashboardSnapshot.js';
import {
  applyLocalExtensionTemplate,
  listLocalExtensionTemplates
} from '../services/extensionPack.js';
import { LinkRouter } from '../services/linkRouter.js';
import { previewMigration, runMigration } from '../services/migrationWizard.js';
import { NotificationService } from '../services/notifications.js';
import { buildPersonalAnalytics } from '../services/personalAnalytics.js';
import { configurePortableMode, portableModeStatus } from '../services/portableMode.js';
import { analyzeRecipeDraft, createRecipeFromStudio } from '../services/recipeStudio.js';
import { TrackerBlocker } from '../services/trackerBlock.js';
import { buildTrustStatus } from '../services/trustStatus.js';
import { UpdaterService } from '../services/updater.js';
import { applyWorkKit } from '../services/workKitApply.js';
import { RecipeLoader } from '../recipes/loader.js';
import { CloudSyncService } from '../sync/cloudSync.js';
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
  cloudSyncService: CloudSyncService;
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
      const service = listServiceInstances(ctx.db, undefined, true).find(
        (candidate) => candidate.id === input.id
      );
      ctx.viewManager.sleep(input.id);
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
    'service:navigate': (payload) => {
      const input = parseIpcPayload('service:navigate', payload);
      ctx.viewManager.navigate(input.id, input.url);
    },
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
    'recipe:resolveForInstance': (payload) =>
      ctx.recipeLoader.resolveForInstance(
        parseIpcPayload('recipe:resolveForInstance', payload).instanceId
      ),
    'registry:search': (payload) => {
      const input = parseIpcPayload('registry:search', payload);
      return listRecipeRegistryEntries(ctx.db, input?.q, input?.limit);
    },
    'registry:validate': (payload) => {
      const input = parseIpcPayload('registry:validate', payload);
      return validateRecipeRegistryPack(input.data);
    },
    'registry:import': (payload) => {
      const input = parseIpcPayload('registry:import', payload);
      const result = importRecipeRegistryPack(ctx.db, input.data);
      ctx.sendDataChanged();
      return result;
    },
    'registry:stats': () => recipeRegistryStats(ctx.db),

    'linkRule:list': () => listLinkRules(ctx.db),
    'linkRule:upsert': (payload) => {
      const input = parseIpcPayload('linkRule:upsert', payload);
      return upsertLinkRule(ctx.db, input);
    },
    'linkRule:delete': (payload) =>
      deleteLinkRule(ctx.db, parseIpcPayload('linkRule:delete', payload).id),
    'linkRule:test': (payload) =>
      testLinkRules(ctx.db, parseIpcPayload('linkRule:test', payload).url),

    'dashboard:list': (payload) => {
      const input = parseIpcPayload('dashboard:list', payload);
      return listDashboards(ctx.db, input?.workspaceId);
    },
    'dashboard:upsert': (payload) => {
      const input = parseIpcPayload('dashboard:upsert', payload);
      return upsertDashboard(ctx.db, { ...input, widgets: input.widgets as never });
    },
    'dashboard:delete': (payload) =>
      deleteDashboard(ctx.db, parseIpcPayload('dashboard:delete', payload).id),
    'dashboard:snapshot': (payload) => {
      const input = parseIpcPayload('dashboard:snapshot', payload);
      return buildDashboardSnapshot(ctx.db, input?.workspaceId);
    },
    'dashboard:saveSession': (payload) => {
      const input = parseIpcPayload('dashboard:saveSession', payload);
      return createSavedTabSession(ctx.db, {
        workspaceId: input.workspaceId,
        name: input.name,
        serviceIds: input.serviceIds
      });
    },

    'shortcut:list': () => listShortcuts(ctx.db),
    'shortcut:upsert': (payload) =>
      upsertShortcut(ctx.db, parseIpcPayload('shortcut:upsert', payload)),
    'shortcut:delete': (payload) =>
      deleteShortcut(ctx.db, parseIpcPayload('shortcut:delete', payload).id),

    'permission:list': () => listPermissionPolicies(ctx.db),
    'permission:upsert': (payload) =>
      upsertPermissionPolicy(ctx.db, parseIpcPayload('permission:upsert', payload)),
    'permission:delete': (payload) =>
      deletePermissionPolicy(ctx.db, parseIpcPayload('permission:delete', payload).id),

    'download:list': (payload) =>
      listDownloads(ctx.db, parseIpcPayload('download:list', payload)?.limit),
    'download:open': async (payload) => {
      const { id } = parseIpcPayload('download:open', payload);
      const download = listDownloads(ctx.db, 500).find((candidate) => candidate.id === id);
      if (download?.path) {
        await shell.openPath(download.path);
      }
    },
    'download:clear': () => clearDownloads(ctx.db),

    'migration:preview': (payload) => {
      const input = parseIpcPayload('migration:preview', payload);
      return previewMigration(input.data, ctx.recipeLoader);
    },
    'migration:run': (payload) => {
      const input = parseIpcPayload('migration:run', payload);
      const result = runMigration(
        ctx.db,
        ctx.deviceId,
        ctx.recipeLoader,
        input.data,
        input.workspaceId
      );
      ctx.sendDataChanged();
      return result;
    },

    'trust:status': () => buildTrustStatus(ctx.db, ctx.trackerBlocker.stats()),
    'performance:status': () => collectPerformanceStatus(ctx.db),

    'automation:list': () => listAutomations(ctx.db),
    'automation:upsert': (payload) => {
      const input = parseIpcPayload('automation:upsert', payload);
      const automation = upsertAutomation(ctx.db, input);
      ctx.sendDataChanged();
      return automation;
    },
    'automation:delete': (payload) => {
      deleteAutomation(ctx.db, parseIpcPayload('automation:delete', payload).id);
      ctx.sendDataChanged();
    },
    'automation:test': (payload) => {
      const input = parseIpcPayload('automation:test', payload);
      const automation = input.id ? getAutomation(ctx.db, input.id) : null;
      if (automation) {
        return testAutomation(automation, input.sample ?? {});
      }
      if (!input.trigger) {
        throw new Error('Automation or trigger sample is required');
      }
      return testAutomation({ trigger: input.trigger, actions: [] }, input.sample ?? {});
    },

    'focusMode:list': () => listFocusModes(ctx.db),
    'focusMode:upsert': (payload) => {
      const focusMode = upsertFocusMode(ctx.db, parseIpcPayload('focusMode:upsert', payload));
      ctx.sendDataChanged();
      return focusMode;
    },
    'focusMode:delete': (payload) => {
      deleteFocusMode(ctx.db, parseIpcPayload('focusMode:delete', payload).id);
      ctx.sendDataChanged();
    },
    'focusMode:status': () => focusModeStatus(ctx.db),

    'browserImport:preview': (payload) => {
      const input = parseIpcPayload('browserImport:preview', payload);
      return previewBrowserImport(input.data, ctx.recipeLoader);
    },
    'browserImport:run': (payload) => {
      const input = parseIpcPayload('browserImport:run', payload);
      const result = runBrowserImport(
        ctx.db,
        ctx.deviceId,
        ctx.recipeLoader,
        input.data,
        input.workspaceId
      );
      ctx.sendDataChanged();
      return result;
    },

    'recipeStudio:analyze': (payload) =>
      analyzeRecipeDraft(parseIpcPayload('recipeStudio:analyze', payload)),
    'recipeStudio:create': (payload) => {
      const recipe = createRecipeFromStudio(
        ctx.db,
        parseIpcPayload('recipeStudio:create', payload)
      );
      ctx.sendDataChanged();
      return recipe;
    },

    'extensionPack:list': () => listLocalExtensionTemplates(),
    'extensionPack:apply': (payload) => {
      const template = applyLocalExtensionTemplate(
        ctx.db,
        parseIpcPayload('extensionPack:apply', payload).id
      );
      ctx.sendDataChanged();
      return template;
    },

    'firewall:list': () => listFirewallRules(ctx.db),
    'firewall:upsert': (payload) => {
      const rule = upsertFirewallRule(ctx.db, parseIpcPayload('firewall:upsert', payload));
      ctx.sendDataChanged();
      return rule;
    },
    'firewall:delete': (payload) => {
      deleteFirewallRule(ctx.db, parseIpcPayload('firewall:delete', payload).id);
      ctx.sendDataChanged();
    },
    'firewall:test': (payload) => {
      const input = parseIpcPayload('firewall:test', payload);
      return testFirewallRules(ctx.db, input.url, input.serviceInstanceId);
    },

    'snapshot:list': (payload) => {
      const input = parseIpcPayload('snapshot:list', payload);
      return listWorkspaceSnapshots(ctx.db, input?.workspaceId);
    },
    'snapshot:create': (payload) => {
      const input = parseIpcPayload('snapshot:create', payload);
      const snapshot = createWorkspaceSnapshot(ctx.db, ctx.deviceId, input.workspaceId, input.name);
      ctx.sendDataChanged();
      return snapshot;
    },
    'snapshot:restore': (payload) => {
      const snapshot = restoreWorkspaceSnapshot(
        ctx.db,
        ctx.deviceId,
        parseIpcPayload('snapshot:restore', payload).id
      );
      ctx.sendDataChanged();
      return snapshot;
    },
    'snapshot:delete': (payload) => {
      deleteWorkspaceSnapshot(ctx.db, parseIpcPayload('snapshot:delete', payload).id);
      ctx.sendDataChanged();
    },

    'analytics:personal': () => buildPersonalAnalytics(ctx.db, ctx.trackerBlocker.stats()),

    'portable:status': () => portableModeStatus(ctx.db),
    'portable:configure': (payload) => {
      const input = parseIpcPayload('portable:configure', payload);
      const status = configurePortableMode(ctx.db, input.enabled, input.rootPath);
      ctx.sendDataChanged();
      return status;
    },

    'peerSync:status': () => ({
      deviceId: ctx.deviceId,
      peers: listPeerSyncPeers(ctx.db),
      discoveryHint:
        'Use a Tailscale/LAN URL, shared folder, or future AppDeck peer endpoint. Secrets never leave this device through peer metadata.'
    }),
    'peerSync:upsert': (payload) => {
      const peer = upsertPeerSyncPeer(ctx.db, parseIpcPayload('peerSync:upsert', payload));
      ctx.sendDataChanged();
      return peer;
    },
    'peerSync:delete': (payload) => {
      deletePeerSyncPeer(ctx.db, parseIpcPayload('peerSync:delete', payload).id);
      ctx.sendDataChanged();
    },

    'workKit:list': () => listWorkKits(ctx.db),
    'workKit:apply': (payload) => {
      const result = applyWorkKit(
        ctx.db,
        ctx.deviceId,
        parseIpcPayload('workKit:apply', payload).id
      );
      ctx.sendDataChanged();
      return result;
    },

    'layout:get': (payload) => {
      const input = parseIpcPayload('layout:get', payload);
      return getLayout(ctx.db, ctx.deviceId, input.workspaceId);
    },
    'layout:set': (payload) => {
      const input = parseIpcPayload('layout:set', payload);
      setLayout(
        ctx.db,
        ctx.deviceId,
        input.workspaceId,
        input.mode,
        input.selectedServiceIds,
        input.tileSizing
      );
      ctx.sendDataChanged();
    },

    'lock:status': () => ctx.lockService.status(),
    'lock:setup': async (payload) => {
      const input = parseIpcPayload('lock:setup', payload);
      await ctx.lockService.setup(input.passphrase);
      ctx.sendDataChanged();
    },
    'lock:unlock': (payload) =>
      ctx.lockService.unlock(parseIpcPayload('lock:unlock', payload).passphrase),
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
    'task:reorder': (payload) =>
      reorderTasks(ctx.db, parseIpcPayload('task:reorder', payload).orderedIds),

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
    'notification:search': (payload) =>
      searchNotifications(ctx.db, parseIpcPayload('notification:search', payload).q),
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
      ctx.aiService.configure(parseIpcPayload('ai:configure', payload));
      ctx.sendDataChanged();
    },
    'ai:clearKey': () => {
      ctx.aiService.clearKey();
      ctx.sendDataChanged();
    },
    'ai:brief': () => ctx.aiService.brief(),
    'ai:triage': () => ctx.aiService.triage(),
    'aiPrompt:list': () => listAiPrompts(ctx.db),
    'aiPrompt:upsert': (payload) => {
      const input = parseIpcPayload('aiPrompt:upsert', payload);
      return upsertAiPrompt(ctx.db, input);
    },
    'aiPrompt:delete': (payload) =>
      deleteAiPrompt(ctx.db, parseIpcPayload('aiPrompt:delete', payload).id),
    'aiPrompt:run': (payload) => {
      const input = parseIpcPayload('aiPrompt:run', payload);
      const saved = input.id ? getAiPrompt(ctx.db, input.id) : null;
      const prompt = input.prompt ?? saved?.prompt;
      if (!prompt) throw new Error('No prompt provided');
      return ctx.aiService.runPrompt(prompt, input.context);
    },
    'aiPrompt:extractTasks': () => ctx.aiService.extractTasks(),

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
      const result = importFerdium(
        ctx.db,
        ctx.deviceId,
        ctx.recipeLoader,
        input.data,
        input.workspaceId
      );
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
      if (input.key === 'launch_at_login') {
        app.setLoginItemSettings({ openAtLogin: input.value === 'true' });
      }
      ctx.onSettingsChanged();
      ctx.sendPush('event:settings-changed', getAllSettings(ctx.db));
    },

    'update:status': () => ctx.updaterService.status(),
    'update:check': () => ctx.updaterService.check(),
    'update:install': () => ctx.updaterService.install(),

    'account:status': () => ctx.cloudSyncService.status(),
    'account:signup': async (payload) => {
      const input = parseIpcPayload('account:signup', payload);
      await ctx.cloudSyncService.signup(input.serverUrl, input.email, input.password);
      ctx.sendDataChanged();
    },
    'account:login': async (payload) => {
      const input = parseIpcPayload('account:login', payload);
      await ctx.cloudSyncService.login(input.serverUrl, input.email, input.password);
      ctx.sendDataChanged();
    },
    'account:logout': () => {
      ctx.cloudSyncService.logout();
      ctx.sendDataChanged();
    },
    'account:syncNow': () => ctx.cloudSyncService.syncNow()
  };

  for (const [channel, handler] of Object.entries(handlers) as Array<[IpcChannel, Handler]>) {
    ipcMain.handle(channel, async (_event, payload) => handler(payload));
  }
}

function queryPalette(ctx: IpcContext, query: string): PaletteItem[] {
  const q = query.trim().toLowerCase();
  const allServices = listServiceInstances(ctx.db);
  const serviceName = (instanceId: string): string =>
    allServices.find((service) => service.id === instanceId)?.display_name ?? 'Service';
  const services = allServices
    .filter((service) => service.display_name.toLowerCase().includes(q))
    .slice(0, 6)
    .map<PaletteItem>((service) => ({
      type: 'service',
      id: service.id,
      label: service.display_name,
      action: 'select-service'
    }));
  const workspaces = listWorkspaces(ctx.db)
    .filter((workspace) => workspace.name.toLowerCase().includes(q))
    .slice(0, 6)
    .map<PaletteItem>((workspace) => ({
      type: 'workspace',
      id: workspace.id,
      label: workspace.name,
      action: 'select-workspace'
    }));
  const commandItems: PaletteItem[] = [
    { type: 'command', id: 'lock', label: 'Lock AppDeck', action: 'lock' },
    { type: 'command', id: 'reload', label: 'Reload selected service', action: 'reload' },
    { type: 'command', id: 'dashboard', label: 'Open dashboard home', action: 'open-dashboard' },
    {
      type: 'command',
      id: 'pro-controls',
      label: 'Open Control Center',
      action: 'open-pro-controls'
    },
    { type: 'command', id: 'downloads', label: 'Open downloads', action: 'open-downloads' },
    { type: 'command', id: 'settings', label: 'Open settings', action: 'open-settings' },
    { type: 'command', id: 'add-service', label: 'Add service', action: 'add-service' },
    { type: 'command', id: 'automations', label: 'Open automations', action: 'open-automations' },
    { type: 'command', id: 'focus-modes', label: 'Open focus modes', action: 'open-focus-modes' },
    {
      type: 'command',
      id: 'browser-bookmarks',
      label: 'Open browser bookmarks',
      action: 'open-browser-bookmarks'
    },
    {
      type: 'command',
      id: 'recipe-studio',
      label: 'Open recipe studio',
      action: 'open-recipe-studio'
    },
    {
      type: 'command',
      id: 'privacy-firewall',
      label: 'Open privacy firewall',
      action: 'open-firewall'
    },
    {
      type: 'command',
      id: 'snapshots',
      label: 'Open workspace snapshots',
      action: 'open-snapshots'
    },
    {
      type: 'command',
      id: 'analytics',
      label: 'Open personal analytics',
      action: 'open-analytics'
    },
    { type: 'command', id: 'work-kits', label: 'Open work kits', action: 'open-work-kits' },
    { type: 'command', id: 'peer-sync', label: 'Open peer sync', action: 'open-peer-sync' },
    { type: 'command', id: 'portable', label: 'Open portable mode', action: 'open-portable' }
  ];
  const commands = commandItems.filter((command) => command.label.toLowerCase().includes(q));
  const tasks = listTasks(ctx.db)
    .filter((task) => task.title.toLowerCase().includes(q))
    .slice(0, 5)
    .map<PaletteItem>((task) => ({
      type: 'task',
      id: task.id,
      label: task.title,
      sublabel: task.done ? 'Done' : 'Open',
      action: 'open-tasks'
    }));
  const downloads = listDownloads(ctx.db, 20)
    .filter(
      (download) =>
        download.filename.toLowerCase().includes(q) || download.url.toLowerCase().includes(q)
    )
    .slice(0, 5)
    .map<PaletteItem>((download) => ({
      type: 'download',
      id: download.id,
      label: download.filename,
      sublabel: download.state,
      action: 'open-download'
    }));
  const shortcuts = listShortcuts(ctx.db)
    .filter(
      (shortcut) =>
        shortcut.command.toLowerCase().includes(q) || shortcut.accelerator.toLowerCase().includes(q)
    )
    .slice(0, 5)
    .map<PaletteItem>((shortcut) => ({
      type: 'shortcut',
      id: shortcut.id,
      label: shortcut.command,
      sublabel: shortcut.accelerator,
      action: 'open-pro-controls'
    }));
  const dashboards = listDashboards(ctx.db)
    .filter((dashboard) => dashboard.name.toLowerCase().includes(q))
    .slice(0, 5)
    .map<PaletteItem>((dashboard) => ({
      type: 'dashboard',
      id: dashboard.id,
      label: dashboard.name,
      sublabel: `${dashboard.widgets.length} widgets`,
      action: 'open-dashboard'
    }));
  const rules = listLinkRules(ctx.db)
    .filter((rule) => rule.name.toLowerCase().includes(q) || rule.pattern.toLowerCase().includes(q))
    .slice(0, 5)
    .map<PaletteItem>((rule) => ({
      type: 'linkRule',
      id: rule.id,
      label: rule.name,
      sublabel: rule.pattern,
      action: 'open-pro-controls'
    }));
  const recipes = q
    ? listRecipeRegistryEntries(ctx.db, query.trim(), 5).map<PaletteItem>((recipe) => ({
        type: 'recipe',
        id: recipe.id,
        label: recipe.name,
        sublabel: recipe.category,
        action: 'open-add-service'
      }))
    : [];
  const automations = listAutomations(ctx.db)
    .filter((automation) => automation.name.toLowerCase().includes(q))
    .slice(0, 5)
    .map<PaletteItem>((automation) => ({
      type: 'automation',
      id: automation.id,
      label: automation.name,
      sublabel: automation.enabled ? automation.trigger.type : 'Disabled',
      action: 'open-automations'
    }));
  const focusModes = listFocusModes(ctx.db)
    .filter((mode) => mode.name.toLowerCase().includes(q))
    .slice(0, 5)
    .map<PaletteItem>((mode) => ({
      type: 'focusMode',
      id: mode.id,
      label: mode.name,
      sublabel: mode.enabled ? 'Enabled' : 'Disabled',
      action: 'open-focus-modes'
    }));
  const snapshots = listWorkspaceSnapshots(ctx.db)
    .filter((snapshot) => snapshot.name.toLowerCase().includes(q))
    .slice(0, 5)
    .map<PaletteItem>((snapshot) => ({
      type: 'snapshot',
      id: snapshot.id,
      label: snapshot.name,
      sublabel: 'Workspace snapshot',
      action: 'open-snapshots'
    }));
  const workKits = listWorkKits(ctx.db)
    .filter((kit) => kit.name.toLowerCase().includes(q))
    .slice(0, 5)
    .map<PaletteItem>((kit) => ({
      type: 'workKit',
      id: kit.id,
      label: kit.name,
      sublabel: kit.description,
      action: 'open-work-kits'
    }));
  const firewallRules = listFirewallRules(ctx.db)
    .filter((rule) => rule.pattern.toLowerCase().includes(q) || rule.rule_type.includes(q))
    .slice(0, 5)
    .map<PaletteItem>((rule) => ({
      type: 'firewallRule',
      id: rule.id,
      label: rule.pattern,
      sublabel: `${rule.action} ${rule.rule_type}`,
      action: 'open-firewall'
    }));
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
  return [
    ...notifications,
    ...services,
    ...workspaces,
    ...tasks,
    ...dashboards,
    ...downloads,
    ...shortcuts,
    ...rules,
    ...recipes,
    ...automations,
    ...focusModes,
    ...snapshots,
    ...workKits,
    ...firewallRules,
    ...commands
  ].slice(0, 30);
}
