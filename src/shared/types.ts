export type ServiceCategory =
  | 'Chat'
  | 'Email'
  | 'Social'
  | 'Dev'
  | 'AI'
  | 'Productivity'
  | 'Media'
  | 'Other';

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
  parent_id: string | null;
  name: string;
  icon: string | null;
  color: string | null;
  position: number;
  disabled: boolean;
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
  icon_path: string | null;
  pinned: boolean;
  muted: boolean;
  disabled: boolean;
  sleep_policy: SleepPolicy;
  custom_css: string | null;
  custom_js: string | null;
  proxy: ServiceProxy | null;
  user_agent: string | null;
  last_url: string | null;
  zoom_factor: number | null;
  spellcheck: boolean;
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
  /** How an idle service is parked: doze keeps notifications alive; deep frees the renderer. */
  mode?: 'auto' | 'doze' | 'deep';
  /** Escalate a dozing service to deep sleep after this many further idle minutes. */
  deepAfterMinutes?: number | null;
}

export interface ServiceProxy {
  mode: 'direct' | 'http' | 'socks' | 'socks4' | 'socks5';
  host?: string;
  port?: number;
  username?: string;
  bypassRules?: string;
}

export interface RecipeRegistryEntry {
  id: string;
  name: string;
  category: ServiceCategory;
  start_url: string;
  allowed_domains: string[];
  aliases: string[];
  icon: string | null;
  icon_path: string | null;
  default_user_agent: string | null;
  unread_spec: DeclarativeUnreadSpec | null;
  mobile_mode: boolean;
  source: 'seed' | 'community' | 'user';
  created_at: number;
  updated_at: number;
}

export interface RecipePackValidation {
  valid: boolean;
  imported: number;
  skipped: number;
  issues: string[];
  entries: Array<Pick<RecipeRegistryEntry, 'id' | 'name' | 'category' | 'start_url' | 'source'>>;
}

export interface LinkRule {
  id: string;
  name: string;
  priority: number;
  match_type: 'exact' | 'domain' | 'contains' | 'regex';
  pattern: string;
  target_type: 'service' | 'workspace' | 'profile' | 'external';
  target_id: string | null;
  enabled: boolean;
  created_at: number;
  updated_at: number;
}

export interface LinkRuleTestResult {
  matched: boolean;
  rule?: LinkRule;
  targetServiceId?: string | null;
  external: boolean;
}

export interface Dashboard {
  id: string;
  workspace_id: string | null;
  name: string;
  widgets: DashboardWidget[];
  created_at: number;
  updated_at: number;
}

export interface DashboardWidget {
  id: string;
  type: 'shortcuts' | 'notifications' | 'tasks' | 'unread' | 'notes' | 'clock' | 'savedTabs';
  title: string;
  config: Record<string, unknown>;
}

export interface ShortcutBinding {
  id: string;
  command: string;
  accelerator: string;
  scope: 'global' | 'workspace' | 'service';
  target_id: string | null;
  enabled: boolean;
  created_at: number;
  updated_at: number;
}

export interface PermissionPolicy {
  id: string;
  service_instance_id: string | null;
  permission: string;
  decision: 'ask' | 'allow' | 'deny';
  updated_at: number;
}

export interface DownloadRecord {
  id: string;
  service_instance_id: string | null;
  url: string;
  filename: string;
  mime_type: string | null;
  total_bytes: number | null;
  received_bytes: number;
  state: 'progressing' | 'completed' | 'cancelled' | 'interrupted';
  path: string | null;
  started_at: number;
  completed_at: number | null;
}

export interface MigrationPreviewItem {
  name: string;
  recipeId: string | null;
  url: string | null;
  importable: boolean;
  reason: string | null;
  willCreateCustomRecipe: boolean;
}

export interface MigrationPreview {
  source: 'ferdium' | 'franz' | 'rambox' | 'webcatalog' | 'shift' | 'bookmarks' | 'unknown';
  total: number;
  importable: number;
  skipped: number;
  items: MigrationPreviewItem[];
  rollbackExport: string;
}

