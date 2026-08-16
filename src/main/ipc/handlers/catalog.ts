import type { IpcChannel } from '../../../shared/ipc-contract.js';
import { parseIpcPayload } from '../../../shared/ipc-contract.js';
import { createCustomRecipe } from '../../db/repositories/customRecipes.js';
import { deleteDashboard, listDashboards, upsertDashboard } from '../../db/repositories/dashboards.js';
import { clearDownloads, listDownloads } from '../../db/repositories/downloads.js';
import { deleteLinkRule, listLinkRules, testLinkRules, upsertLinkRule } from '../../db/repositories/linkRules.js';
import { deletePermissionPolicy, listPermissionPolicies, upsertPermissionPolicy } from '../../db/repositories/permissionPolicies.js';
import { importRecipeRegistryPack, listRecipeRegistryEntries, recipeRegistryStats, validateRecipeRegistryPack } from '../../db/repositories/recipeRegistry.js';
import { createSavedTabSession } from '../../db/repositories/savedSessions.js';
import { deleteShortcut, listShortcuts, upsertShortcut } from '../../db/repositories/shortcuts.js';
import { buildDashboardSnapshot } from '../../services/dashboardSnapshot.js';
import { previewMigration, runMigration } from '../../services/migrationWizard.js';
import { shell } from 'electron';
import type { Handler, IpcContext } from '../types.js';

export function catalogHandlers(ctx: IpcContext): Partial<Record<IpcChannel, Handler>> {
  return {
    'recipe:catalog': () => ctx.recipeLoader.catalog(),
    'recipe:createCustom': (payload) => {
      const input = parseIpcPayload('recipe:createCustom', payload);
      const recipe = createCustomRecipe(ctx.db, ctx.deviceId, input);
      ctx.sendDataChanged();
      return recipe;
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
    }
  };
}
