import type { JSX } from 'react';
import type {
  LinkRule,
  RecipeCatalogItem,
  RecipeRegistryEntry,
  ServiceCategory,
  ServiceInstance,
  ServiceProxy,
  Workspace
} from '../../../shared/types';
import { useAppStore, type ProControlsPanel } from '../../state/appStore';

export const CATEGORIES: ServiceCategory[] = [
  'Chat',
  'Email',
  'Social',
  'AI',
  'Productivity',
  'Dev',
  'Media',
  'Other'
];
export const DEFAULT_WORKSPACE_COLOR = '#2dd4bf';
export const DEFAULT_PROFILE_COLOR = '#3b82f6';
export const COLORS = [
  DEFAULT_WORKSPACE_COLOR,
  DEFAULT_PROFILE_COLOR,
  '#a855f7',
  '#f59e0b',
  '#ef4444',
  '#22c55e',
  '#64748b'
];

export type Panel = ProControlsPanel;

export function ColorRow({
  value,
  onChange
}: {
  value: string;
  onChange: (value: string) => void;
}): JSX.Element {
  return (
    <div className="flex flex-wrap gap-1.5">
      {COLORS.map((color) => (
        <button
          key={color}
          className={`h-7 w-7 rounded-full border ${value === color ? 'border-white ring-2 ring-accent/60' : 'border-line'}`}
          style={{ backgroundColor: color }}
          title={color}
          onClick={() => onChange(color)}
        />
      ))}
    </div>
  );
}

export function EmptyState({ label }: { label: string }): JSX.Element {
  return (
    <div className="rounded-md border border-dashed border-line p-6 text-center text-sm text-muted">
      {label}
    </div>
  );
}

export function Metric({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="panel rounded-md p-3">
      <div className="text-xs uppercase text-muted">{label}</div>
      <div className="mt-1 truncate text-lg font-semibold">{value}</div>
    </div>
  );
}

/**
 * Tri-state sleep timing: unset (undefined) falls back to the app default, an explicit null means
 * never, and a positive number is a custom threshold. The UI must round-trip all three without
 * collapsing "unset" into "never".
 */
export type SleepTimingChoice = 'default' | 'never' | 'custom';

export function sleepTimingChoice(value: number | null | undefined): SleepTimingChoice {
  if (value === undefined) return 'default';
  if (value === null) return 'never';
  return 'custom';
}

/** Only an explicit "never" produces null; unparsable custom input falls back to unset/default. */
export function sleepMinutesFrom(choice: SleepTimingChoice, minutes: string): number | null | undefined {
  if (choice === 'never') return null;
  if (choice === 'default') return undefined;
  const parsed = Number.parseInt(minutes, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export function numberOrDefault(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function proxyFromFields(
  mode: ServiceProxy['mode'],
  host: string,
  port: string,
  bypassRules: string
): ServiceProxy | null {
  if (mode === 'direct') return { mode: 'direct' };
  const parsedPort = Number.parseInt(port, 10);
  if (!host.trim() || !Number.isFinite(parsedPort)) return null;
  return {
    mode,
    host: host.trim(),
    port: parsedPort,
    bypassRules: bypassRules.trim() || undefined
  };
}

export function registryToCatalog(entry: RecipeRegistryEntry): RecipeCatalogItem {
  return {
    id: entry.id,
    name: entry.name,
    category: entry.category,
    startUrl: entry.start_url,
    allowedDomains: entry.allowed_domains,
    aliases: entry.aliases,
    icon: entry.icon,
    iconPath: entry.icon_path,
    defaultUserAgent: entry.default_user_agent ?? undefined,
    unreadSpec: entry.unread_spec,
    mobileMode: entry.mobile_mode,
    source: 'registry'
  };
}

export function targetOptions(
  targetType: LinkRule['target_type'],
  services: ServiceInstance[],
  workspaces: Workspace[],
  profiles: ReturnType<typeof useAppStore.getState>['profiles']
): Array<{ id: string; label: string }> {
  if (targetType === 'service') {
    return services.map((service) => ({ id: service.id, label: service.display_name }));
  }
  if (targetType === 'workspace') {
    return workspaces.map((workspace) => ({ id: workspace.id, label: workspace.name }));
  }
  if (targetType === 'profile') {
    return profiles.map((profile) => ({ id: profile.id, label: profile.label }));
  }
  return [];
}

export function labelFromId(value: string): string {
  return value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (char) => char.toUpperCase());
}

export function domainsFrom(url: string, rawDomains: string): string[] {
  const manual = rawDomains
    .split(',')
    .map((domain) => domain.trim())
    .filter(Boolean);
  if (manual.length) return unique(manual);
  try {
    return [new URL(url).hostname];
  } catch {
    return [];
  }
}

export function unique(values: string[]): string[] {
  return [...new Set(values)];
}

export function titleFor(panel: Panel): string {
  switch (panel) {
    case 'workspaces':
      return 'Workspaces';
    case 'catalog':
      return 'Catalog';
    case 'profiles':
      return 'Profiles';
    case 'service':
      return 'Active Service';
    case 'links':
      return 'Link Rules';
    case 'dashboard':
      return 'Dashboard';
    case 'custom':
      return 'Custom App';
    case 'extensions':
      return 'Extensions';
    case 'privacy':
      return 'Privacy';
    case 'trust':
      return 'Trust';
    case 'firewall':
      return 'Privacy Firewall';
    case 'performance':
      return 'Performance';
    case 'analytics':
      return 'Personal Analytics';
    case 'ai':
      return 'AI Workflows';
    case 'automations':
      return 'Automations';
    case 'focus':
      return 'Focus Modes';
    case 'browserImport':
      return 'Browser Import';
    case 'recipeStudio':
      return 'Recipe Studio';
    case 'extensionPack':
      return 'Extension Pack';
    case 'snapshots':
      return 'Snapshots';
    case 'workKits':
      return 'Work Kits';
    case 'portable':
      return 'Portable Mode';
    case 'peerSync':
      return 'Peer Sync';
    case 'downloads':
      return 'Downloads';
    case 'shortcuts':
      return 'Shortcuts';
    case 'sync':
      return 'Sync';
    case 'import':
      return 'Import';
    case 'diagnostics':
      return 'Diagnostics';
  }
}
