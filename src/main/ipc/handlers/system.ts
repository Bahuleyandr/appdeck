import type { IpcChannel } from '../../../shared/ipc-contract.js';
import { parseIpcPayload } from '../../../shared/ipc-contract.js';
import { deleteAiPrompt, getAiPrompt, listAiPrompts, upsertAiPrompt } from '../../db/repositories/aiPrompts.js';
import { listAiRuns } from '../../db/repositories/aiRuns.js';
import { addExtension, listExtensions, removeExtension, setExtensionEnabled } from '../../db/repositories/extensions.js';
import { clearNotifications, inboxLastSeenAt, insertNotification, listNotifications, markAllNotificationsRead, markInboxSeen, markNotificationRead, searchNotifications, snoozeNotification, unreadNotificationCount } from '../../db/repositories/notifications.js';
import { getServiceInstance } from '../../db/repositories/serviceInstances.js';
import { getAllSettings, setSetting } from '../../db/repositories/settings.js';
import { createTask, deleteTask, listTasks, updateTask } from '../../db/repositories/tasks.js';
import { importFerdium } from '../../services/ferdiumImport.js';
import { collectMetrics } from '../../services/metrics.js';
import { app } from 'electron';
import { queryPalette } from '../palette.js';
import type { Handler, IpcContext } from '../types.js';

export function systemHandlers(ctx: IpcContext): Partial<Record<IpcChannel, Handler>> {
  return {
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
    'sync:now': async () => {
      const result = await ctx.fileSyncService.syncNow();
      if (result.applied > 0) {
        ctx.sendDataChanged();
      }
      return result;
    },

    'task:list': () => listTasks(ctx.db),
    'task:create': (payload) => createTask(ctx.db, parseIpcPayload('task:create', payload).title),
    'task:update': (payload) => {
      const input = parseIpcPayload('task:update', payload);
      return updateTask(ctx.db, input.id, input.patch);
    },
    'task:delete': (payload) => deleteTask(ctx.db, parseIpcPayload('task:delete', payload).id),

    'palette:query': (payload) => {
      const input = parseIpcPayload('palette:query', payload);
      return queryPalette(ctx, input.q);
    },

    'notify:incoming': (payload) => {
      const input = parseIpcPayload('notify:incoming', payload);
      const { record, deduped } = insertNotification(ctx.db, input);
      if (deduped) {
        // A repeat within the dedup window: the user already saw the toast/badge/automation.
        return;
      }
      ctx.notificationService.show(input);
      ctx.automationRuntime.handleNotification(input);
      ctx.sendPush('event:notification', { record, unread: unreadNotificationCount(ctx.db) });
      ctx.quickView?.notifyStateChanged();
    },
    'unread:report': (payload) => {
      const input = parseIpcPayload('unread:report', payload);
      // Muted services stay out of the OS badge count; the in-app UI still gets the event.
      if (getServiceInstance(ctx.db, input.instanceId)?.muted) {
        ctx.badgeService.clear(input.instanceId);
      } else {
        ctx.badgeService.setCount(input.instanceId, input.count);
      }
      ctx.automationRuntime.handleUnread(input);
      ctx.sendPush('event:unread', input);
      ctx.quickView?.notifyStateChanged();
    },

    'notification:list': (payload) => {
      const input = parseIpcPayload('notification:list', payload);
      return listNotifications(ctx.db, input?.limit, input?.unreadOnly, input?.beforeId);
    },
    'notification:markSeen': () => {
      markInboxSeen(ctx.db);
    },
    'notification:lastSeen': () => ({ at: inboxLastSeenAt(ctx.db) }),
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
    'ai:draftReply': (payload) => {
      const input = parseIpcPayload('ai:draftReply', payload);
      return ctx.aiService.draftReply(input.notificationId, input.instruction);
    },
    'ai:suggestMutes': () => ctx.aiService.suggestMutes(),
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
    'aiRun:list': (payload) => {
      const input = parseIpcPayload('aiRun:list', payload);
      return listAiRuns(ctx.db, input?.limit);
    },

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

    'metrics:get': () => collectMetrics(ctx.db, ctx.viewManager),

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
    'account:logout': async () => {
      await ctx.cloudSyncService.logout();
      ctx.sendDataChanged();
    },
    'account:syncNow': async () => {
      const result = await ctx.cloudSyncService.syncNow();
      if (result.applied > 0) {
        ctx.sendDataChanged();
      }
      return result;
    }
  };
}
