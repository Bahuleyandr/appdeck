import type { IpcChannel } from '../../../shared/ipc-contract.js';
import { parseIpcPayload } from '../../../shared/ipc-contract.js';
import { deleteAutomation, getAutomation, listAutomations, testAutomation, upsertAutomation } from '../../db/repositories/automations.js';
import { deleteFocusMode, focusModeStatus, listFocusModes, setManualFocusMode, upsertFocusMode } from '../../db/repositories/focusModes.js';
import { getLayout, setLayout } from '../../db/repositories/layouts.js';
import { deletePeerSyncPeer, getPeerSyncPeer, listPeerSyncPeers, upsertPeerSyncPeer } from '../../db/repositories/peerSync.js';
import { deleteFirewallRule, listFirewallRules, testFirewallRules, upsertFirewallRule } from '../../db/repositories/privacyFirewall.js';
import { listWorkKits } from '../../db/repositories/workKits.js';
import { createWorkspaceSnapshot, deleteWorkspaceSnapshot, listWorkspaceSnapshots, restoreWorkspaceSnapshot } from '../../db/repositories/workspaceSnapshots.js';
import { previewBrowserImport, runBrowserImport } from '../../services/browserImport.js';
import { applyLocalExtensionTemplate, listLocalExtensionTemplates } from '../../services/extensionPack.js';
import { collectPerformanceStatus } from '../../services/metrics.js';
import { buildPersonalAnalytics } from '../../services/personalAnalytics.js';
import { portableModeStatus } from '../../services/portableMode.js';
import { analyzeRecipeDraftLive, createRecipeFromStudio } from '../../services/recipeStudio.js';
import { buildRepairStatus, runRepair } from '../../services/repair.js';
import { buildTrustStatus } from '../../services/trustStatus.js';
import { applyWorkKit } from '../../services/workKitApply.js';
import { app } from 'electron';
import type { Handler, IpcContext } from '../types.js';

export function featureHandlers(ctx: IpcContext): Partial<Record<IpcChannel, Handler>> {
  return {
    'trust:status': () => buildTrustStatus(ctx.db, ctx.trackerBlocker.stats()),
    // Explicit user action from the Trust panel; the updated snapshot lands in userData
    // and is preferred over the bundled one on future launches.
    'trust:updateBlocklist': () => ctx.trackerBlocker.updateFromLists(app.getPath('userData')),
    'performance:status': () => collectPerformanceStatus(ctx.db, ctx.viewManager),

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
    'focusMode:activate': (payload) => {
      const input = parseIpcPayload('focusMode:activate', payload);
      setManualFocusMode(ctx.db, input.id);
      ctx.sendDataChanged();
      return focusModeStatus(ctx.db);
    },

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
      analyzeRecipeDraftLive(parseIpcPayload('recipeStudio:analyze', payload)),
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

    'repair:status': () => buildRepairStatus(ctx.db, ctx.recipeLoader),
    'repair:run': () => {
      const result = runRepair(ctx.db, ctx.deviceId, ctx.recipeLoader);
      ctx.sendDataChanged();
      return result;
    },

    'portable:status': () => portableModeStatus(),

    'peerSync:status': () => ({
      deviceId: ctx.deviceId,
      peers: listPeerSyncPeers(ctx.db),
      localEndpoint: ctx.peerSyncRuntime.localEndpoint(),
      discoveryHint:
        'Use the local endpoint from the other device. Keep the #secret fragment private; it encrypts the peer vault payload.'
    }),
    'peerSync:upsert': (payload) => {
      const peer = upsertPeerSyncPeer(ctx.db, parseIpcPayload('peerSync:upsert', payload));
      ctx.sendDataChanged();
      return peer;
    },
    'peerSync:sync': async (payload) => {
      const input = parseIpcPayload('peerSync:sync', payload);
      const peer = getPeerSyncPeer(ctx.db, input.id);
      if (!peer) throw new Error('Peer not found');
      const result = await ctx.peerSyncRuntime.sync(peer);
      ctx.sendDataChanged();
      return result;
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
    }
  };
}