export interface MigrationRunResult extends FerdiumImportResult {
  source: MigrationPreview['source'];
  rollbackExport: string;
}

export interface SavedTabSession {
  id: string;
  workspace_id: string | null;
  name: string;
  service_ids: string[];
  created_at: number;
}

export interface DashboardSnapshot {
  dashboards: Dashboard[];
  services: Array<
    Pick<ServiceInstance, 'id' | 'display_name' | 'color' | 'pinned' | 'muted' | 'disabled'>
  >;
  tasks: Task[];
  notifications: NotificationRecord[];
  downloads: DownloadRecord[];
  shortcuts: ShortcutBinding[];
  savedSessions: SavedTabSession[];
  unreadTotal: number;
  generatedAt: number;
}

export interface TrackerStats {
  enabled: boolean;
  blockedTotal: number;
  topHosts: Array<{ host: string; count: number }>;
}

export interface TrustStatus {
  tracker: TrackerStats;
  vault: {
    safe: boolean;
    syncs: string[];
    neverSyncs: string[];
    recordCount: number;
    error: string | null;
  };
  release: Array<{ label: string; ok: boolean; detail: string }>;
}

export interface PerformanceStatus extends AppMetrics {
  serviceCount: number;
  disabledServiceCount: number;
  suggestions: Array<{ level: 'info' | 'warning'; title: string; detail: string }>;
}

export type AutomationTriggerType =
  | 'notification'
  | 'unreadThreshold'
  | 'schedule'
  | 'startup'
  | 'manual';

export interface AutomationTrigger {
  type: AutomationTriggerType;
  serviceId?: string | null;
  matchText?: string;
  unreadAtLeast?: number;
  schedule?: Array<{ from: string; to: string; days: number[] }>;
}

export type AutomationActionType =
  | 'openWorkspace'
  | 'openService'
  | 'runAiPrompt'
  | 'createTask'
  | 'setFocusMode'
  | 'sleepService'
  | 'wakeService';

export interface AutomationAction {
  type: AutomationActionType;
  targetId?: string | null;
  value?: string;
}

export interface AutomationRule {
  id: string;
  name: string;
  enabled: boolean;
  trigger: AutomationTrigger;
  actions: AutomationAction[];
  last_run_at: number | null;
  created_at: number;
  updated_at: number;
}

export interface AutomationTestResult {
  matched: boolean;
  reasons: string[];
  actions: AutomationAction[];
}

export interface FocusMode {
  id: string;
  name: string;
  enabled: boolean;
  workspace_id: string | null;
  schedule: Array<{ from: string; to: string; days: number[] }>;
  settings: {
    muteNotifications?: boolean;
    hideMutedServices?: boolean;
    sleepIdleMinutes?: number | null;
    allowedServiceIds?: string[];
    blockedServiceIds?: string[];
  };
  created_at: number;
  updated_at: number;
}

export interface FocusModeStatus {
  activeMode: FocusMode | null;
  nextMode: FocusMode | null;
  now: number;
}

export interface BrowserImportItem {
  title: string;
  url: string;
  folder: string | null;
  importable: boolean;
  reason: string | null;
  recipeId: string | null;
  willCreateCustomRecipe: boolean;
}

export interface BrowserImportPreview {
  source: 'chrome' | 'edge' | 'firefox' | 'bookmarks' | 'unknown';
  total: number;
  importable: number;
  skipped: number;
  items: BrowserImportItem[];
}

export interface RecipeStudioAnalysis {
  valid: boolean;
  recipe: Partial<RecipeRegistryEntry>;
  issues: string[];
  suggestions: string[];
}

export interface LocalExtensionTemplate {
  id: string;
  name: string;
  description: string;
  category: 'reading' | 'privacy' | 'developer' | 'appearance' | 'workflow';
  enabledByDefault: boolean;
  capabilities: string[];
}

export interface PrivacyFirewallRule {
  id: string;
  service_instance_id: string | null;
  rule_type: 'domain' | 'cookie' | 'permission' | 'download' | 'clipboard' | 'script';
  pattern: string;
  action: 'allow' | 'block' | 'ask';
  enabled: boolean;
  created_at: number;
  updated_at: number;
}

