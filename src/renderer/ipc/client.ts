import type { IpcChannel, PushChannel } from '../../shared/ipc-contract';
import type {
  AiBrief,
  AiPrompt,
  AiPromptRunResult,
  AiStatus,
  AutomationRule,
  AutomationTestResult,
  AppMetrics,
  BrowserImportPreview,
  CustomRecipe,
  Dashboard,
  DashboardSnapshot,
  ExtensionRecord,
  FocusMode,
  FocusModeStatus,
  FerdiumImportResult,
  Layout,
  LinkRule,
  LinkRuleTestResult,
  LocalExtensionTemplate,
  MigrationPreview,
  MigrationRunResult,
  NotificationRecord,
  PermissionPolicy,
  PaletteItem,
  PeerSyncPeer,
  PeerSyncRunResult,
  PeerSyncStatus,
  PersonalAnalytics,
  PerformanceStatus,
  PortableModeStatus,
  Profile,
  PrivacyFirewallRule,
  PrivacyFirewallTestResult,
  RecipePackValidation,
  RecipeStudioAnalysis,
  RecipeRegistryEntry,
  RecipeCatalogItem,
  RepairResult,
  RepairStatus,
  SavedTabSession,
  ServiceInstance,
  ServiceTab,
  ShortcutBinding,
  SyncResult,
  Task,
  TriageItem,
  TrustStatus,
  WorkKit,
  WorkspaceSnapshot,
  Workspace,
  DownloadRecord
} from '../../shared/types';

export type SettingsMap = {
  theme: string;
  global_dnd: string;
  tracker_block: string;
  close_to_tray: string;
  minimize_to_tray: string;
  global_hotkey: string;
  onboarded: string;
  launch_at_login: string;
  auto_lock_minutes: string;
  portable_mode_enabled: string;
  portable_mode_root: string;
};

async function invoke<T>(channel: IpcChannel, payload?: unknown): Promise<T> {
  return (await window.appdeck.invoke(channel, payload)) as T;
}

