import type { IpcChannel, PushChannel } from '../../shared/ipc-contract';
import type {
  AiBrief,
  AiStatus,
  AppMetrics,
  CustomRecipe,
  ExtensionRecord,
  FerdiumImportResult,
  Layout,
  NotificationRecord,
  PaletteItem,
  Profile,
  RecipeCatalogItem,
  ServiceInstance,
  ServiceTab,
  SyncResult,
  Task,
  TriageItem,
  Workspace
} from '../../shared/types';

export type SettingsMap = {
  theme: string;
  global_dnd: string;
  tracker_block: string;
  close_to_tray: string;
  global_hotkey: string;
  onboarded: string;
};

async function invoke<T>(channel: IpcChannel, payload?: unknown): Promise<T> {
  return (await window.appdeck.invoke(channel, payload)) as T;
}

export const api = {
  workspaces: {
    list: () => invoke<Workspace[]>('workspace:list'),
    create: (payload: { name: string; icon?: string | null; color?: string | null }) => invoke<Workspace>('workspace:create', payload),
    update: (id: string, patch: Partial<Workspace>) => invoke<Workspace>('workspace:update', { id, patch }),
    delete: (id: string) => invoke<void>('workspace:delete', { id }),
    reorder: (orderedIds: string[]) => invoke<void>('workspace:reorder', { orderedIds })
  },
  profiles: {
    list: () => invoke<Profile[]>('profile:list'),
    create: (payload: { label: string; color?: string | null; note?: string | null }) => invoke<Profile>('profile:create', payload)
  },
  services: {
    list: (workspaceId?: string) => invoke<ServiceInstance[]>('service:list', workspaceId ? { workspaceId } : undefined),
    create: (payload: { recipeId: string; workspaceId: string; displayName: string; profileId?: string | null; color?: string | null }) =>
      invoke<ServiceInstance>('service:create', payload),
    update: (id: string, patch: Partial<ServiceInstance>) => invoke<ServiceInstance>('service:update', { id, patch }),
    delete: (id: string, wipeData?: boolean) => invoke<void>('service:delete', { id, wipeData }),
    reorder: (workspaceId: string, orderedIds: string[]) => invoke<void>('service:reorder', { workspaceId, orderedIds }),
    reload: (id: string) => invoke<void>('service:reload', { id }),
    back: (id: string) => invoke<void>('service:navigateBack', { id }),
    forward: (id: string) => invoke<void>('service:navigateForward', { id }),
    sleep: (id: string) => invoke<void>('service:sleep', { id }),
    wake: (id: string) => invoke<void>('service:wake', { id })
  },
  views: {
    setBounds: (payload: { entries: Array<{ viewId: string; rect: { x: number; y: number; width: number; height: number } }>; visibleIds: string[] }) =>
      invoke<void>('view:setBounds', payload),
    focus: (instanceId: string) => invoke<void>('view:focus', { instanceId })
  },
  tabs: {
    list: (instanceId: string) => invoke<ServiceTab[]>('tab:list', { instanceId }),
    create: (instanceId: string, url?: string) => invoke<ServiceTab>('tab:create', { instanceId, url }),
    close: (id: string) => invoke<void>('tab:close', { id }),
    setActive: (instanceId: string, id: string) => invoke<void>('tab:setActive', { instanceId, id })
  },
  recipes: {
    catalog: () => invoke<RecipeCatalogItem[]>('recipe:catalog'),
    createCustom: (payload: {
      name: string;
      category: CustomRecipe['category'];
      start_url: string;
      allowed_domains: string[];
      icon_path?: string | null;
      default_user_agent?: string | null;
      mobile_mode?: boolean;
    }) => invoke<CustomRecipe>('recipe:createCustom', payload)
  },
  layout: {
    get: (workspaceId: string) => invoke<Layout>('layout:get', { workspaceId }),
    set: (workspaceId: string, mode: Layout['mode'], selectedServiceIds: string[], tileSizing: Record<string, unknown>) =>
      invoke<void>('layout:set', { workspaceId, mode, selectedServiceIds, tileSizing })
  },
  lock: {
    status: () => invoke<{ locked: boolean; configured: boolean }>('lock:status'),
    setup: (passphrase: string) => invoke<void>('lock:setup', { passphrase }),
    unlock: (passphrase: string) => invoke<{ ok: boolean }>('lock:unlock', { passphrase }),
    lock: () => invoke<void>('lock:lock')
  },
  sync: {
    status: () => invoke<{ configured: boolean; folderPath?: string; lastSyncAt?: number; pendingConflicts: number }>('sync:status'),
    configure: (folderPath: string, passphrase: string) => invoke<{ recoveryPhrase: string }>('sync:configure', { folderPath, passphrase }),
    join: (folderPath: string, recoveryPhrase: string, passphrase: string) =>
      invoke<{ ok: true }>('sync:join', { folderPath, recoveryPhrase, passphrase }),
    now: () => invoke<SyncResult>('sync:now')
  },
  tasks: {
    list: () => invoke<Task[]>('task:list'),
    create: (title: string) => invoke<Task>('task:create', { title }),
    update: (id: string, patch: Partial<Task>) => invoke<Task>('task:update', { id, patch }),
    delete: (id: string) => invoke<void>('task:delete', { id })
  },
  palette: {
    query: (q: string) => invoke<PaletteItem[]>('palette:query', { q })
  },
  notifications: {
    list: (limit?: number, unreadOnly?: boolean) => invoke<NotificationRecord[]>('notification:list', limit || unreadOnly ? { limit, unreadOnly } : undefined),
    search: (q: string) => invoke<NotificationRecord[]>('notification:search', { q }),
    markRead: (id: number) => invoke<void>('notification:markRead', { id }),
    markAllRead: () => invoke<void>('notification:markAllRead'),
    snooze: (id: number, until: number) => invoke<void>('notification:snooze', { id, until }),
    clear: () => invoke<void>('notification:clear'),
    unreadCount: () => invoke<number>('notification:unreadCount')
  },
  ai: {
    status: () => invoke<AiStatus>('ai:status'),
    configure: (apiKey: string) => invoke<void>('ai:configure', { apiKey }),
    clearKey: () => invoke<void>('ai:clearKey'),
    brief: () => invoke<AiBrief>('ai:brief'),
    triage: () => invoke<TriageItem[]>('ai:triage')
  },
  extensions: {
    list: () => invoke<ExtensionRecord[]>('extension:list'),
    add: (path: string) => invoke<ExtensionRecord>('extension:add', { path }),
    remove: (id: string) => invoke<void>('extension:remove', { id }),
    setEnabled: (id: string, enabled: boolean) => invoke<void>('extension:setEnabled', { id, enabled })
  },
  importer: {
    ferdium: (data: string, workspaceId?: string) => invoke<FerdiumImportResult>('import:ferdium', { data, workspaceId })
  },
  metrics: {
    get: () => invoke<AppMetrics>('metrics:get')
  },
  settings: {
    get: () => invoke<SettingsMap>('settings:get'),
    set: (key: keyof SettingsMap, value: string) => invoke<void>('settings:set', { key, value })
  },
  update: {
    status: () => invoke<{ status: string }>('update:status'),
    check: () => invoke<{ status: string }>('update:check'),
    install: () => invoke<void>('update:install')
  },
  account: {
    status: () => invoke<{ configured: boolean; email?: string }>('account:status'),
    signup: (serverUrl: string, email: string, password: string) => invoke<void>('account:signup', { serverUrl, email, password }),
    login: (serverUrl: string, email: string, password: string) => invoke<void>('account:login', { serverUrl, email, password }),
    logout: () => invoke<void>('account:logout'),
    syncNow: () => invoke<void>('account:syncNow')
  },
  on: (channel: PushChannel, callback: (payload: unknown) => void) => window.appdeck.on(channel, callback)
};
