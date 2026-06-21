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
  global_hotkey: '',
  onboarded: 'false'
};

export function applyTheme(theme: string): void {
  const isLight = theme === 'light' || (theme === 'system' && !window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('light', isLight);
}

interface AppState {
  loading: boolean;
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
  notifications: NotificationRecord[];
  unreadNotifications: number;
  tabs: Record<string, ServiceTab[]>;
  settings: SettingsMap;
  aiConfigured: boolean;
  syncStatus: { configured: boolean; folderPath?: string; lastSyncAt?: number; pendingConflicts: number };
  load: () => Promise<void>;
  refreshServices: () => Promise<void>;
  selectWorkspace: (workspaceId: string) => Promise<void>;
  selectService: (serviceId: string) => Promise<void>;
  setLayoutMode: (mode: Layout['mode']) => Promise<void>;
  createService: (recipe: RecipeCatalogItem, displayName?: string) => Promise<void>;
  createCustomService: (input: { name: string; url: string; domains: string[]; category: RecipeCatalogItem['category'] }) => Promise<void>;
  updateService: (id: string, patch: Partial<ServiceInstance>) => Promise<void>;
  deleteService: (id: string) => Promise<void>;
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
  notifications: [],
  unreadNotifications: 0,
  tabs: {},
  settings: DEFAULT_SETTINGS,
  aiConfigured: false,
  syncStatus: { configured: false, pendingConflicts: 0 },
  load: async () => {
    const [workspaces, profiles, recipes, tasks, lockStatus, syncStatus, settings, unread, aiStatus] = await Promise.all([
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
    applyTheme(settings.theme);
    const selectedWorkspaceId = get().selectedWorkspaceId ?? workspaces[0]?.id ?? null;
    let services: ServiceInstance[] = [];
    let layoutMode: Layout['mode'] = 'single';
    let selectedServiceIds: string[] = [];
    if (selectedWorkspaceId) {
      services = await api.services.list(selectedWorkspaceId);
      const layout = await api.layout.get(selectedWorkspaceId);
      layoutMode = layout.mode;
      selectedServiceIds = layout.selected_service_ids.filter((id) => services.some((service) => service.id === id));
      if (!selectedServiceIds.length && services[0]) {
        selectedServiceIds = [services[0].id];
      }
    }
    set({
      loading: false,
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
    const services = await api.services.list(workspaceId);
    const layout = await api.layout.get(workspaceId);
    const selectedServiceIds = layout.selected_service_ids.filter((id) => services.some((service) => service.id === id));
    set({
      selectedWorkspaceId: workspaceId,
      services,
      layoutMode: layout.mode,
      selectedServiceIds: selectedServiceIds.length ? selectedServiceIds : services[0] ? [services[0].id] : []
    });
  },
  selectService: async (serviceId) => {
    const { selectedWorkspaceId, layoutMode, selectedServiceIds } = get();
    if (!selectedWorkspaceId) return;
    const next =
      layoutMode === 'single'
        ? [serviceId]
        : [serviceId, ...selectedServiceIds.filter((id) => id !== serviceId)].slice(0, layoutMode === 'split' ? 2 : 4);
    await api.layout.set(selectedWorkspaceId, layoutMode, next, {});
    await api.views.focus(serviceId);
    set({ selectedServiceIds: next });
  },
  setLayoutMode: async (mode) => {
    const { selectedWorkspaceId, selectedServiceIds, services } = get();
    if (!selectedWorkspaceId) return;
    const limit = mode === 'single' ? 1 : mode === 'split' ? 2 : 4;
    const next = selectedServiceIds.length ? selectedServiceIds.slice(0, limit) : services.slice(0, limit).map((service) => service.id);
    await api.layout.set(selectedWorkspaceId, mode, next, {});
    set({ layoutMode: mode, selectedServiceIds: next });
  },
  createService: async (recipe, displayName) => {
    const workspaceId = get().selectedWorkspaceId;
    if (!workspaceId) return;
    const service = await api.services.create({
      recipeId: recipe.id,
      workspaceId,
      displayName: displayName?.trim() || recipe.name,
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
      allowed_domains: input.domains
    });
    set({ recipes: await api.recipes.catalog() });
    await get().createService({ ...recipeToCatalog(recipe), source: 'custom' }, recipe.name);
  },
  updateService: async (id, patch) => {
    await api.services.update(id, patch);
    await get().refreshServices();
  },
  deleteService: async (id) => {
    await api.services.delete(id, false);
    const selected = get().selectedServiceIds.filter((serviceId) => serviceId !== id);
    await get().refreshServices();
    set({ selectedServiceIds: selected });
  },
  setServiceState: (id, state) => set((current) => ({ serviceStates: { ...current.serviceStates, [id]: state } })),
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
  loadNotifications: async () => {
    const [notifications, unreadNotifications] = await Promise.all([api.notifications.list(200), api.notifications.unreadCount()]);
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
    await get().setSettingValue('global_dnd', get().settings.global_dnd === 'true' ? 'false' : 'true');
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
