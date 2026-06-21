export type ServiceCategory = 'Chat' | 'Email' | 'Social' | 'Dev' | 'AI' | 'Productivity' | 'Media' | 'Other';

export interface UnreadCount {
  direct: number;
  indirect: number;
}

export interface SyncMetadata {
  updated_at: number;
  deleted_at: number | null;
  rev: number;
  origin_device: string;
}

export interface Workspace extends SyncMetadata {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  position: number;
  focus_rules: FocusRules;
  sleep_defaults: SleepPolicy;
}

export interface Profile extends SyncMetadata {
  id: string;
  label: string;
  color: string | null;
  note: string | null;
}

export interface CustomRecipe extends SyncMetadata {
  id: string;
  name: string;
  category: ServiceCategory;
  start_url: string;
  allowed_domains: string[];
  icon_path: string | null;
  default_user_agent: string | null;
  unread_spec: DeclarativeUnreadSpec | null;
  mobile_mode: boolean;
}

export interface ServiceInstance extends SyncMetadata {
  id: string;
  recipe_id: string;
  profile_id: string | null;
  display_name: string;
  partition_key: string;
  color: string | null;
  pinned: boolean;
  muted: boolean;
  sleep_policy: SleepPolicy;
  custom_css: string | null;
  custom_js: string | null;
  proxy: ServiceProxy | null;
  user_agent: string | null;
  last_url: string | null;
}

export interface WorkspaceService extends SyncMetadata {
  workspace_id: string;
  service_instance_id: string;
  position: number;
  group_name: string | null;
}

export interface Layout extends SyncMetadata {
  workspace_id: string;
  mode: LayoutMode;
  selected_service_ids: string[];
  tile_sizing: Record<string, unknown>;
}

export interface Task {
  id: string;
  title: string;
  done: boolean;
  position: number;
  created_at: number;
}

export type LayoutMode = 'single' | 'split' | 'grid';

export interface FocusRules {
  dnd?: boolean;
  schedule?: Array<{ from: string; to: string; days: number[] }>;
}

export interface SleepPolicy {
  idleMinutes?: number | null;
}

export interface ServiceProxy {
  mode: 'direct' | 'http' | 'socks';
  host?: string;
  port?: number;
  username?: string;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type ServiceState = 'loading' | 'ready' | 'sleeping' | 'crashed';

export interface DeclarativeUnreadSpec {
  selector?: string;
  read?: 'text' | 'attr';
  attr?: string;
  regex?: string;
  titleRegex?: string;
}

export interface Recipe {
  id: string;
  name: string;
  category: ServiceCategory;
  startUrl: string;
  allowedDomains: string[];
  defaultUserAgent?: string;
  getUnread?: (doc: Document) => UnreadCount;
  /** Declarative unread spec (title regex / selector) — evaluated in-page, no per-service code. */
  unread?: DeclarativeUnreadSpec;
  pollIntervalMs?: number;
  isLauncherOnly?: boolean;
  launcherHint?: string;
}

export interface RecipeCatalogItem {
  id: string;
  name: string;
  category: ServiceCategory;
  startUrl: string | null;
  allowedDomains: string[];
  defaultUserAgent?: string;
  unreadSpec?: DeclarativeUnreadSpec | null;
  isLauncherOnly?: boolean;
  launcherHint?: string;
  source: 'builtin' | 'custom';
}

export interface ResolvedRecipeForInstance {
  instanceId: string;
  recipeId: string;
  startUrl: string | null;
  allowedDomains: string[];
  defaultUserAgent?: string;
  unreadSpec?: DeclarativeUnreadSpec | null;
  builtinUnreadId?: string;
  pollIntervalMs: number;
  isLauncherOnly: boolean;
  mobileMode: boolean;
  customCss?: string | null;
  customJs?: string | null;
}

export type SyncRecordType =
  | 'workspace'
  | 'profile'
  | 'customRecipe'
  | 'serviceInstance'
  | 'workspaceService'
  | 'layout';

export interface SyncRecord {
  type: SyncRecordType;
  id: string;
  rev: number;
  updatedAt: number;
  deletedAt: number | null;
  originDevice: string;
  data: Record<string, unknown>;
}

export interface VaultPlaintext {
  schemaVersion: number;
  records: SyncRecord[];
}

export interface SyncResult {
  applied: number;
  conflicts: number;
}

export interface PaletteItem {
  type: 'service' | 'workspace' | 'command' | 'notification';
  id: string;
  label: string;
  sublabel?: string;
  action: string;
  instanceId?: string;
}

export interface NotificationRecord {
  id: number;
  instance_id: string;
  title: string;
  body: string;
  icon: string | null;
  created_at: number;
  read_at: number | null;
  snoozed_until: number | null;
}

export interface ExtensionRecord {
  id: string;
  name: string;
  path: string;
  enabled: boolean;
  created_at: number;
}

export interface ServiceTab {
  id: string;
  service_instance_id: string;
  url: string;
  title: string | null;
  position: number;
  active: boolean;
  created_at: number;
}

export interface AiStatus {
  configured: boolean;
  model: string;
}

export interface AiBrief {
  text: string;
}

export interface TriageItem {
  notificationId: number;
  instanceId: string;
  priority: 'high' | 'normal' | 'low';
  reason: string;
}

export interface AppMetrics {
  totalMemoryMB: number;
  processes: Array<{ type: string; name: string; memoryMB: number }>;
}

export interface SyncStatus {
  configured: boolean;
  folderPath?: string;
  lastSyncAt?: number;
  pendingConflicts: number;
}

export interface FerdiumImportResult {
  created: number;
  skipped: number;
}