export const api = {
  workspaces: {
    list: () => invoke<Workspace[]>('workspace:list'),
    create: (payload: {
      name: string;
      icon?: string | null;
      color?: string | null;
      parentId?: string | null;
    }) => invoke<Workspace>('workspace:create', payload),
    update: (id: string, patch: Partial<Workspace>) =>
      invoke<Workspace>('workspace:update', { id, patch }),
    delete: (id: string) => invoke<void>('workspace:delete', { id }),
    reorder: (orderedIds: string[]) => invoke<void>('workspace:reorder', { orderedIds })
  },
  profiles: {
    list: () => invoke<Profile[]>('profile:list'),
    create: (payload: { label: string; color?: string | null; note?: string | null }) =>
      invoke<Profile>('profile:create', payload),
    update: (id: string, patch: Partial<Profile>) =>
      invoke<Profile>('profile:update', { id, patch }),
    delete: (id: string) => invoke<void>('profile:delete', { id })
  },
  services: {
    list: (workspaceId?: string) =>
      invoke<ServiceInstance[]>('service:list', workspaceId ? { workspaceId } : undefined),
    create: (payload: {
      recipeId: string;
      workspaceId: string;
      displayName: string;
      profileId?: string | null;
      color?: string | null;
    }) => invoke<ServiceInstance>('service:create', payload),
    update: (id: string, patch: Partial<ServiceInstance>) =>
      invoke<ServiceInstance>('service:update', { id, patch }),
    delete: (id: string, wipeData?: boolean) => invoke<void>('service:delete', { id, wipeData }),
    reorder: (workspaceId: string, orderedIds: string[]) =>
      invoke<void>('service:reorder', { workspaceId, orderedIds }),
    reload: (id: string) => invoke<void>('service:reload', { id }),
    back: (id: string) => invoke<void>('service:navigateBack', { id }),
    forward: (id: string) => invoke<void>('service:navigateForward', { id }),
    sleep: (id: string) => invoke<void>('service:sleep', { id }),
    wake: (id: string) => invoke<void>('service:wake', { id }),
    openExternal: (id: string) => invoke<void>('service:openExternal', { id }),
    currentUrl: (id: string) => invoke<{ url: string | null }>('service:currentUrl', { id }),
    clearStorage: (id: string) => invoke<void>('service:clearStorage', { id }),
    setZoom: (id: string, zoomFactor: number) =>
      invoke<void>('service:setZoom', { id, zoomFactor }),
    find: (id: string, text: string, forward?: boolean) =>
      invoke<void>('service:find', { id, text, forward }),
    stopFind: (id: string) => invoke<void>('service:stopFind', { id })
  },
  views: {
    setBounds: (payload: {
      entries: Array<{
        viewId: string;
        rect: { x: number; y: number; width: number; height: number };
      }>;
      visibleIds: string[];
    }) => invoke<void>('view:setBounds', payload),
    focus: (instanceId: string) => invoke<void>('view:focus', { instanceId })
  },
  tabs: {
    list: (instanceId: string) => invoke<ServiceTab[]>('tab:list', { instanceId }),
    create: (instanceId: string, url?: string) =>
      invoke<ServiceTab>('tab:create', { instanceId, url }),
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
      unread_spec?: CustomRecipe['unread_spec'];
      mobile_mode?: boolean;
    }) => invoke<CustomRecipe>('recipe:createCustom', payload)
  },
  registry: {
    search: (q?: string, limit?: number) =>
      invoke<RecipeRegistryEntry[]>('registry:search', { q, limit }),
    validate: (data: string) => invoke<RecipePackValidation>('registry:validate', { data }),
    import: (data: string) =>
      invoke<{ imported: number; skipped: number }>('registry:import', { data }),
    stats: () =>
      invoke<{ total: number; seed: number; community: number; user: number }>('registry:stats')
  },
  linkRules: {
    list: () => invoke<LinkRule[]>('linkRule:list'),
    upsert: (
      payload: Partial<LinkRule> & Pick<LinkRule, 'name' | 'match_type' | 'pattern' | 'target_type'>
    ) => invoke<LinkRule>('linkRule:upsert', payload),
    delete: (id: string) => invoke<void>('linkRule:delete', { id }),
    test: (url: string) => invoke<LinkRuleTestResult>('linkRule:test', { url })
  },
  dashboards: {
    list: (workspaceId?: string | null) =>
      invoke<Dashboard[]>('dashboard:list', workspaceId ? { workspaceId } : undefined),
    upsert: (payload: Partial<Dashboard> & Pick<Dashboard, 'name'>) =>
      invoke<Dashboard>('dashboard:upsert', payload),
    delete: (id: string) => invoke<void>('dashboard:delete', { id }),
    snapshot: (workspaceId?: string | null) =>
      invoke<DashboardSnapshot>('dashboard:snapshot', workspaceId ? { workspaceId } : undefined),
    saveSession: (payload: { workspaceId?: string | null; name: string; serviceIds: string[] }) =>
      invoke<SavedTabSession>('dashboard:saveSession', {
        workspaceId: payload.workspaceId,
        name: payload.name,
        serviceIds: payload.serviceIds
      })
  },
  shortcuts: {
    list: () => invoke<ShortcutBinding[]>('shortcut:list'),
    upsert: (
      payload: Partial<ShortcutBinding> & Pick<ShortcutBinding, 'command' | 'accelerator'>
    ) => invoke<ShortcutBinding>('shortcut:upsert', payload),
    delete: (id: string) => invoke<void>('shortcut:delete', { id })
  },
  permissions: {
    list: () => invoke<PermissionPolicy[]>('permission:list'),
    upsert: (
      payload: Partial<PermissionPolicy> & Pick<PermissionPolicy, 'permission' | 'decision'>
    ) => invoke<PermissionPolicy>('permission:upsert', payload),
    delete: (id: string) => invoke<void>('permission:delete', { id })
  },
  downloads: {
    list: (limit?: number) =>
      invoke<DownloadRecord[]>('download:list', limit ? { limit } : undefined),
    open: (id: string) => invoke<void>('download:open', { id }),
    clear: () => invoke<void>('download:clear')
  },
  migration: {
    preview: (data: string) => invoke<MigrationPreview>('migration:preview', { data }),
    run: (data: string, workspaceId?: string | null) =>
      invoke<MigrationRunResult>('migration:run', { data, workspaceId })
  },
  trust: {
    status: () => invoke<TrustStatus>('trust:status')
  },
  performance: {
    status: () => invoke<PerformanceStatus>('performance:status')
  },
  automations: {
    list: () => invoke<AutomationRule[]>('automation:list'),
    upsert: (
      payload: Partial<AutomationRule> & Pick<AutomationRule, 'name' | 'trigger' | 'actions'>
    ) => invoke<AutomationRule>('automation:upsert', payload),
    delete: (id: string) => invoke<void>('automation:delete', { id }),
    test: (payload: {
      id?: string;
      trigger?: AutomationRule['trigger'];
      sample?: Record<string, unknown>;
    }) => invoke<AutomationTestResult>('automation:test', payload)
  },
  focusModes: {
    list: () => invoke<FocusMode[]>('focusMode:list'),
    upsert: (payload: Partial<FocusMode> & Pick<FocusMode, 'name'>) =>
      invoke<FocusMode>('focusMode:upsert', payload),
    delete: (id: string) => invoke<void>('focusMode:delete', { id }),
    status: () => invoke<FocusModeStatus>('focusMode:status')
  },
  browserImport: {
    preview: (data: string) => invoke<BrowserImportPreview>('browserImport:preview', { data }),
    run: (data: string, workspaceId?: string | null) =>
      invoke<{ created: number; skipped: number; source: BrowserImportPreview['source'] }>(
        'browserImport:run',
        { data, workspaceId }
      )
  },
  recipeStudio: {
    analyze: (payload: { name: string; url: string; category?: RecipeCatalogItem['category'] }) =>
      invoke<RecipeStudioAnalysis>('recipeStudio:analyze', payload),
    create: (payload: {
      name: string;
      url: string;
      category: RecipeCatalogItem['category'];
      aliases?: string[];
      mobileMode?: boolean;
    }) => invoke<RecipeRegistryEntry>('recipeStudio:create', payload)
  },
  extensionPack: {
    list: () => invoke<LocalExtensionTemplate[]>('extensionPack:list'),
    apply: (id: string) => invoke<LocalExtensionTemplate>('extensionPack:apply', { id })
  },
  firewall: {
    list: () => invoke<PrivacyFirewallRule[]>('firewall:list'),
    upsert: (
      payload: Partial<PrivacyFirewallRule> &
        Pick<PrivacyFirewallRule, 'rule_type' | 'pattern' | 'action'>
    ) => invoke<PrivacyFirewallRule>('firewall:upsert', payload),
    delete: (id: string) => invoke<void>('firewall:delete', { id }),
    test: (url: string, serviceInstanceId?: string | null) =>
      invoke<PrivacyFirewallTestResult>('firewall:test', { url, serviceInstanceId })
  },
  snapshots: {
    list: (workspaceId?: string | null) =>
      invoke<WorkspaceSnapshot[]>('snapshot:list', workspaceId ? { workspaceId } : undefined),
    create: (workspaceId: string, name: string) =>
      invoke<WorkspaceSnapshot>('snapshot:create', { workspaceId, name }),
    restore: (id: string) => invoke<WorkspaceSnapshot>('snapshot:restore', { id }),
    delete: (id: string) => invoke<void>('snapshot:delete', { id })
  },
  analytics: {
    personal: () => invoke<PersonalAnalytics>('analytics:personal')
  },
  repair: {
    status: () => invoke<RepairStatus>('repair:status'),
    run: () => invoke<RepairResult>('repair:run')
  },
  portable: {
    status: () => invoke<PortableModeStatus>('portable:status'),
    configure: (enabled: boolean, rootPath?: string | null) =>
      invoke<PortableModeStatus>('portable:configure', { enabled, rootPath })
  },
  peerSync: {
    status: () => invoke<PeerSyncStatus>('peerSync:status'),
    upsert: (payload: Partial<PeerSyncPeer> & Pick<PeerSyncPeer, 'label' | 'endpoint'>) =>
      invoke<PeerSyncPeer>('peerSync:upsert', payload),
    sync: (id: string) => invoke<PeerSyncRunResult>('peerSync:sync', { id }),
    delete: (id: string) => invoke<void>('peerSync:delete', { id })
  },
  workKits: {
    list: () => invoke<WorkKit[]>('workKit:list'),
    apply: (id: string) =>
      invoke<{ workspaceId: string; createdServices: number; kit: WorkKit }>('workKit:apply', {
        id
      })
  },
  layout: {
    get: (workspaceId: string) => invoke<Layout>('layout:get', { workspaceId }),
    set: (
      workspaceId: string,
      mode: Layout['mode'],
      selectedServiceIds: string[],
      tileSizing: Record<string, unknown>
    ) => invoke<void>('layout:set', { workspaceId, mode, selectedServiceIds, tileSizing })
  },
  lock: {
    status: () => invoke<{ locked: boolean; configured: boolean }>('lock:status'),
    setup: (passphrase: string) => invoke<void>('lock:setup', { passphrase }),
    unlock: (passphrase: string) => invoke<{ ok: boolean }>('lock:unlock', { passphrase }),
    lock: () => invoke<void>('lock:lock')
  },
  sync: {
    status: () =>
      invoke<{
        configured: boolean;
        folderPath?: string;
        lastSyncAt?: number;
        pendingConflicts: number;
      }>('sync:status'),
    configure: (folderPath: string, passphrase: string) =>
      invoke<{ recoveryPhrase: string }>('sync:configure', { folderPath, passphrase }),
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
    list: (limit?: number, unreadOnly?: boolean) =>
      invoke<NotificationRecord[]>(
        'notification:list',
        limit || unreadOnly ? { limit, unreadOnly } : undefined
      ),
    search: (q: string) => invoke<NotificationRecord[]>('notification:search', { q }),
    markRead: (id: number) => invoke<void>('notification:markRead', { id }),
    markAllRead: () => invoke<void>('notification:markAllRead'),
    snooze: (id: number, until: number) => invoke<void>('notification:snooze', { id, until }),
    clear: () => invoke<void>('notification:clear'),
    unreadCount: () => invoke<number>('notification:unreadCount')
  },
  ai: {
    status: () => invoke<AiStatus>('ai:status'),
    configure: (
      config:
        | string
        | {
            apiKey?: string;
            provider?: AiStatus['provider'];
            model?: string;
            baseUrl?: string;
            localOnly?: boolean;
          }
    ) => invoke<void>('ai:configure', typeof config === 'string' ? { apiKey: config } : config),
    clearKey: () => invoke<void>('ai:clearKey'),
    brief: () => invoke<AiBrief>('ai:brief'),
    triage: () => invoke<TriageItem[]>('ai:triage'),
    draftReply: (notificationId: number, instruction?: string) =>
      invoke<AiPromptRunResult>('ai:draftReply', { notificationId, instruction }),
    suggestMutes: () =>
      invoke<Array<{ instanceId: string; reason: string }>>('ai:suggestMutes')
  },
  aiPrompts: {
    list: () => invoke<AiPrompt[]>('aiPrompt:list'),
    upsert: (payload: Partial<AiPrompt> & Pick<AiPrompt, 'title' | 'prompt'>) =>
      invoke<AiPrompt>('aiPrompt:upsert', payload),
    delete: (id: string) => invoke<void>('aiPrompt:delete', { id }),
    run: (payload: { id?: string; prompt?: string; context?: string }) =>
      invoke<AiPromptRunResult>('aiPrompt:run', payload),
    extractTasks: () => invoke<AiPromptRunResult>('aiPrompt:extractTasks')
  },
  extensions: {
    list: () => invoke<ExtensionRecord[]>('extension:list'),
    add: (path: string) => invoke<ExtensionRecord>('extension:add', { path }),
    remove: (id: string) => invoke<void>('extension:remove', { id }),
    setEnabled: (id: string, enabled: boolean) =>
      invoke<void>('extension:setEnabled', { id, enabled })
  },
  importer: {
    ferdium: (data: string, workspaceId?: string) =>
      invoke<FerdiumImportResult>('import:ferdium', { data, workspaceId })
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
    signup: (serverUrl: string, email: string, password: string) =>
      invoke<void>('account:signup', { serverUrl, email, password }),
    login: (serverUrl: string, email: string, password: string) =>
      invoke<void>('account:login', { serverUrl, email, password }),
    logout: () => invoke<void>('account:logout'),
    syncNow: () => invoke<void>('account:syncNow')
  },
  on: (channel: PushChannel, callback: (payload: unknown) => void) =>
    window.appdeck.on(channel, callback)
};
