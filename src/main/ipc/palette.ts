import type { PaletteItem } from '../../shared/types.js';
import { listAutomations } from '../db/repositories/automations.js';
import { listDashboards } from '../db/repositories/dashboards.js';
import { listDownloads } from '../db/repositories/downloads.js';
import { listFocusModes } from '../db/repositories/focusModes.js';
import { listLinkRules } from '../db/repositories/linkRules.js';
import { searchNotifications } from '../db/repositories/notifications.js';
import { listFirewallRules } from '../db/repositories/privacyFirewall.js';
import { listRecipeRegistryEntries } from '../db/repositories/recipeRegistry.js';
import { listServiceInstances } from '../db/repositories/serviceInstances.js';
import { listShortcuts } from '../db/repositories/shortcuts.js';
import { listTasks } from '../db/repositories/tasks.js';
import { listWorkKits } from '../db/repositories/workKits.js';
import { listWorkspaceSnapshots } from '../db/repositories/workspaceSnapshots.js';
import { listWorkspaces } from '../db/repositories/workspaces.js';
import type { IpcContext } from './types.js';

export function queryPalette(ctx: IpcContext, query: string): PaletteItem[] {
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
