import { create } from 'zustand';
import type {
  CustomRecipe,
  Layout,
  NotificationRecord,
  PaletteItem,
  Profile,
  RecipeCatalogItem,
  ServiceInstance,
  ServiceState,
  ServiceTab,
  Task,
  UnreadCount,
  Workspace
} from '../../shared/types';
import { api, type SettingsMap } from '../ipc/client';

const DEFAULT_SETTINGS: SettingsMap = {
  theme: 'system',
  global_dnd: 'false',
  tracker_block: 'false',
  close_to_tray: 'true',
  minimize_to_tray: 'false',
  global_hotkey: '',
  onboarded: 'false',
  launch_at_login: 'false',
  auto_lock_minutes: '',
  portable_mode_enabled: 'false',
  portable_mode_root: '',
  peer_sync_serve: 'false',
  show_memory_badges: 'false',
  notification_retention_days: '30'
};

export type ProControlsPanel =
  | 'workspaces'
  | 'catalog'
  | 'profiles'
  | 'service'
  | 'links'
  | 'dashboard'
  | 'custom'
  | 'extensions'
  | 'privacy'
  | 'trust'
  | 'performance'
  | 'ai'
  | 'automations'
  | 'focus'
  | 'browserImport'
  | 'recipeStudio'
  | 'extensionPack'
  | 'firewall'
  | 'snapshots'
  | 'analytics'
  | 'portable'
  | 'peerSync'
  | 'workKits'
  | 'downloads'
  | 'shortcuts'
  | 'sync'
  | 'import'
  | 'diagnostics';