export interface PrivacyFirewallTestResult {
  matched: boolean;
  action: 'allow' | 'block' | 'ask';
  rule: PrivacyFirewallRule | null;
}

export interface WorkspaceSnapshot {
  id: string;
  workspace_id: string;
  name: string;
  payload: {
    layout: Layout | null;
    services: ServiceInstance[];
    focusModes: FocusMode[];
    selectedServiceIds: string[];
    createdFrom: string;
  };
  created_at: number;
}

export interface PersonalAnalytics {
  generatedAt: number;
  totalServices: number;
  activeServices: number;
  mutedServices: number;
  pinnedServices: number;
  unreadTotal: number;
  notificationVolume: number;
  completedTasks: number;
  openTasks: number;
  trackerBlocks: TrackerStats;
  noisyServices: Array<{ serviceId: string; name: string; notifications: number }>;
  memoryTop: Array<{ type: string; name: string; memoryMB: number }>;
}

export interface PortableModeStatus {
  enabled: boolean;
  rootPath: string | null;
  recommendedPaths: string[];
  notes: string[];
}

export interface PeerSyncPeer {
  id: string;
  label: string;
  endpoint: string;
  enabled: boolean;
  last_seen_at: number | null;
  created_at: number;
  updated_at: number;
}

export interface PeerSyncStatus {
  deviceId: string;
  peers: PeerSyncPeer[];
  localEndpoint?: string | null;
  discoveryHint: string;
}

export interface PeerSyncRunResult extends SyncResult {
  peerId: string;
  status: 'synced' | 'skipped' | 'failed';
  error?: string;
}

export interface RepairStatus {
  integrityOk: boolean;
  integrityMessages: string[];
  invalidLastUrls: string[];
  missingRecipes: string[];
  safeModeRecommended: boolean;
}

export interface RepairResult extends RepairStatus {
  fixed: number;
}

export interface WorkKit {
  id: string;
  name: string;
  description: string;
  payload: {
    workspaceName: string;
    services: Array<{ name: string; url: string; category: ServiceCategory }>;
    focusMode?: Partial<FocusMode>;
    aiPrompts?: Array<{ title: string; prompt: string }>;
    linkRules?: Array<
      Partial<LinkRule> & Pick<LinkRule, 'name' | 'match_type' | 'pattern' | 'target_type'>
    >;
    dashboards?: Array<{ name: string; widgets?: DashboardWidget[] }>;
    automations?: Array<
      Partial<AutomationRule> & Pick<AutomationRule, 'name' | 'trigger' | 'actions'>
    >;
  };
  built_in: boolean;
  created_at: number;
  updated_at: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type ServiceState = 'loading' | 'ready' | 'sleeping' | 'dozing' | 'crashed';

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
  aliases?: string[];
  icon?: string | null;
  iconPath?: string | null;
  defaultUserAgent?: string;
  unreadSpec?: DeclarativeUnreadSpec | null;
  isLauncherOnly?: boolean;
  launcherHint?: string;
  mobileMode?: boolean;
  source: 'builtin' | 'custom' | 'registry';
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
  type:
    | 'service'
    | 'workspace'
    | 'command'
    | 'notification'
    | 'task'
    | 'download'
    | 'shortcut'
    | 'dashboard'
    | 'linkRule'
    | 'recipe'
    | 'automation'
    | 'focusMode'
    | 'snapshot'
    | 'workKit'
    | 'firewallRule';
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

export type AiProvider = 'anthropic' | 'openai' | 'gemini' | 'ollama' | 'compatible';

export interface AiStatus {
  configured: boolean;
  provider: AiProvider;
  model: string;
  baseUrl: string | null;
  localOnly: boolean;
}

export interface AiBrief {
  text: string;
}

export interface AiPrompt {
  id: string;
  title: string;
  prompt: string;
  provider: AiProvider | null;
  model: string | null;
  local_only: boolean;
  created_at: number;
  updated_at: number;
}

export interface AiPromptRunResult {
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
  lastError?: string;
}

export interface FerdiumImportResult {
  created: number;
  skipped: number;
}