export function applyTheme(theme: string): void {
  const isLight =
    theme === 'light' ||
    (theme === 'system' && !window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('light', isLight);
}

interface AppState {
  loading: boolean;
  loadError: string | null;
  workspaces: Workspace[];
  profiles: Profile[];
  recipes: RecipeCatalogItem[];
  services: ServiceInstance[];
  tasks: Task[];
  selectedWorkspaceId: string | null;
  selectedServiceIds: string[];
  layoutMode: Layout['mode'];
  serviceStates: Record<string, ServiceState>;
  unread: Record<string, UnreadCount>;
  locked: boolean;
  lockConfigured: boolean;
  catalogOpen: boolean;
  settingsOpen: boolean;
  taskPanelOpen: boolean;
  commandOpen: boolean;
  inboxOpen: boolean;
  proControlsOpen: boolean;
  proControlsPanel: ProControlsPanel;
  dashboardOpen: boolean;
  notifications: NotificationRecord[];
  unreadNotifications: number;
  tabs: Record<string, ServiceTab[]>;
  settings: SettingsMap;
  aiConfigured: boolean;
  syncStatus: {
    configured: boolean;
    folderPath?: string;
    lastSyncAt?: number;
    lastError?: string;
  };
  load: () => Promise<void>;
  refreshServices: () => Promise<void>;
  selectWorkspace: (workspaceId: string) => Promise<void>;
  createWorkspace: (input: {
    name: string;
    icon?: string | null;
    color?: string | null;
    parentId?: string | null;
  }) => Promise<void>;
  updateWorkspace: (id: string, patch: Partial<Workspace>) => Promise<void>;
  deleteWorkspace: (id: string) => Promise<void>;
  createProfile: (input: {
    label: string;
    color?: string | null;
    note?: string | null;
  }) => Promise<void>;
  updateProfile: (id: string, patch: Partial<Profile>) => Promise<void>;
  deleteProfile: (id: string) => Promise<void>;
  selectService: (serviceId: string) => Promise<void>;
  setLayoutMode: (mode: Layout['mode']) => Promise<void>;
  reorderServices: (orderedIds: string[]) => Promise<void>;
  reorderWorkspaces: (orderedIds: string[]) => Promise<void>;
  createService: (
    recipe: RecipeCatalogItem,
    displayName?: string,
    profileId?: string | null
  ) => Promise<void>;
  createCustomService: (input: {
    name: string;
    url: string;
    domains: string[];
    category: RecipeCatalogItem['category'];
    profileId?: string | null;
    defaultUserAgent?: string | null;
    unreadTitleRegex?: string | null;
    mobileMode?: boolean;
  }) => Promise<void>;
  updateService: (id: string, patch: Partial<ServiceInstance>) => Promise<void>;
  deleteService: (id: string, wipeData?: boolean) => Promise<void>;
  sleepService: (id: string) => Promise<void>;
  wakeService: (id: string) => Promise<void>;
  setServiceState: (id: string, state: ServiceState) => void;
  setUnread: (id: string, count: UnreadCount) => void;
  setLocked: (locked: boolean) => void;
  setupLock: (passphrase: string) => Promise<void>;
  unlock: (passphrase: string) => Promise<boolean>;
  lock: () => Promise<void>;
  addTask: (title: string) => Promise<void>;
  toggleTask: (task: Task) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  queryPalette: (q: string) => Promise<PaletteItem[]>;
  configureSync: (folderPath: string, passphrase: string) => Promise<string>;
  syncNow: () => Promise<void>;
  setCatalogOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setTaskPanelOpen: (open: boolean) => void;
  setCommandOpen: (open: boolean) => void;
  setInboxOpen: (open: boolean) => void;
  setProControlsOpen: (open: boolean, panel?: ProControlsPanel) => void;
  setProControlsPanel: (panel: ProControlsPanel) => void;
  setDashboardOpen: (open: boolean) => void;
  loadNotifications: () => Promise<void>;
  markNotificationRead: (id: number) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  clearNotifications: () => Promise<void>;
  bumpUnread: (count: number) => void;
  loadTabs: (instanceId: string) => Promise<void>;
  newTab: (instanceId: string) => Promise<void>;
  closeTab: (instanceId: string, tabId: string) => Promise<void>;
  selectTab: (instanceId: string, tabId: string) => Promise<void>;
  applySettings: (settings: SettingsMap) => void;
  setSettingValue: (key: keyof SettingsMap, value: string) => Promise<void>;
  toggleDnd: () => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  loading: true,
  loadError: null,
  workspaces: [],
  profiles: [],
  recipes: [],
  services: [],
  tasks: [],
  selectedWorkspaceId: null,
  selectedServiceIds: [],
  layoutMode: 'single',
  serviceStates: {},
  unread: {},
  locked: false,
  lockConfigured: false,
  catalogOpen: false,
  settingsOpen: false,
  taskPanelOpen: false,
  commandOpen: false,
  inboxOpen: false,
  proControlsOpen: false,
  proControlsPanel: 'workspaces',
  dashboardOpen: false,
  notifications: [],
  unreadNotifications: 0,
  tabs: {},
  settings: DEFAULT_SETTINGS,
  aiConfigured: false,
  syncStatus: { configured: false },
  load: async () => {
    // A single rejected IPC call must never strand the UI on the startup splash — surface it
    // and let the user retry instead.
    let loaded;
    try {
      loaded = await Promise.all([
        api.workspaces.list(),
        api.profiles.list(),
        api.recipes.catalog(),
        api.tasks.list(),
        api.lock.status(),
        api.sync.status(),
        api.settings.get(),
        api.notifications.unreadCount(),
        api.ai.status()
      ]);
    } catch (error) {
      set({
        loading: false,
        loadError: error instanceof Error ? error.message : String(error)
      });
      return;
    }
    const [
      workspaces,
      profiles,
      recipes,
      tasks,
      lockStatus,
      syncStatus,
      settings,
      unread,
      aiStatus
    ] = loaded;
    applyTheme(settings.theme);
    const activeWorkspaces = workspaces.filter((workspace) => !workspace.disabled);
    const selectedWorkspaceId = activeWorkspaces.some(
      (workspace) => workspace.id === get().selectedWorkspaceId
    )
      ? get().selectedWorkspaceId
      : (activeWorkspaces[0]?.id ?? null);
    let services: ServiceInstance[] = [];
    let layoutMode: Layout['mode'] = 'single';
    let selectedServiceIds: string[] = [];
    if (selectedWorkspaceId) {
      services = await api.services.list(selectedWorkspaceId);
      const layout = await api.layout.get(selectedWorkspaceId);
      layoutMode = layout.mode;
      selectedServiceIds = layout.selected_service_ids.filter((id) =>
        services.some((service) => service.id === id && !service.disabled)
      );
      if (!selectedServiceIds.length) {
        const firstActive = services.find((service) => !service.disabled);
        selectedServiceIds = firstActive ? [firstActive.id] : [];
      }
    }
    set({
      loading: false,
      loadError: null,
      workspaces,
      profiles,
      recipes,
      services,
      tasks,
      selectedWorkspaceId,
      selectedServiceIds,
      layoutMode,
      locked: lockStatus.locked,
      lockConfigured: lockStatus.configured,
      syncStatus,
      settings,
      unreadNotifications: unread,
      aiConfigured: aiStatus.configured
    });
  },
  refreshServices: async () => {
    const workspaceId = get().selectedWorkspaceId;
    const services = workspaceId ? await api.services.list(workspaceId) : [];
    set({ services });
  },
  selectWorkspace: async (workspaceId) => {
    if (get().workspaces.some((workspace) => workspace.id === workspaceId && workspace.disabled)) {
      return;
    }
    const services = await api.services.list(workspaceId);
    const layout = await api.layout.get(workspaceId);
    const selectedServiceIds = layout.selected_service_ids.filter((id) =>
      services.some((service) => service.id === id && !service.disabled)
    );
    const firstActive = services.find((service) => !service.disabled);
    set({
      selectedWorkspaceId: workspaceId,
      services,
      layoutMode: layout.mode,
      selectedServiceIds: selectedServiceIds.length
        ? selectedServiceIds
        : firstActive
          ? [firstActive.id]
          : []
    });
  },
  createWorkspace: async (input) => {
    const workspace = await api.workspaces.create(input);
    set({ workspaces: await api.workspaces.list() });
    await get().selectWorkspace(workspace.id);
  },
  updateWorkspace: async (id, patch) => {
    const workspace = await api.workspaces.update(id, patch);
    set((current) => ({
      workspaces: current.workspaces.map((candidate) =>
        candidate.id === id ? workspace : candidate
      )
    }));
  },
  deleteWorkspace: async (id) => {
    const { selectedWorkspaceId, workspaces } = get();
    if (workspaces.length <= 1) return;
    await api.workspaces.delete(id);
    const nextWorkspaces = await api.workspaces.list();
    const nextActive = nextWorkspaces.filter((workspace) => !workspace.disabled);
    const nextSelected =
      selectedWorkspaceId === id ||
      nextActive.every((workspace) => workspace.id !== selectedWorkspaceId)
        ? nextActive[0]?.id
        : selectedWorkspaceId;
    set({
      workspaces: nextWorkspaces,
      selectedWorkspaceId: null,
      services: [],
      selectedServiceIds: []
    });
    if (nextSelected) {
      await get().selectWorkspace(nextSelected);
    }
  },
  createProfile: async (input) => {
    await api.profiles.create(input);
    set({ profiles: await api.profiles.list() });
  },
  updateProfile: async (id, patch) => {
    const profile = await api.profiles.update(id, patch);
    set((current) => ({
      profiles: current.profiles.map((candidate) => (candidate.id === id ? profile : candidate))
    }));
  },
  deleteProfile: async (id) => {
    await api.profiles.delete(id);
    set({ profiles: await api.profiles.list() });
    await get().refreshServices();
  },
  selectService: async (serviceId) => {
    const { selectedWorkspaceId, layoutMode, selectedServiceIds } = get();
    if (!selectedWorkspaceId) return;
    if (get().services.some((service) => service.id === serviceId && service.disabled)) return;
    const next =
      layoutMode === 'single'
        ? [serviceId]
        : [serviceId, ...selectedServiceIds.filter((id) => id !== serviceId)].slice(
            0,
            layoutMode === 'split' ? 2 : 4
          );
    await api.layout.set(selectedWorkspaceId, layoutMode, next, {});
    await api.views.focus(serviceId);
    set({ selectedServiceIds: next });
  },
  setLayoutMode: async (mode) => {
    const { selectedWorkspaceId, selectedServiceIds, services } = get();
    if (!selectedWorkspaceId) return;
    const limit = mode === 'single' ? 1 : mode === 'split' ? 2 : 4;
    const activeServices = services.filter((service) => !service.disabled);
    // Keep the current selection, then top up empty panes from the remaining active services so
    // split/grid actually render multiple panes even when only one service was selected.
    const next = activeServices
      .map((service) => service.id)
      .filter((id) => selectedServiceIds.includes(id));
    for (const service of activeServices) {
      if (next.length >= limit) break;
      if (!next.includes(service.id)) next.push(service.id);
    }
    next.splice(limit);
    await api.layout.set(selectedWorkspaceId, mode, next, {});
    set({ layoutMode: mode, selectedServiceIds: next });
  },
  reorderServices: async (orderedIds) => {
    const { selectedWorkspaceId, services } = get();
    if (!selectedWorkspaceId) return;
    const byId = new Map(services.map((service) => [service.id, service]));
    const next = orderedIds
      .map((id) => byId.get(id))
      .filter((service): service is NonNullable<typeof service> => Boolean(service));
    set({ services: next }); // optimistic; refresh reconciles ordering with the DB
    await api.services.reorder(selectedWorkspaceId, orderedIds);
    await get().refreshServices();
  },
  reorderWorkspaces: async (orderedIds) => {
    const byId = new Map(get().workspaces.map((workspace) => [workspace.id, workspace]));
    const next = orderedIds
      .map((id) => byId.get(id))
      .filter((workspace): workspace is NonNullable<typeof workspace> => Boolean(workspace));
    set({ workspaces: next });
    await api.workspaces.reorder(orderedIds);
  },
  createService: async (recipe, displayName, profileId) => {
    const workspaceId = get().selectedWorkspaceId;
    if (!workspaceId) return;
    const service = await api.services.create({
      recipeId: recipe.id,
      workspaceId,
      displayName: displayName?.trim() || recipe.name,
      profileId: profileId || null,
      color: recipe.source === 'builtin' ? null : '#2dd4bf'
    });
    await get().refreshServices();
    await get().selectService(service.id);
    set({ catalogOpen: false });
  },
  createCustomService: async (input) => {
    const recipe = await api.recipes.createCustom({
      name: input.name,
      category: input.category,
      start_url: input.url,
      allowed_domains: input.domains,
      default_user_agent: input.defaultUserAgent?.trim() || null,
      unread_spec: input.unreadTitleRegex?.trim()
        ? { titleRegex: input.unreadTitleRegex.trim() }
        : null,
      mobile_mode: input.mobileMode ?? false
    });
    set({ recipes: await api.recipes.catalog() });
    await get().createService(
      { ...recipeToCatalog(recipe), source: 'custom' },
      recipe.name,
      input.profileId
    );
  },
  updateService: async (id, patch) => {
    await api.services.update(id, patch);
    await get().refreshServices();
  },
  deleteService: async (id, wipeData = false) => {
    await api.services.delete(id, wipeData);
    const selected = get().selectedServiceIds.filter((serviceId) => serviceId !== id);
    await get().refreshServices();
    set({ selectedServiceIds: selected });
  },
  sleepService: async (id) => {
    await api.services.sleep(id);
    set((current) => ({ serviceStates: { ...current.serviceStates, [id]: 'sleeping' } }));
  },
  wakeService: async (id) => {
    await api.services.wake(id);
    set((current) => ({ serviceStates: { ...current.serviceStates, [id]: 'loading' } }));
  },
  setServiceState: (id, state) =>
    set((current) => ({ serviceStates: { ...current.serviceStates, [id]: state } })),
  setUnread: (id, count) => set((current) => ({ unread: { ...current.unread, [id]: count } })),
  setLocked: (locked) => set({ locked }),
  setupLock: async (passphrase) => {
    await api.lock.setup(passphrase);
    set({ lockConfigured: true, locked: false });
  },
  unlock: async (passphrase) => {
    const result = await api.lock.unlock(passphrase);
    if (result.ok) set({ locked: false });
    return result.ok;
  },
  lock: async () => {
    // With no passphrase set, the main process can't truly lock and unlock would accept anything.
    // Show the lock screen in setup mode instead so the user creates a passphrase first.
    if (!get().lockConfigured) {
      set({ locked: true });
      return;
    }
    await api.lock.lock();
    set({ locked: true });
  },
  addTask: async (title) => {
    await api.tasks.create(title);
    set({ tasks: await api.tasks.list() });
  },
  toggleTask: async (task) => {
    await api.tasks.update(task.id, { done: !task.done });
    set({ tasks: await api.tasks.list() });
  },
  deleteTask: async (id) => {
    await api.tasks.delete(id);
    set({ tasks: await api.tasks.list() });
  },
  queryPalette: (q) => api.palette.query(q),
  configureSync: async (folderPath, passphrase) => {
    const result = await api.sync.configure(folderPath, passphrase);
    set({ syncStatus: await api.sync.status() });
    return result.recoveryPhrase;
  },
  syncNow: async () => {
    await api.sync.now();
    set({ syncStatus: await api.sync.status() });
  },
  setCatalogOpen: (catalogOpen) => set({ catalogOpen }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setTaskPanelOpen: (taskPanelOpen) => set({ taskPanelOpen }),
  setCommandOpen: (commandOpen) => set({ commandOpen }),
  setInboxOpen: (inboxOpen) => {
    set({ inboxOpen });
    if (inboxOpen) void get().loadNotifications();
  },
  setProControlsOpen: (proControlsOpen, proControlsPanel) =>
    set(proControlsPanel ? { proControlsOpen, proControlsPanel } : { proControlsOpen }),
  setProControlsPanel: (proControlsPanel) => set({ proControlsPanel }),
  setDashboardOpen: (dashboardOpen) => set({ dashboardOpen }),
  loadNotifications: async () => {
    const [notifications, unreadNotifications] = await Promise.all([
      api.notifications.list(200),
      api.notifications.unreadCount()
    ]);
    set({ notifications, unreadNotifications });
  },
  markNotificationRead: async (id) => {
    await api.notifications.markRead(id);
    await get().loadNotifications();
  },
  markAllNotificationsRead: async () => {
    await api.notifications.markAllRead();
    await get().loadNotifications();
  },
  clearNotifications: async () => {
    await api.notifications.clear();
    await get().loadNotifications();
  },
  bumpUnread: (count) => {
    set({ unreadNotifications: count });
    if (get().inboxOpen) void get().loadNotifications();
  },
  loadTabs: async (instanceId) => {
    const tabs = await api.tabs.list(instanceId);
    set((current) => ({ tabs: { ...current.tabs, [instanceId]: tabs } }));
  },
  newTab: async (instanceId) => {
    await api.tabs.create(instanceId);
    await get().loadTabs(instanceId);
  },
  closeTab: async (instanceId, tabId) => {
    await api.tabs.close(tabId);
    await get().loadTabs(instanceId);
  },
  selectTab: async (instanceId, tabId) => {
    await api.tabs.setActive(instanceId, tabId);
    await get().loadTabs(instanceId);
  },
  applySettings: (settings) => {
    applyTheme(settings.theme);
    set({ settings });
  },
  setSettingValue: async (key, value) => {
    await api.settings.set(key, value);
    const settings = { ...get().settings, [key]: value };
    applyTheme(settings.theme);
    set({ settings });
  },
  toggleDnd: async () => {
    await get().setSettingValue(
      'global_dnd',
      get().settings.global_dnd === 'true' ? 'false' : 'true'
    );
  }
}));

function recipeToCatalog(recipe: CustomRecipe): RecipeCatalogItem {
  return {
    id: recipe.id,
    name: recipe.name,
    category: recipe.category,
    startUrl: recipe.start_url,
    allowedDomains: recipe.allowed_domains,
    unreadSpec: recipe.unread_spec,
    source: 'custom'
  };
}
