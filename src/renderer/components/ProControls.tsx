import {
  Crown,
  Moon,
  Plus,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  X
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type {
  AiPrompt,
  AutomationRule,
  AppMetrics,
  BrowserImportPreview,
  Dashboard,
  DownloadRecord,
  ExtensionRecord,
  FocusMode,
  FocusModeStatus,
  LinkRule,
  LinkRuleTestResult,
  LocalExtensionTemplate,
  MigrationPreview,
  PermissionPolicy,
  PeerSyncStatus,
  PersonalAnalytics,
  PerformanceStatus,
  PortableModeStatus,
  PrivacyFirewallRule,
  RecipeCatalogItem,
  RecipePackValidation,
  RecipeRegistryEntry,
  RecipeStudioAnalysis,
  RepairStatus,
  ShortcutBinding,
  ServiceCategory,
  ServiceInstance,
  ServiceProxy,
  TrustStatus,
  WorkKit,
  Workspace,
  WorkspaceSnapshot
} from '../../shared/types';
import { api } from '../ipc/client';
import { useAppStore, type ProControlsPanel } from '../state/appStore';

const CATEGORIES: ServiceCategory[] = [
  'Chat',
  'Email',
  'Social',
  'AI',
  'Productivity',
  'Dev',
  'Media',
  'Other'
];
const DEFAULT_WORKSPACE_COLOR = '#2dd4bf';
const DEFAULT_PROFILE_COLOR = '#3b82f6';
const COLORS = [
  DEFAULT_WORKSPACE_COLOR,
  DEFAULT_PROFILE_COLOR,
  '#a855f7',
  '#f59e0b',
  '#ef4444',
  '#22c55e',
  '#64748b'
];

type Panel = ProControlsPanel;

export function ProControls(): JSX.Element | null {
  const {
    proControlsOpen,
    proControlsPanel,
    setProControlsOpen,
    setProControlsPanel,
    workspaces,
    profiles,
    services,
    selectedWorkspaceId,
    selectedServiceIds,
    createWorkspace,
    updateWorkspace,
    deleteWorkspace,
    createProfile,
    updateProfile,
    deleteProfile,
    updateService,
    deleteService,
    sleepService,
    wakeService,
    createCustomService,
    createService,
    settings,
    setSettingValue,
    syncStatus,
    syncNow,
    load
  } = useAppStore();
  const [panel, setPanel] = useState<Panel>('workspaces');
  const [extensions, setExtensions] = useState<ExtensionRecord[]>([]);
  const [metrics, setMetrics] = useState<AppMetrics | null>(null);
  const [repairStatus, setRepairStatus] = useState<RepairStatus | null>(null);
  const [registryStats, setRegistryStats] = useState<{
    total: number;
    seed: number;
    community: number;
    user: number;
  } | null>(null);
  const [linkRules, setLinkRules] = useState<LinkRule[]>([]);
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [shortcuts, setShortcuts] = useState<ShortcutBinding[]>([]);
  const [permissions, setPermissions] = useState<PermissionPolicy[]>([]);
  const [downloads, setDownloads] = useState<DownloadRecord[]>([]);
  const [trustStatus, setTrustStatus] = useState<TrustStatus | null>(null);
  const [performanceStatus, setPerformanceStatus] = useState<PerformanceStatus | null>(null);
  const [aiPrompts, setAiPrompts] = useState<AiPrompt[]>([]);
  const [automations, setAutomations] = useState<AutomationRule[]>([]);
  const [focusModes, setFocusModes] = useState<FocusMode[]>([]);
  const [focusStatus, setFocusStatus] = useState<FocusModeStatus | null>(null);
  const [extensionTemplates, setExtensionTemplates] = useState<LocalExtensionTemplate[]>([]);
  const [firewallRules, setFirewallRules] = useState<PrivacyFirewallRule[]>([]);
  const [snapshots, setSnapshots] = useState<WorkspaceSnapshot[]>([]);
  const [analytics, setAnalytics] = useState<PersonalAnalytics | null>(null);
  const [portableStatus, setPortableStatus] = useState<PortableModeStatus | null>(null);
  const [peerStatus, setPeerStatus] = useState<PeerSyncStatus | null>(null);
  const [workKits, setWorkKits] = useState<WorkKit[]>([]);

  useEffect(() => {
    if (!proControlsOpen) return;
    setPanel(proControlsPanel);
  }, [proControlsOpen, proControlsPanel]);

  useEffect(() => {
    if (!proControlsOpen) return;
    void api.extensions.list().then(setExtensions);
    void api.metrics.get().then(setMetrics);
    void api.repair.status().then(setRepairStatus);
    void api.registry.stats().then(setRegistryStats);
    void api.linkRules.list().then(setLinkRules);
    void api.dashboards.list(selectedWorkspaceId).then(setDashboards);
    void api.shortcuts.list().then(setShortcuts);
    void api.permissions.list().then(setPermissions);
    void api.downloads.list(100).then(setDownloads);
    void api.trust.status().then(setTrustStatus);
    void api.performance.status().then(setPerformanceStatus);
    void api.aiPrompts.list().then(setAiPrompts);
    void api.automations.list().then(setAutomations);
    void api.focusModes.list().then(setFocusModes);
    void api.focusModes.status().then(setFocusStatus);
    void api.extensionPack.list().then(setExtensionTemplates);
    void api.firewall.list().then(setFirewallRules);
    void api.snapshots.list(selectedWorkspaceId).then(setSnapshots);
    void api.analytics.personal().then(setAnalytics);
    void api.portable.status().then(setPortableStatus);
    void api.peerSync.status().then(setPeerStatus);
    void api.workKits.list().then(setWorkKits);
  }, [proControlsOpen, selectedWorkspaceId]);

  const setActivePanel = (nextPanel: Panel): void => {
    setPanel(nextPanel);
    setProControlsPanel(nextPanel);
  };

  const activeService = useMemo(
    () => services.find((service) => service.id === selectedServiceIds[0]) ?? services[0] ?? null,
    [selectedServiceIds, services]
  );
  const activeWorkspace =
    workspaces.find((workspace) => workspace.id === selectedWorkspaceId) ?? workspaces[0] ?? null;

  if (!proControlsOpen) return null;

  const refreshExtensions = (): void => void api.extensions.list().then(setExtensions);
  const refreshRules = (): void => void api.linkRules.list().then(setLinkRules);
  const refreshDashboards = (): void =>
    void api.dashboards.list(selectedWorkspaceId).then(setDashboards);
  const refreshShortcuts = (): void => void api.shortcuts.list().then(setShortcuts);
  const refreshPermissions = (): void => void api.permissions.list().then(setPermissions);
  const refreshDownloads = (): void => void api.downloads.list(100).then(setDownloads);
  const refreshTrust = (): void => void api.trust.status().then(setTrustStatus);
  const refreshPerformance = (): void => void api.performance.status().then(setPerformanceStatus);
  const refreshAiPrompts = (): void => void api.aiPrompts.list().then(setAiPrompts);
  const refreshAutomations = (): void => void api.automations.list().then(setAutomations);
  const refreshFocusModes = (): void => {
    void api.focusModes.list().then(setFocusModes);
    void api.focusModes.status().then(setFocusStatus);
  };
  const refreshFirewall = (): void => void api.firewall.list().then(setFirewallRules);
  const refreshSnapshots = (): void =>
    void api.snapshots.list(selectedWorkspaceId).then(setSnapshots);
  const refreshAnalytics = (): void => void api.analytics.personal().then(setAnalytics);
  const refreshPortable = (): void => void api.portable.status().then(setPortableStatus);
  const refreshPeerSync = (): void => void api.peerSync.status().then(setPeerStatus);
  const refreshWorkKits = (): void => void api.workKits.list().then(setWorkKits);

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/55">
      <section className="flex h-[86vh] w-[1040px] max-w-[94vw] overflow-hidden rounded-md border border-line bg-panel shadow-2xl">
        <aside className="flex w-56 shrink-0 flex-col overflow-y-auto border-r border-line bg-shell">
          <div className="flex h-12 items-center gap-2 border-b border-line px-3">
            <Crown size={17} className="text-accent" />
            <span className="text-sm font-semibold">Control Center</span>
          </div>
          <NavButton panel={panel} id="workspaces" label="Workspaces" setPanel={setActivePanel} />
          <NavButton panel={panel} id="catalog" label="Catalog" setPanel={setActivePanel} />
          <NavButton panel={panel} id="profiles" label="Profiles" setPanel={setActivePanel} />
          <NavButton panel={panel} id="service" label="Active Service" setPanel={setActivePanel} />
          <NavButton panel={panel} id="links" label="Link Rules" setPanel={setActivePanel} />
          <NavButton panel={panel} id="dashboard" label="Dashboard" setPanel={setActivePanel} />
          <NavButton panel={panel} id="custom" label="Custom App" setPanel={setActivePanel} />
          <NavButton panel={panel} id="extensions" label="Extensions" setPanel={setActivePanel} />
          <NavButton panel={panel} id="privacy" label="Privacy" setPanel={setActivePanel} />
          <NavButton panel={panel} id="trust" label="Trust" setPanel={setActivePanel} />
          <NavButton panel={panel} id="firewall" label="Firewall" setPanel={setActivePanel} />
          <NavButton panel={panel} id="performance" label="Performance" setPanel={setActivePanel} />
          <NavButton panel={panel} id="analytics" label="Analytics" setPanel={setActivePanel} />
          <NavButton panel={panel} id="ai" label="AI Workflows" setPanel={setActivePanel} />
          <NavButton panel={panel} id="automations" label="Automations" setPanel={setActivePanel} />
          <NavButton panel={panel} id="focus" label="Focus Modes" setPanel={setActivePanel} />
          <NavButton
            panel={panel}
            id="browserImport"
            label="Browser Import"
            setPanel={setActivePanel}
          />
          <NavButton
            panel={panel}
            id="recipeStudio"
            label="Recipe Studio"
            setPanel={setActivePanel}
          />
          <NavButton
            panel={panel}
            id="extensionPack"
            label="Extension Pack"
            setPanel={setActivePanel}
          />
          <NavButton panel={panel} id="snapshots" label="Snapshots" setPanel={setActivePanel} />
          <NavButton panel={panel} id="workKits" label="Work Kits" setPanel={setActivePanel} />
          <NavButton panel={panel} id="portable" label="Portable" setPanel={setActivePanel} />
          <NavButton panel={panel} id="peerSync" label="Peer Sync" setPanel={setActivePanel} />
          <NavButton panel={panel} id="downloads" label="Downloads" setPanel={setActivePanel} />
          <NavButton panel={panel} id="shortcuts" label="Shortcuts" setPanel={setActivePanel} />
          <NavButton panel={panel} id="sync" label="Sync" setPanel={setActivePanel} />
          <NavButton panel={panel} id="import" label="Import" setPanel={setActivePanel} />
          <NavButton panel={panel} id="diagnostics" label="Diagnostics" setPanel={setActivePanel} />
          <div className="mt-auto border-t border-line p-3 text-xs text-muted">
            <ShieldCheck size={15} className="mb-2 text-accent" />
            Free, local-first, unlimited.
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-12 shrink-0 items-center justify-between border-b border-line px-4">
            <div className="text-sm font-semibold">{titleFor(panel)}</div>
            <button className="icon-button" title="Close" onClick={() => setProControlsOpen(false)}>
              <X size={16} />
            </button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {panel === 'workspaces' && (
              <WorkspacePanel
                workspaces={workspaces}
                activeWorkspace={activeWorkspace}
                createWorkspace={createWorkspace}
                updateWorkspace={updateWorkspace}
                deleteWorkspace={deleteWorkspace}
              />
            )}
            {panel === 'catalog' && (
              <CatalogPanel stats={registryStats} createService={createService} />
            )}
            {panel === 'profiles' && (
              <ProfilePanel
                profiles={profiles}
                createProfile={createProfile}
                updateProfile={updateProfile}
                deleteProfile={deleteProfile}
              />
            )}
            {panel === 'service' && (
              <ServicePanel
                service={activeService}
                profiles={profiles}
                updateService={updateService}
                deleteService={deleteService}
                sleepService={sleepService}
                wakeService={wakeService}
              />
            )}
            {panel === 'links' && (
              <LinkRulesPanel
                rules={linkRules}
                services={services}
                workspaces={workspaces}
                profiles={profiles}
                refresh={refreshRules}
              />
            )}
            {panel === 'dashboard' && (
              <DashboardPanel
                dashboards={dashboards}
                selectedWorkspaceId={selectedWorkspaceId}
                refresh={refreshDashboards}
              />
            )}
            {panel === 'custom' && (
              <CustomAppPanel profiles={profiles} createCustomService={createCustomService} />
            )}
            {panel === 'extensions' && (
              <ExtensionPanel extensions={extensions} refresh={refreshExtensions} />
            )}
            {panel === 'privacy' && (
              <PrivacyPanel
                permissions={permissions}
                services={services}
                settings={settings}
                setSettingValue={setSettingValue}
                refresh={refreshPermissions}
              />
            )}
            {panel === 'trust' && <TrustPanel status={trustStatus} refresh={refreshTrust} />}
            {panel === 'firewall' && (
              <FirewallPanel rules={firewallRules} services={services} refresh={refreshFirewall} />
            )}
            {panel === 'performance' && (
              <PerformancePanel status={performanceStatus} refresh={refreshPerformance} />
            )}
            {panel === 'analytics' && (
              <AnalyticsPanel analytics={analytics} refresh={refreshAnalytics} />
            )}
            {panel === 'ai' && <AiWorkflowPanel prompts={aiPrompts} refresh={refreshAiPrompts} />}
            {panel === 'automations' && (
              <AutomationsPanel
                automations={automations}
                services={services}
                workspaces={workspaces}
                aiPrompts={aiPrompts}
                refresh={refreshAutomations}
              />
            )}
            {panel === 'focus' && (
              <FocusModesPanel
                modes={focusModes}
                status={focusStatus}
                workspaces={workspaces}
                services={services}
                refresh={refreshFocusModes}
              />
            )}
            {panel === 'browserImport' && (
              <BrowserImportPanel
                workspaces={workspaces}
                selectedWorkspaceId={selectedWorkspaceId}
                load={load}
              />
            )}
            {panel === 'recipeStudio' && (
              <RecipeStudioPanel
                refreshCatalog={() => void api.registry.stats().then(setRegistryStats)}
              />
            )}
            {panel === 'extensionPack' && <ExtensionPackPanel templates={extensionTemplates} />}
            {panel === 'snapshots' && (
              <SnapshotsPanel
                snapshots={snapshots}
                selectedWorkspaceId={selectedWorkspaceId}
                refresh={refreshSnapshots}
                load={load}
              />
            )}
            {panel === 'workKits' && (
              <WorkKitsPanel kits={workKits} refresh={refreshWorkKits} load={load} />
            )}
            {panel === 'portable' && (
              <PortablePanel status={portableStatus} refresh={refreshPortable} />
            )}
            {panel === 'peerSync' && (
              <PeerSyncPanel status={peerStatus} refresh={refreshPeerSync} />
            )}
            {panel === 'downloads' && (
              <DownloadsPanel downloads={downloads} refresh={refreshDownloads} />
            )}
            {panel === 'shortcuts' && (
              <ShortcutsPanel shortcuts={shortcuts} refresh={refreshShortcuts} />
            )}
            {panel === 'sync' && <SyncPanel syncStatus={syncStatus} syncNow={syncNow} />}
            {panel === 'import' && (
              <ImportPanel
                workspaces={workspaces}
                selectedWorkspaceId={selectedWorkspaceId}
                load={load}
              />
            )}
            {panel === 'diagnostics' && (
              <DiagnosticsPanel
                metrics={metrics}
                setMetrics={setMetrics}
                repairStatus={repairStatus}
                setRepairStatus={setRepairStatus}
              />
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function NavButton({
  panel,
  id,
  label,
  setPanel
}: {
  panel: Panel;
  id: Panel;
  label: string;
  setPanel: (panel: Panel) => void;
}): JSX.Element {
  return (
    <button
      className={`mx-2 mt-2 flex h-9 items-center gap-2 rounded-md px-3 text-left text-sm ${
        panel === id
          ? 'bg-elevated text-ink ring-1 ring-inset ring-accent/50'
          : 'text-muted hover:bg-elevated/60 hover:text-ink'
      }`}
      onClick={() => setPanel(id)}
    >
      <SlidersHorizontal size={14} />
      <span className="truncate">{label}</span>
    </button>
  );
}

function WorkspacePanel({
  workspaces,
  activeWorkspace,
  createWorkspace,
  updateWorkspace,
  deleteWorkspace
}: {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  createWorkspace: (input: {
    name: string;
    icon?: string | null;
    color?: string | null;
    parentId?: string | null;
  }) => Promise<void>;
  updateWorkspace: (id: string, patch: Partial<Workspace>) => Promise<void>;
  deleteWorkspace: (id: string) => Promise<void>;
}): JSX.Element {
  const [name, setName] = useState('');
  const [color, setColor] = useState(DEFAULT_WORKSPACE_COLOR);
  const [parentId, setParentId] = useState('');
  const [editName, setEditName] = useState(activeWorkspace?.name ?? '');
  const [editColor, setEditColor] = useState(activeWorkspace?.color ?? DEFAULT_WORKSPACE_COLOR);
  const [editParentId, setEditParentId] = useState(activeWorkspace?.parent_id ?? '');
  const [disabled, setDisabled] = useState(activeWorkspace?.disabled ?? false);
  const [dnd, setDnd] = useState(activeWorkspace?.focus_rules.dnd ?? false);
  const [scheduleFrom, setScheduleFrom] = useState(
    activeWorkspace?.focus_rules.schedule?.[0]?.from ?? ''
  );
  const [scheduleTo, setScheduleTo] = useState(
    activeWorkspace?.focus_rules.schedule?.[0]?.to ?? ''
  );
  const [idleMinutes, setIdleMinutes] = useState(
    String(activeWorkspace?.sleep_defaults.idleMinutes ?? '')
  );

  useEffect(() => {
    setEditName(activeWorkspace?.name ?? '');
    setEditColor(activeWorkspace?.color ?? DEFAULT_WORKSPACE_COLOR);
    setEditParentId(activeWorkspace?.parent_id ?? '');
    setDisabled(activeWorkspace?.disabled ?? false);
    setDnd(activeWorkspace?.focus_rules.dnd ?? false);
    setScheduleFrom(activeWorkspace?.focus_rules.schedule?.[0]?.from ?? '');
    setScheduleTo(activeWorkspace?.focus_rules.schedule?.[0]?.to ?? '');
    setIdleMinutes(String(activeWorkspace?.sleep_defaults.idleMinutes ?? ''));
  }, [activeWorkspace]);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.3fr]">
      <section className="panel rounded-md p-3">
        <div className="mb-3 text-sm font-semibold">Create Workspace</div>
        <div className="space-y-2">
          <input
            className="field w-full"
            value={name}
            placeholder="Workspace name"
            onChange={(event) => setName(event.target.value)}
          />
          <ColorRow value={color} onChange={setColor} />
          <select
            className="field w-full"
            value={parentId}
            onChange={(event) => setParentId(event.target.value)}
          >
            <option value="">Top level</option>
            {workspaces.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>
                {workspace.name}
              </option>
            ))}
          </select>
          <button
            className="app-button w-full"
            disabled={!name.trim()}
            onClick={() =>
              void createWorkspace({
                name: name.trim(),
                icon: 'briefcase',
                color,
                parentId: parentId || null
              }).then(() => {
                setName('');
                setParentId('');
              })
            }
          >
            <Plus size={15} />
            Create
          </button>
        </div>
      </section>

      <section className="panel rounded-md p-3">
        <div className="mb-3 text-sm font-semibold">Current Workspace</div>
        {activeWorkspace ? (
          <div className="space-y-3">
            <div className="grid grid-cols-[1fr_150px] gap-2">
              <input
                className="field"
                value={editName}
                onChange={(event) => setEditName(event.target.value)}
              />
              <input
                className="field"
                value={editColor}
                onChange={(event) => setEditColor(event.target.value)}
              />
            </div>
            <select
              className="field w-full"
              value={editParentId}
              onChange={(event) => setEditParentId(event.target.value)}
            >
              <option value="">Top level</option>
              {workspaces
                .filter((workspace) => workspace.id !== activeWorkspace.id)
                .map((workspace) => (
                  <option key={workspace.id} value={workspace.id}>
                    {workspace.name}
                  </option>
                ))}
            </select>
            <ColorRow value={editColor} onChange={setEditColor} />
            <div className="grid grid-cols-2 gap-2">
              <label className="flex items-center gap-2 rounded-md border border-line p-2 text-sm">
                <input
                  type="checkbox"
                  checked={dnd}
                  onChange={(event) => setDnd(event.target.checked)}
                />
                Focus mode
              </label>
              <label className="flex items-center gap-2 rounded-md border border-line p-2 text-sm">
                <input
                  type="checkbox"
                  checked={disabled}
                  onChange={(event) => setDisabled(event.target.checked)}
                />
                Disabled
              </label>
              <input
                className="field"
                value={idleMinutes}
                placeholder="Sleep idle minutes"
                onChange={(event) => setIdleMinutes(event.target.value)}
              />
              <input
                className="field"
                value={scheduleFrom}
                placeholder="Focus from 09:00"
                onChange={(event) => setScheduleFrom(event.target.value)}
              />
              <input
                className="field"
                value={scheduleTo}
                placeholder="Focus to 17:00"
                onChange={(event) => setScheduleTo(event.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                className="app-button"
                disabled={!editName.trim()}
                onClick={() =>
                  void updateWorkspace(activeWorkspace.id, {
                    name: editName.trim(),
                    parent_id: editParentId || null,
                    color: editColor.trim() || null,
                    disabled,
                    focus_rules: {
                      ...activeWorkspace.focus_rules,
                      dnd,
                      schedule:
                        scheduleFrom.trim() && scheduleTo.trim()
                          ? [
                              {
                                from: scheduleFrom.trim(),
                                to: scheduleTo.trim(),
                                days: [1, 2, 3, 4, 5]
                              }
                            ]
                          : undefined
                    },
                    sleep_defaults: { idleMinutes: numberOrNull(idleMinutes) }
                  })
                }
              >
                Save
              </button>
              <button
                className="app-button"
                disabled={workspaces.length <= 1}
                onClick={() => void deleteWorkspace(activeWorkspace.id)}
              >
                <Trash2 size={15} />
                Delete
              </button>
            </div>
          </div>
        ) : (
          <EmptyState label="No workspace selected." />
        )}
      </section>

      <section className="panel rounded-md p-3 lg:col-span-2">
        <div className="mb-3 text-sm font-semibold">All Workspaces</div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {workspaces.map((workspace) => (
            <div
              key={workspace.id}
              className="flex items-center gap-2 rounded-md border border-line p-2"
            >
              <span
                className="h-4 w-4 rounded-full"
                style={{ backgroundColor: workspace.color ?? DEFAULT_WORKSPACE_COLOR }}
              />
              <span className="min-w-0 flex-1 truncate text-sm">{workspace.name}</span>
              {workspace.parent_id && (
                <span className="rounded bg-elevated px-1.5 py-0.5 text-[11px] text-muted">
                  nested
                </span>
              )}
              {workspace.disabled && (
                <span className="rounded bg-elevated px-1.5 py-0.5 text-[11px] text-muted">
                  disabled
                </span>
              )}
              {workspace.focus_rules.dnd && (
                <span className="rounded bg-elevated px-1.5 py-0.5 text-[11px] text-muted">
                  focus
                </span>
              )}
              <button
                className="app-button h-7 px-2 text-xs"
                onClick={() =>
                  void updateWorkspace(workspace.id, { disabled: !workspace.disabled })
                }
              >
                {workspace.disabled ? 'Enable' : 'Disable'}
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function ProfilePanel({
  profiles,
  createProfile,
  updateProfile,
  deleteProfile
}: {
  profiles: ReturnType<typeof useAppStore.getState>['profiles'];
  createProfile: (input: {
    label: string;
    color?: string | null;
    note?: string | null;
  }) => Promise<void>;
  updateProfile: (
    id: string,
    patch: Partial<ReturnType<typeof useAppStore.getState>['profiles'][number]>
  ) => Promise<void>;
  deleteProfile: (id: string) => Promise<void>;
}): JSX.Element {
  const [label, setLabel] = useState('');
  const [color, setColor] = useState(DEFAULT_PROFILE_COLOR);
  const [note, setNote] = useState('');

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <section className="panel rounded-md p-3">
        <div className="mb-3 text-sm font-semibold">Create Profile</div>
        <div className="space-y-2">
          <input
            className="field w-full"
            value={label}
            placeholder="Profile label"
            onChange={(event) => setLabel(event.target.value)}
          />
          <ColorRow value={color} onChange={setColor} />
          <input
            className="field w-full"
            value={note}
            placeholder="Note"
            onChange={(event) => setNote(event.target.value)}
          />
          <button
            className="app-button w-full"
            disabled={!label.trim()}
            onClick={() =>
              void createProfile({ label: label.trim(), color, note: note.trim() || null }).then(
                () => {
                  setLabel('');
                  setNote('');
                }
              )
            }
          >
            <Plus size={15} />
            Create
          </button>
        </div>
      </section>
      <section className="panel rounded-md p-3">
        <div className="mb-3 text-sm font-semibold">Profiles</div>
        <div className="space-y-2">
          {profiles.length === 0 && <EmptyState label="No profiles yet." />}
          {profiles.map((profile) => (
            <EditableProfile
              key={profile.id}
              profile={profile}
              updateProfile={updateProfile}
              deleteProfile={deleteProfile}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function EditableProfile({
  profile,
  updateProfile,
  deleteProfile
}: {
  profile: ReturnType<typeof useAppStore.getState>['profiles'][number];
  updateProfile: (
    id: string,
    patch: Partial<ReturnType<typeof useAppStore.getState>['profiles'][number]>
  ) => Promise<void>;
  deleteProfile: (id: string) => Promise<void>;
}): JSX.Element {
  const [label, setLabel] = useState(profile.label);
  const [color, setColor] = useState(profile.color ?? DEFAULT_PROFILE_COLOR);
  const [note, setNote] = useState(profile.note ?? '');

  useEffect(() => {
    setLabel(profile.label);
    setColor(profile.color ?? DEFAULT_PROFILE_COLOR);
    setNote(profile.note ?? '');
  }, [profile]);

  return (
    <div className="rounded-md border border-line p-2">
      <div className="grid grid-cols-[1fr_120px_auto] gap-2">
        <input className="field" value={label} onChange={(event) => setLabel(event.target.value)} />
        <input className="field" value={color} onChange={(event) => setColor(event.target.value)} />
        <button
          className="icon-button"
          title="Delete profile"
          onClick={() => void deleteProfile(profile.id)}
        >
          <Trash2 size={15} />
        </button>
      </div>
      <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
        <input
          className="field"
          value={note}
          placeholder="Note"
          onChange={(event) => setNote(event.target.value)}
        />
        <button
          className="app-button"
          disabled={!label.trim()}
          onClick={() =>
            void updateProfile(profile.id, {
              label: label.trim(),
              color,
              note: note.trim() || null
            })
          }
        >
          Save
        </button>
      </div>
    </div>
  );
}

function ServicePanel({
  service,
  profiles,
  updateService,
  deleteService,
  sleepService,
  wakeService
}: {
  service: ServiceInstance | null;
  profiles: ReturnType<typeof useAppStore.getState>['profiles'];
  updateService: (id: string, patch: Partial<ServiceInstance>) => Promise<void>;
  deleteService: (id: string, wipeData?: boolean) => Promise<void>;
  sleepService: (id: string) => Promise<void>;
  wakeService: (id: string) => Promise<void>;
}): JSX.Element {
  const [displayName, setDisplayName] = useState(service?.display_name ?? '');
  const [color, setColor] = useState(service?.color ?? DEFAULT_WORKSPACE_COLOR);
  const [profileId, setProfileId] = useState(service?.profile_id ?? '');
  const [muted, setMuted] = useState(service?.muted ?? false);
  const [pinned, setPinned] = useState(service?.pinned ?? false);
  const [disabled, setDisabled] = useState(service?.disabled ?? false);
  const [iconPath, setIconPath] = useState(service?.icon_path ?? '');
  const [idleMinutes, setIdleMinutes] = useState(String(service?.sleep_policy.idleMinutes ?? ''));
  const [zoomFactor, setZoomFactor] = useState(String(service?.zoom_factor ?? 1));
  const [spellcheck, setSpellcheck] = useState(service?.spellcheck ?? true);
  const [userAgent, setUserAgent] = useState(service?.user_agent ?? '');
  const [customCss, setCustomCss] = useState(service?.custom_css ?? '');
  const [customJs, setCustomJs] = useState(service?.custom_js ?? '');
  const [proxyMode, setProxyMode] = useState<ServiceProxy['mode']>(
    service?.proxy?.mode ?? 'direct'
  );
  const [proxyHost, setProxyHost] = useState(service?.proxy?.host ?? '');
  const [proxyPort, setProxyPort] = useState(String(service?.proxy?.port ?? ''));
  const [proxyBypass, setProxyBypass] = useState(service?.proxy?.bypassRules ?? '');
  const [findText, setFindText] = useState('');
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [codePending, setCodePending] = useState(false);

  useEffect(() => {
    if (!service) {
      setCodePending(false);
      return;
    }
    void api.services
      .pendingCustomCode()
      .then((pending) =>
        setCodePending(pending.some((entry) => entry.instanceId === service.id))
      );
  }, [service]);

  useEffect(() => {
    setDisplayName(service?.display_name ?? '');
    setColor(service?.color ?? DEFAULT_WORKSPACE_COLOR);
    setProfileId(service?.profile_id ?? '');
    setMuted(service?.muted ?? false);
    setPinned(service?.pinned ?? false);
    setDisabled(service?.disabled ?? false);
    setIconPath(service?.icon_path ?? '');
    setIdleMinutes(String(service?.sleep_policy.idleMinutes ?? ''));
    setZoomFactor(String(service?.zoom_factor ?? 1));
    setSpellcheck(service?.spellcheck ?? true);
    setUserAgent(service?.user_agent ?? '');
    setCustomCss(service?.custom_css ?? '');
    setCustomJs(service?.custom_js ?? '');
    setProxyMode(service?.proxy?.mode ?? 'direct');
    setProxyHost(service?.proxy?.host ?? '');
    setProxyPort(String(service?.proxy?.port ?? ''));
    setProxyBypass(service?.proxy?.bypassRules ?? '');
    setCurrentUrl(null);
  }, [service]);

  if (!service) return <EmptyState label="Select a service first." />;

  const save = (): void => {
    void updateService(service.id, {
      display_name: displayName.trim(),
      color: color.trim() || null,
      icon_path: iconPath.trim() || null,
      profile_id: profileId || null,
      muted,
      pinned,
      disabled,
      sleep_policy: { idleMinutes: numberOrNull(idleMinutes) },
      proxy: proxyFromFields(proxyMode, proxyHost, proxyPort, proxyBypass),
      user_agent: userAgent.trim() || null,
      zoom_factor: numberOrDefault(zoomFactor, 1),
      spellcheck,
      custom_css: customCss.trim() || null,
      custom_js: customJs.trim() || null
    });
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
      <section className="panel rounded-md p-3">
        <div className="mb-3 text-sm font-semibold">Identity</div>
        <div className="space-y-2">
          <input
            className="field w-full"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
          />
          <ColorRow value={color} onChange={setColor} />
          <select
            className="field w-full"
            value={profileId}
            onChange={(event) => setProfileId(event.target.value)}
          >
            <option value="">No profile</option>
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.label}
              </option>
            ))}
          </select>
          <input
            className="field w-full"
            value={iconPath}
            placeholder="Custom icon path"
            onChange={(event) => setIconPath(event.target.value)}
          />
          <div className="grid grid-cols-2 gap-2">
            <label className="flex items-center gap-2 rounded-md border border-line p-2 text-sm">
              <input
                type="checkbox"
                checked={muted}
                onChange={(event) => setMuted(event.target.checked)}
              />
              Muted
            </label>
            <label className="flex items-center gap-2 rounded-md border border-line p-2 text-sm">
              <input
                type="checkbox"
                checked={pinned}
                onChange={(event) => setPinned(event.target.checked)}
              />
              Pinned
            </label>
            <label className="flex items-center gap-2 rounded-md border border-line p-2 text-sm">
              <input
                type="checkbox"
                checked={disabled}
                onChange={(event) => setDisabled(event.target.checked)}
              />
              Disabled
            </label>
            <label className="flex items-center gap-2 rounded-md border border-line p-2 text-sm">
              <input
                type="checkbox"
                checked={spellcheck}
                onChange={(event) => setSpellcheck(event.target.checked)}
              />
              Spellcheck
            </label>
          </div>
          <input
            className="field w-full"
            value={idleMinutes}
            placeholder="Sleep idle minutes"
            onChange={(event) => setIdleMinutes(event.target.value)}
          />
          <input
            className="field w-full"
            value={zoomFactor}
            placeholder="Zoom factor, e.g. 1.1"
            onChange={(event) => setZoomFactor(event.target.value)}
          />
        </div>
      </section>

      <section className="panel rounded-md p-3">
        <div className="mb-3 text-sm font-semibold">Runtime</div>
        <div className="space-y-2">
          {codePending && (
            <div className="rounded-md border border-amber-400/50 bg-amber-400/10 p-2 text-xs">
              <div className="mb-1 font-semibold">Custom code needs your approval</div>
              <div className="text-muted">
                The custom CSS/JS on this service changed outside this device (sync or import).
                It will not run until you review and approve it here.
              </div>
              <button
                className="app-button mt-2"
                onClick={() =>
                  void api.services.approveCustomCode(service.id).then(() => {
                    setCodePending(false);
                  })
                }
              >
                Approve and run
              </button>
            </div>
          )}
          <input
            className="field w-full"
            value={userAgent}
            placeholder="User agent override"
            onChange={(event) => setUserAgent(event.target.value)}
          />
          <textarea
            className="field h-24 w-full py-2"
            value={customCss}
            placeholder="Custom CSS"
            onChange={(event) => setCustomCss(event.target.value)}
          />
          <textarea
            className="field h-24 w-full py-2"
            value={customJs}
            placeholder="Custom JS"
            onChange={(event) => setCustomJs(event.target.value)}
          />
        </div>
      </section>

      <section className="panel rounded-md p-3 xl:col-span-2">
        <div className="mb-3 text-sm font-semibold">Network And Page</div>
        <div className="grid gap-2 lg:grid-cols-[140px_1fr_120px_1fr]">
          <select
            className="field"
            value={proxyMode}
            onChange={(event) => setProxyMode(event.target.value as ServiceProxy['mode'])}
          >
            {(['direct', 'http', 'socks', 'socks4', 'socks5'] as const).map((mode) => (
              <option key={mode} value={mode}>
                {mode}
              </option>
            ))}
          </select>
          <input
            className="field"
            value={proxyHost}
            placeholder="Proxy host"
            disabled={proxyMode === 'direct'}
            onChange={(event) => setProxyHost(event.target.value)}
          />
          <input
            className="field"
            value={proxyPort}
            placeholder="Port"
            disabled={proxyMode === 'direct'}
            onChange={(event) => setProxyPort(event.target.value)}
          />
          <input
            className="field"
            value={proxyBypass}
            placeholder="Bypass rules"
            onChange={(event) => setProxyBypass(event.target.value)}
          />
        </div>
        <div className="mt-3 grid gap-2 lg:grid-cols-[1fr_auto_auto_auto]">
          <input
            className="field"
            value={findText}
            placeholder="Find in page"
            onChange={(event) => setFindText(event.target.value)}
          />
          <button
            className="app-button"
            disabled={!findText.trim()}
            onClick={() => void api.services.find(service.id, findText.trim())}
          >
            Find
          </button>
          <button className="app-button" onClick={() => void api.services.stopFind(service.id)}>
            Stop find
          </button>
          <button
            className="app-button"
            onClick={() =>
              void api.services.currentUrl(service.id).then(async (result) => {
                setCurrentUrl(result.url);
                if (result.url) await navigator.clipboard.writeText(result.url);
              })
            }
          >
            Copy URL
          </button>
        </div>
        {currentUrl && <div className="mt-2 truncate text-xs text-muted">{currentUrl}</div>}
      </section>

      <section className="panel rounded-md p-3 xl:col-span-2">
        <div className="flex flex-wrap gap-2">
          <button
            className="app-button border-accent text-white"
            disabled={!displayName.trim()}
            onClick={save}
          >
            Save service
          </button>
          <button className="app-button" onClick={() => void sleepService(service.id)}>
            <Moon size={15} />
            Sleep
          </button>
          <button className="app-button" onClick={() => void wakeService(service.id)}>
            <RefreshCw size={15} />
            Wake
          </button>
          <button className="app-button" onClick={() => void api.services.reload(service.id)}>
            Reload
          </button>
          <button className="app-button" onClick={() => void api.services.openExternal(service.id)}>
            Open external
          </button>
          <button className="app-button" onClick={() => void api.services.clearStorage(service.id)}>
            Clear storage
          </button>
          <button
            className="app-button"
            onClick={() => void api.services.setZoom(service.id, numberOrDefault(zoomFactor, 1))}
          >
            Apply zoom
          </button>
          <button className="app-button" onClick={() => void deleteService(service.id, false)}>
            Remove
          </button>
          <button className="app-button" onClick={() => void deleteService(service.id, true)}>
            Remove + wipe data
          </button>
        </div>
      </section>
    </div>
  );
}

function CustomAppPanel({
  profiles,
  createCustomService
}: {
  profiles: ReturnType<typeof useAppStore.getState>['profiles'];
  createCustomService: (input: {
    name: string;
    url: string;
    domains: string[];
    category: ServiceCategory;
    profileId?: string | null;
    defaultUserAgent?: string | null;
    unreadTitleRegex?: string | null;
    mobileMode?: boolean;
  }) => Promise<void>;
}): JSX.Element {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [domains, setDomains] = useState('');
  const [category, setCategory] = useState<ServiceCategory>('Other');
  const [profileId, setProfileId] = useState('');
  const [mobileMode, setMobileMode] = useState(false);
  const [userAgent, setUserAgent] = useState('');
  const [titleRegex, setTitleRegex] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const resolvedDomains = domainsFrom(url, domains);

  return (
    <section className="panel rounded-md p-3">
      <div className="grid gap-3 lg:grid-cols-2">
        <input
          className="field"
          value={name}
          placeholder="App name"
          onChange={(event) => setName(event.target.value)}
        />
        <input
          className="field"
          value={url}
          placeholder="https://example.com"
          onChange={(event) => setUrl(event.target.value)}
        />
        <select
          className="field"
          value={category}
          onChange={(event) => setCategory(event.target.value as ServiceCategory)}
        >
          {CATEGORIES.map((candidate) => (
            <option key={candidate} value={candidate}>
              {candidate}
            </option>
          ))}
        </select>
        <select
          className="field"
          value={profileId}
          onChange={(event) => setProfileId(event.target.value)}
        >
          <option value="">No profile</option>
          {profiles.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.label}
            </option>
          ))}
        </select>
        <input
          className="field lg:col-span-2"
          value={domains}
          placeholder="Allowed domains, comma-separated"
          onChange={(event) => setDomains(event.target.value)}
        />
        <input
          className="field lg:col-span-2"
          value={userAgent}
          placeholder="Default user agent"
          onChange={(event) => setUserAgent(event.target.value)}
        />
        <input
          className="field lg:col-span-2"
          value={titleRegex}
          placeholder="Unread title regex"
          onChange={(event) => setTitleRegex(event.target.value)}
        />
        <label className="flex items-center gap-2 rounded-md border border-line p-2 text-sm">
          <input
            type="checkbox"
            checked={mobileMode}
            onChange={(event) => setMobileMode(event.target.checked)}
          />
          Mobile mode
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          className="app-button border-accent text-white"
          disabled={!name.trim() || !url.trim() || resolvedDomains.length === 0}
          onClick={() =>
            void createCustomService({
              name: name.trim(),
              url: url.trim(),
              domains: resolvedDomains,
              category,
              profileId: profileId || null,
              defaultUserAgent: userAgent.trim() || null,
              unreadTitleRegex: titleRegex.trim() || null,
              mobileMode
            }).then(() => {
              setName('');
              setUrl('');
              setDomains('');
              setUserAgent('');
              setTitleRegex('');
              setMessage('Added.');
            })
          }
        >
          <Plus size={15} />
          Add app
        </button>
        {resolvedDomains.length > 0 && (
          <span className="text-xs text-muted">{resolvedDomains.join(', ')}</span>
        )}
        {message && <span className="text-xs text-muted">{message}</span>}
      </div>
    </section>
  );
}

function ExtensionPanel({
  extensions,
  refresh
}: {
  extensions: ExtensionRecord[];
  refresh: () => void;
}): JSX.Element {
  const [path, setPath] = useState('');
  return (
    <section className="panel rounded-md p-3">
      <div className="mb-3 flex gap-2">
        <input
          className="field flex-1"
          value={path}
          placeholder="Path to unpacked extension folder"
          onChange={(event) => setPath(event.target.value)}
        />
        <button
          className="app-button"
          disabled={!path.trim()}
          onClick={() =>
            void api.extensions.add(path.trim()).then(() => {
              setPath('');
              refresh();
            })
          }
        >
          <Plus size={15} />
          Add
        </button>
      </div>
      <div className="space-y-2">
        {extensions.length === 0 && <EmptyState label="No extensions installed." />}
        {extensions.map((extension) => (
          <div
            key={extension.id}
            className="grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-md border border-line p-2"
          >
            <input
              type="checkbox"
              checked={extension.enabled}
              onChange={(event) =>
                void api.extensions.setEnabled(extension.id, event.target.checked).then(refresh)
              }
            />
            <div className="min-w-0">
              <div className="truncate text-sm">{extension.name}</div>
              <div className="truncate text-xs text-muted">{extension.path}</div>
            </div>
            <button
              className="icon-button"
              title="Remove extension"
              onClick={() => void api.extensions.remove(extension.id).then(refresh)}
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

function CatalogPanel({
  stats,
  createService
}: {
  stats: { total: number; seed: number; community: number; user: number } | null;
  createService: (
    recipe: RecipeCatalogItem,
    displayName?: string,
    profileId?: string | null
  ) => Promise<void>;
}): JSX.Element {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<RecipeRegistryEntry[]>([]);
  const [pack, setPack] = useState('');
  const [validation, setValidation] = useState<RecipePackValidation | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void api.registry.search(q, 80).then(setResults);
  }, [q]);

  return (
    <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
      <section className="panel rounded-md p-3">
        <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_auto]">
          <input
            className="field"
            value={q}
            placeholder="Search the curated app catalog"
            onChange={(event) => setQ(event.target.value)}
          />
          <div className="rounded-md border border-line px-3 py-2 text-xs text-muted">
            {stats ? `${stats.total} apps, ${stats.community} community` : 'Loading'}
          </div>
        </div>
        <div className="grid gap-2 lg:grid-cols-2">
          {results.map((entry) => (
            <div key={entry.id} className="rounded-md border border-line p-2">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{entry.name}</div>
                  <div className="truncate text-xs text-muted">{entry.start_url}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <span className="rounded bg-elevated px-1.5 py-0.5 text-[11px] text-muted">
                      {entry.category}
                    </span>
                    {entry.mobile_mode && (
                      <span className="rounded bg-elevated px-1.5 py-0.5 text-[11px] text-muted">
                        mobile
                      </span>
                    )}
                    <span className="rounded bg-elevated px-1.5 py-0.5 text-[11px] text-muted">
                      {entry.source}
                    </span>
                  </div>
                </div>
                <button
                  className="app-button h-8 px-2 text-xs"
                  onClick={() => void createService(registryToCatalog(entry))}
                >
                  Add
                </button>
              </div>
            </div>
          ))}
          {results.length === 0 && <EmptyState label="No recipes found." />}
        </div>
      </section>

      <section className="panel rounded-md p-3">
        <div className="mb-3 text-sm font-semibold">Community Pack</div>
        <textarea
          className="field h-64 w-full py-2"
          value={pack}
          placeholder='{"entries":[{"name":"Example","url":"https://example.com","category":"Productivity"}]}'
          onChange={(event) => setPack(event.target.value)}
        />
        <div className="mt-3 flex items-center gap-2">
          <button
            className="app-button"
            disabled={!pack.trim()}
            onClick={() =>
              void api.registry
                .validate(pack)
                .then((result) => {
                  setValidation(result);
                  setMessage(
                    result.valid ? `Valid pack: ${result.imported} entries.` : 'Pack has issues.'
                  );
                })
                .catch((error: unknown) =>
                  setMessage(error instanceof Error ? error.message : String(error))
                )
            }
          >
            Validate
          </button>
          <button
            className="app-button border-accent text-white"
            disabled={!pack.trim() || validation?.valid === false}
            onClick={() =>
              void api.registry
                .import(pack)
                .then((result) => {
                  setMessage(`Imported ${result.imported}, skipped ${result.skipped}.`);
                  setPack('');
                  setValidation(null);
                  return api.registry.search(q, 80).then(setResults);
                })
                .catch((error: unknown) =>
                  setMessage(error instanceof Error ? error.message : String(error))
                )
            }
          >
            Import
          </button>
          {message && <span className="text-xs text-muted">{message}</span>}
        </div>
        {validation && (
          <div className="mt-3 space-y-2 text-xs">
            {validation.issues.length > 0 && (
              <div className="rounded-md border border-red-500/40 p-2 text-red-200">
                {validation.issues.slice(0, 4).join(' · ')}
              </div>
            )}
            <div className="rounded-md border border-line p-2 text-muted">
              Preview: {validation.imported} importable, {validation.skipped} skipped
            </div>
            <div className="max-h-28 space-y-1 overflow-y-auto">
              {validation.entries.slice(0, 8).map((entry) => (
                <div key={entry.id} className="truncate rounded bg-elevated px-2 py-1">
                  {entry.name} / {entry.category}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function LinkRulesPanel({
  rules,
  services,
  workspaces,
  profiles,
  refresh
}: {
  rules: LinkRule[];
  services: ServiceInstance[];
  workspaces: Workspace[];
  profiles: ReturnType<typeof useAppStore.getState>['profiles'];
  refresh: () => void;
}): JSX.Element {
  const [name, setName] = useState('');
  const [pattern, setPattern] = useState('');
  const [priority, setPriority] = useState('100');
  const [matchType, setMatchType] = useState<LinkRule['match_type']>('domain');
  const [targetType, setTargetType] = useState<LinkRule['target_type']>('service');
  const [targetId, setTargetId] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [testUrl, setTestUrl] = useState('');
  const [testResult, setTestResult] = useState<LinkRuleTestResult | null>(null);

  const targets = targetOptions(targetType, services, workspaces, profiles);

  return (
    <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
      <section className="panel rounded-md p-3">
        <div className="mb-3 text-sm font-semibold">Create Rule</div>
        <div className="space-y-2">
          <input
            className="field w-full"
            value={name}
            placeholder="Rule name"
            onChange={(event) => setName(event.target.value)}
          />
          <input
            className="field w-full"
            value={pattern}
            placeholder="Domain, exact URL, text, or regex"
            onChange={(event) => setPattern(event.target.value)}
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              className="field"
              value={matchType}
              onChange={(event) => setMatchType(event.target.value as LinkRule['match_type'])}
            >
              {(['exact', 'domain', 'contains', 'regex'] as const).map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <input
              className="field"
              value={priority}
              placeholder="Priority"
              onChange={(event) => setPriority(event.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select
              className="field"
              value={targetType}
              onChange={(event) => {
                setTargetType(event.target.value as LinkRule['target_type']);
                setTargetId('');
              }}
            >
              {(['service', 'workspace', 'profile', 'external'] as const).map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <select
              className="field"
              value={targetId}
              disabled={targetType === 'external'}
              onChange={(event) => setTargetId(event.target.value)}
            >
              <option value="">Auto</option>
              {targets.map((target) => (
                <option key={target.id} value={target.id}>
                  {target.label}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 rounded-md border border-line p-2 text-sm">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) => setEnabled(event.target.checked)}
            />
            Enabled
          </label>
          <button
            className="app-button w-full border-accent text-white"
            disabled={!name.trim() || !pattern.trim()}
            onClick={() =>
              void api.linkRules
                .upsert({
                  name: name.trim(),
                  pattern: pattern.trim(),
                  priority: numberOrDefault(priority, 100),
                  match_type: matchType,
                  target_type: targetType,
                  target_id: targetType === 'external' ? null : targetId || null,
                  enabled
                })
                .then(() => {
                  setName('');
                  setPattern('');
                  refresh();
                })
            }
          >
            Save rule
          </button>
        </div>
      </section>

      <section className="panel rounded-md p-3">
        <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_auto]">
          <input
            className="field"
            value={testUrl}
            placeholder="https://example.com/path"
            onChange={(event) => setTestUrl(event.target.value)}
          />
          <button
            className="app-button"
            disabled={!testUrl.trim()}
            onClick={() => void api.linkRules.test(testUrl.trim()).then(setTestResult)}
          >
            Test
          </button>
        </div>
        {testResult && (
          <div className="mb-3 rounded-md border border-line p-2 text-xs text-muted">
            {testResult.matched ? `Matched ${testResult.rule?.name ?? 'rule'}` : 'No rule matched'}
            {testResult.external
              ? ' -> external'
              : testResult.targetServiceId
                ? ` -> ${testResult.targetServiceId}`
                : ''}
          </div>
        )}
        <div className="space-y-2">
          {rules.length === 0 && <EmptyState label="No link rules yet." />}
          {rules.map((rule) => (
            <div
              key={rule.id}
              className="grid grid-cols-[1fr_auto] gap-2 rounded-md border border-line p-2"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{rule.name}</div>
                <div className="truncate text-xs text-muted">
                  {rule.priority} / {rule.match_type} / {rule.pattern} {'->'} {rule.target_type}
                </div>
              </div>
              <button
                className="icon-button"
                title="Delete rule"
                onClick={() => void api.linkRules.delete(rule.id).then(refresh)}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function DashboardPanel({
  dashboards,
  selectedWorkspaceId,
  refresh
}: {
  dashboards: Dashboard[];
  selectedWorkspaceId: string | null;
  refresh: () => void;
}): JSX.Element {
  const [name, setName] = useState('');
  const [widgetType, setWidgetType] = useState<Dashboard['widgets'][number]['type']>('shortcuts');

  return (
    <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
      <section className="panel rounded-md p-3">
        <div className="mb-3 text-sm font-semibold">Dashboard</div>
        <div className="space-y-2">
          <input
            className="field w-full"
            value={name}
            placeholder="Dashboard name"
            onChange={(event) => setName(event.target.value)}
          />
          <button
            className="app-button w-full border-accent text-white"
            disabled={!name.trim()}
            onClick={() =>
              void api.dashboards
                .upsert({ name: name.trim(), workspace_id: selectedWorkspaceId })
                .then(() => {
                  setName('');
                  refresh();
                })
            }
          >
            Create
          </button>
        </div>
      </section>
      <section className="panel rounded-md p-3">
        <div className="space-y-2">
          {dashboards.length === 0 && <EmptyState label="No dashboards yet." />}
          {dashboards.map((dashboard) => (
            <div key={dashboard.id} className="rounded-md border border-line p-2">
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{dashboard.name}</div>
                  <div className="text-xs text-muted">{dashboard.widgets.length} widgets</div>
                </div>
                <select
                  className="field h-8 w-36 text-xs"
                  value={widgetType}
                  onChange={(event) =>
                    setWidgetType(event.target.value as Dashboard['widgets'][number]['type'])
                  }
                >
                  {(
                    [
                      'shortcuts',
                      'notifications',
                      'tasks',
                      'unread',
                      'notes',
                      'clock',
                      'savedTabs'
                    ] as const
                  ).map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
                <button
                  className="app-button h-8 px-2 text-xs"
                  onClick={() =>
                    void api.dashboards
                      .upsert({
                        ...dashboard,
                        widgets: [
                          ...dashboard.widgets,
                          {
                            id: crypto.randomUUID(),
                            type: widgetType,
                            title: labelFromId(widgetType),
                            config: {}
                          }
                        ]
                      })
                      .then(refresh)
                  }
                >
                  Add widget
                </button>
                <button
                  className="icon-button"
                  title="Delete dashboard"
                  onClick={() => void api.dashboards.delete(dashboard.id).then(refresh)}
                >
                  <Trash2 size={15} />
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {dashboard.widgets.map((widget) => (
                  <span
                    key={widget.id}
                    className="rounded bg-elevated px-1.5 py-0.5 text-[11px] text-muted"
                  >
                    {widget.title}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function PrivacyPanel({
  permissions,
  services,
  settings,
  setSettingValue,
  refresh
}: {
  permissions: PermissionPolicy[];
  services: ServiceInstance[];
  settings: ReturnType<typeof useAppStore.getState>['settings'];
  setSettingValue: ReturnType<typeof useAppStore.getState>['setSettingValue'];
  refresh: () => void;
}): JSX.Element {
  const [serviceId, setServiceId] = useState('');
  const [permission, setPermission] = useState('notifications');
  const [decision, setDecision] = useState<PermissionPolicy['decision']>('ask');
  const [autoLock, setAutoLock] = useState(settings.auto_lock_minutes);

  useEffect(() => {
    setAutoLock(settings.auto_lock_minutes);
  }, [settings.auto_lock_minutes]);

  return (
    <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
      <section className="panel rounded-md p-3">
        <div className="mb-3 text-sm font-semibold">Privacy Shield</div>
        <div className="space-y-2">
          <label className="flex items-center gap-2 rounded-md border border-line p-2 text-sm">
            <input
              type="checkbox"
              checked={settings.tracker_block === 'true'}
              onChange={(event) =>
                void setSettingValue('tracker_block', event.target.checked ? 'true' : 'false')
              }
            />
            Tracker and email-pixel block
          </label>
          <label className="flex items-center gap-2 rounded-md border border-line p-2 text-sm">
            <input
              type="checkbox"
              checked={settings.launch_at_login === 'true'}
              onChange={(event) =>
                void setSettingValue('launch_at_login', event.target.checked ? 'true' : 'false')
              }
            />
            Launch at login
          </label>
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <input
              className="field"
              value={autoLock}
              placeholder="Auto-lock minutes"
              onChange={(event) => setAutoLock(event.target.value)}
            />
            <button
              className="app-button"
              onClick={() => void setSettingValue('auto_lock_minutes', autoLock.trim())}
            >
              Save
            </button>
          </div>
          <div className="rounded-md border border-line p-2 text-xs text-muted">
            Syncs: workspaces, profiles, recipes, layouts, safe service metadata. Never syncs:
            cookies, tokens, AI keys, proxy passwords, downloads, permission decisions.
          </div>
        </div>
      </section>
      <section className="panel rounded-md p-3">
        <div className="mb-3 grid gap-2 lg:grid-cols-[1fr_1fr_120px_auto]">
          <select
            className="field"
            value={serviceId}
            onChange={(event) => setServiceId(event.target.value)}
          >
            <option value="">All services</option>
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.display_name}
              </option>
            ))}
          </select>
          <select
            className="field"
            value={permission}
            onChange={(event) => setPermission(event.target.value)}
          >
            {[
              'notifications',
              'media',
              'geolocation',
              'camera',
              'microphone',
              'clipboard-read',
              'clipboard-sanitized-write'
            ].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <select
            className="field"
            value={decision}
            onChange={(event) => setDecision(event.target.value as PermissionPolicy['decision'])}
          >
            {(['ask', 'allow', 'deny'] as const).map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <button
            className="app-button"
            onClick={() =>
              void api.permissions
                .upsert({ service_instance_id: serviceId || null, permission, decision })
                .then(refresh)
            }
          >
            Save
          </button>
        </div>
        <div className="space-y-2">
          {permissions.length === 0 && <EmptyState label="No permission policies yet." />}
          {permissions.map((policy) => (
            <div
              key={policy.id}
              className="grid grid-cols-[1fr_auto] gap-2 rounded-md border border-line p-2"
            >
              <div className="min-w-0">
                <div className="truncate text-sm">
                  {policy.permission}: {policy.decision}
                </div>
                <div className="truncate text-xs text-muted">
                  {policy.service_instance_id ?? 'All services'}
                </div>
              </div>
              <button
                className="icon-button"
                title="Delete policy"
                onClick={() => void api.permissions.delete(policy.id).then(refresh)}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function TrustPanel({
  status,
  refresh
}: {
  status: TrustStatus | null;
  refresh: () => void;
}): JSX.Element {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <section className="panel rounded-md p-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="text-sm font-semibold">Privacy Shield</div>
          <button className="app-button" onClick={refresh}>
            Refresh
          </button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-md border border-line p-3">
            <div className="text-xs text-muted">Tracker blocking</div>
            <div className="mt-1 text-xl font-semibold">
              {status?.tracker.enabled ? 'On' : 'Off'}
            </div>
          </div>
          <div className="rounded-md border border-line p-3">
            <div className="text-xs text-muted">Blocked requests</div>
            <div className="mt-1 text-xl font-semibold">{status?.tracker.blockedTotal ?? 0}</div>
          </div>
        </div>
        <div className="mt-3 space-y-1">
          {(status?.tracker.topHosts ?? []).map((host) => (
            <div
              key={host.host}
              className="flex justify-between rounded-md border border-line px-2 py-1 text-xs"
            >
              <span className="truncate">{host.host}</span>
              <span className="text-muted">{host.count}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="panel rounded-md p-3">
        <div className="mb-3 text-sm font-semibold">Vault Inspector</div>
        <div className="rounded-md border border-line p-2 text-sm">
          {status?.vault.safe ? 'Vault denylist passed' : (status?.vault.error ?? 'Loading')}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <TrustList title="Syncs" items={status?.vault.syncs ?? []} />
          <TrustList title="Never Syncs" items={status?.vault.neverSyncs ?? []} />
        </div>
      </section>

      <section className="panel rounded-md p-3 xl:col-span-2">
        <div className="mb-3 text-sm font-semibold">Release Readiness</div>
        <div className="grid gap-2 md:grid-cols-2">
          {(status?.release ?? []).map((item) => (
            <div key={item.label} className="rounded-md border border-line p-2">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span>{item.label}</span>
                <span className={item.ok ? 'text-accent' : 'text-red-300'}>
                  {item.ok ? 'ready' : 'missing'}
                </span>
              </div>
              <div className="mt-1 text-xs text-muted">{item.detail}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function TrustList({ title, items }: { title: string; items: string[] }): JSX.Element {
  return (
    <div className="rounded-md border border-line p-2">
      <div className="mb-2 text-xs font-semibold text-muted">{title}</div>
      <div className="space-y-1">
        {items.map((item) => (
          <div key={item} className="rounded bg-elevated px-2 py-1 text-xs">
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

function PerformancePanel({
  status,
  refresh
}: {
  status: PerformanceStatus | null;
  refresh: () => void;
}): JSX.Element {
  const settings = useAppStore((state) => state.settings);
  const setSettingValue = useAppStore((state) => state.setSettingValue);
  return (
    <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
      <section className="panel rounded-md p-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="text-sm font-semibold">Performance</div>
          <button className="app-button" onClick={refresh}>
            Refresh
          </button>
        </div>
        <div className="grid gap-2">
          <div className="rounded-md border border-line p-3">
            <div className="text-xs text-muted">Memory</div>
            <div className="mt-1 text-2xl font-semibold">{status?.totalMemoryMB ?? '-'} MB</div>
          </div>
          <div className="rounded-md border border-line p-3">
            <div className="text-xs text-muted">Saved by sleeping (estimate, this session)</div>
            <div className="mt-1 text-2xl font-semibold">{status?.estimatedSavedMB ?? 0} MB</div>
          </div>
          <div className="rounded-md border border-line p-3">
            <div className="text-xs text-muted">Services</div>
            <div className="mt-1 text-2xl font-semibold">
              {status
                ? `${status.serviceCount - status.disabledServiceCount}/${status.serviceCount}`
                : '-'}
            </div>
          </div>
          <label className="flex items-center gap-2 rounded-md border border-line p-2 text-sm">
            <input
              type="checkbox"
              checked={settings.show_memory_badges === 'true'}
              onChange={(event) =>
                void setSettingValue('show_memory_badges', event.target.checked ? 'true' : 'false')
              }
            />
            Show memory badges in the service rail
          </label>
        </div>
        <div className="mt-3 space-y-2">
          {(status?.suggestions ?? []).map((suggestion) => (
            <div
              key={`${suggestion.title}-${suggestion.detail}`}
              className="rounded-md border border-line p-2"
            >
              <div className="text-sm">{suggestion.title}</div>
              <div className="mt-1 text-xs text-muted">{suggestion.detail}</div>
            </div>
          ))}
          {status?.suggestions.length === 0 && <EmptyState label="No performance suggestions." />}
        </div>
      </section>
      <section className="panel rounded-md p-3">
        <div className="mb-3 text-sm font-semibold">Per service</div>
        <div className="mb-4 space-y-1">
          {(status?.services ?? []).map((service) => (
            <div
              key={service.instanceId}
              className="grid grid-cols-[1fr_80px_80px] gap-2 rounded-md border border-line px-2 py-1 text-xs"
            >
              <span className="truncate">{service.displayName}</span>
              <span className="text-muted">{service.state}</span>
              <span className="text-right">
                {service.state === 'sleeping' ? '0 MB' : `${service.memoryMB} MB`}
              </span>
            </div>
          ))}
          {!status?.services?.length && <EmptyState label="No live services yet." />}
        </div>
        <div className="mb-3 text-sm font-semibold">Processes</div>
        <div className="space-y-1">
          {status?.processes.map((process, index) => (
            <div
              key={`${process.type}-${process.name}-${index}`}
              className="grid grid-cols-[120px_1fr_80px] gap-2 rounded-md border border-line px-2 py-1 text-xs"
            >
              <span className="truncate text-muted">{process.type}</span>
              <span className="truncate">{process.name}</span>
              <span className="text-right">{process.memoryMB} MB</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function AiWorkflowPanel({
  prompts,
  refresh
}: {
  prompts: AiPrompt[];
  refresh: () => void;
}): JSX.Element {
  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState('');
  const [context, setContext] = useState('');
  const [output, setOutput] = useState<string | null>(null);
  const [briefingMessage, setBriefingMessage] = useState<string | null>(null);

  const enableMorningBriefing = async (): Promise<void> => {
    await api.automations.upsert({
      name: 'Morning briefing',
      enabled: true,
      trigger: {
        type: 'schedule',
        schedule: [{ from: '08:30', to: '08:45', days: [0, 1, 2, 3, 4, 5, 6] }]
      },
      actions: [{ type: 'runAiPrompt' }]
    });
    setBriefingMessage(
      'Morning briefing scheduled daily at 08:30. The result lands in your inbox; edit or disable it under Automations.'
    );
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
      <section className="panel rounded-md p-3 xl:col-span-2">
        <div className="mb-2 text-sm font-semibold">Morning briefing</div>
        <div className="flex flex-wrap items-center gap-2">
          <button className="app-button primary" onClick={() => void enableMorningBriefing()}>
            Enable morning briefing
          </button>
          <span className="text-xs text-muted">
            A daily AI summary of your notifications, delivered to the inbox at 08:30.
          </span>
        </div>
        {briefingMessage && <div className="mt-2 text-xs text-muted">{briefingMessage}</div>}
      </section>
      <section className="panel rounded-md p-3">
        <div className="mb-3 text-sm font-semibold">Saved Prompt</div>
        <div className="space-y-2">
          <input
            className="field w-full"
            value={title}
            placeholder="Title"
            onChange={(event) => setTitle(event.target.value)}
          />
          <textarea
            className="field h-32 w-full py-2"
            value={prompt}
            placeholder="Prompt"
            onChange={(event) => setPrompt(event.target.value)}
          />
          <textarea
            className="field h-24 w-full py-2"
            value={context}
            placeholder="Optional context"
            onChange={(event) => setContext(event.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <button
              className="app-button"
              disabled={!title.trim() || !prompt.trim()}
              onClick={() =>
                void api.aiPrompts
                  .upsert({ title: title.trim(), prompt: prompt.trim(), local_only: false })
                  .then(() => {
                    setTitle('');
                    setPrompt('');
                    refresh();
                  })
              }
            >
              Save
            </button>
            <button
              className="app-button border-accent text-white"
              disabled={!prompt.trim()}
              onClick={() =>
                void api.aiPrompts
                  .run({ prompt: prompt.trim(), context: context.trim() })
                  .then((result) => setOutput(result.text))
                  .catch((error: unknown) =>
                    setOutput(error instanceof Error ? error.message : String(error))
                  )
              }
            >
              Run
            </button>
            <button
              className="app-button"
              onClick={() =>
                void api.aiPrompts
                  .extractTasks()
                  .then((result) => setOutput(result.text))
                  .catch((error: unknown) =>
                    setOutput(error instanceof Error ? error.message : String(error))
                  )
              }
            >
              Extract tasks
            </button>
          </div>
        </div>
      </section>
      <section className="panel rounded-md p-3">
        <div className="mb-3 text-sm font-semibold">Prompts</div>
        <div className="space-y-2">
          {prompts.length === 0 && <EmptyState label="No prompts saved." />}
          {prompts.map((saved) => (
            <div key={saved.id} className="rounded-md border border-line p-2">
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{saved.title}</div>
                  <div className="truncate text-xs text-muted">{saved.prompt}</div>
                </div>
                <button
                  className="app-button h-8 px-2 text-xs"
                  onClick={() =>
                    void api.aiPrompts
                      .run({ id: saved.id, context })
                      .then((result) => setOutput(result.text))
                      .catch((error: unknown) =>
                        setOutput(error instanceof Error ? error.message : String(error))
                      )
                  }
                >
                  Run
                </button>
                <button
                  className="icon-button"
                  title="Delete prompt"
                  onClick={() => void api.aiPrompts.delete(saved.id).then(refresh)}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
        {output && (
          <textarea className="field mt-3 h-40 w-full py-2 text-xs" readOnly value={output} />
        )}
      </section>
    </div>
  );
}

function AutomationsPanel({
  automations,
  services,
  workspaces,
  aiPrompts,
  refresh
}: {
  automations: AutomationRule[];
  services: ServiceInstance[];
  workspaces: Workspace[];
  aiPrompts: AiPrompt[];
  refresh: () => void;
}): JSX.Element {
  const [name, setName] = useState('New automation');
  const [triggerType, setTriggerType] = useState<AutomationRule['trigger']['type']>('notification');
  const [matchText, setMatchText] = useState('');
  const [actionType, setActionType] =
    useState<AutomationRule['actions'][number]['type']>('createTask');
  const [targetId, setTargetId] = useState('');
  const [result, setResult] = useState('');
  const save = async (): Promise<void> => {
    const actionValue = actionType === 'createTask' ? targetId || 'Follow up' : undefined;
    await api.automations.upsert({
      name,
      enabled: true,
      trigger: {
        type: triggerType,
        matchText: matchText.trim() || undefined,
        unreadAtLeast: triggerType === 'unreadThreshold' ? 5 : undefined
      },
      actions: [
        { type: actionType, targetId: actionValue ? null : targetId || null, value: actionValue }
      ]
    });
    setResult('Automation saved.');
    refresh();
  };
  const testDraft = async (): Promise<void> => {
    const test = await api.automations.test({
      trigger: { type: triggerType, matchText: matchText || undefined, unreadAtLeast: 5 },
      sample: { title: matchText || 'Sample notification', body: 'Sample body', unread: 7 }
    });
    setResult(`${test.matched ? 'Matched' : 'No match'}: ${test.reasons.join(' ')}`);
  };
  return (
    <section className="space-y-3">
      <div className="panel rounded-md p-3">
        <div className="mb-3 text-sm font-semibold">Local Automation Builder</div>
        <div className="grid gap-2 lg:grid-cols-2">
          <input className="field" value={name} onChange={(event) => setName(event.target.value)} />
          <select
            className="field"
            value={triggerType}
            onChange={(event) =>
              setTriggerType(event.target.value as AutomationRule['trigger']['type'])
            }
          >
            <option value="notification">Notification contains</option>
            <option value="unreadThreshold">Unread threshold</option>
            <option value="schedule">Schedule</option>
            <option value="startup">Startup</option>
            <option value="manual">Manual</option>
          </select>
          <input
            className="field"
            placeholder="Trigger text"
            value={matchText}
            onChange={(event) => setMatchText(event.target.value)}
          />
          <select
            className="field"
            value={actionType}
            onChange={(event) =>
              setActionType(event.target.value as AutomationRule['actions'][number]['type'])
            }
          >
            <option value="createTask">Create task</option>
            <option value="openWorkspace">Open workspace</option>
            <option value="openService">Open service</option>
            <option value="runAiPrompt">Run AI prompt</option>
            <option value="sleepService">Sleep service</option>
            <option value="wakeService">Wake service</option>
          </select>
          <select
            className="field"
            value={targetId}
            onChange={(event) => setTargetId(event.target.value)}
          >
            <option value="">Target or task title</option>
            {workspaces.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>
                Workspace: {workspace.name}
              </option>
            ))}
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                Service: {service.display_name}
              </option>
            ))}
            {aiPrompts.map((prompt) => (
              <option key={prompt.id} value={prompt.id}>
                Prompt: {prompt.title}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <button className="app-button" onClick={() => void testDraft()}>
              Test
            </button>
            <button className="app-button primary" onClick={() => void save()}>
              Save
            </button>
          </div>
        </div>
        {result && (
          <div className="mt-2 rounded-md border border-line p-2 text-xs text-muted">{result}</div>
        )}
      </div>
      <div className="grid gap-2">
        {automations.length === 0 && <EmptyState label="No automations yet." />}
        {automations.map((automation) => (
          <div
            key={automation.id}
            className="grid grid-cols-[1fr_auto] gap-2 rounded-md border border-line p-3"
          >
            <div>
              <div className="text-sm font-semibold">{automation.name}</div>
              <div className="text-xs text-muted">
                {automation.enabled ? automation.trigger.type : 'Disabled'} /{' '}
                {automation.actions.length} actions
              </div>
            </div>
            <button
              className="icon-button"
              title="Delete"
              onClick={() => void api.automations.delete(automation.id).then(refresh)}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

function FocusModesPanel({
  modes,
  status,
  workspaces,
  services,
  refresh
}: {
  modes: FocusMode[];
  status: FocusModeStatus | null;
  workspaces: Workspace[];
  services: ServiceInstance[];
  refresh: () => void;
}): JSX.Element {
  const [name, setName] = useState('Deep Work');
  const [workspaceId, setWorkspaceId] = useState('');
  const [from, setFrom] = useState('09:00');
  const [to, setTo] = useState('17:00');
  const [mute, setMute] = useState(true);
  const save = async (): Promise<void> => {
    await api.focusModes.upsert({
      name,
      workspace_id: workspaceId || null,
      enabled: true,
      schedule: [{ from, to, days: [1, 2, 3, 4, 5] }],
      settings: { muteNotifications: mute, hideMutedServices: true, blockedServiceIds: [] }
    });
    refresh();
  };
  return (
    <section className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-3">
        <Metric label="Active" value={status?.activeMode?.name ?? 'None'} />
        <Metric label="Next" value={status?.nextMode?.name ?? 'None'} />
        <Metric label="Managed Services" value={String(services.length)} />
      </div>
      <div className="panel rounded-md p-3">
        <div className="mb-3 text-sm font-semibold">Smart Focus Mode</div>
        <div className="grid gap-2 lg:grid-cols-5">
          <input className="field" value={name} onChange={(event) => setName(event.target.value)} />
          <select
            className="field"
            value={workspaceId}
            onChange={(event) => setWorkspaceId(event.target.value)}
          >
            <option value="">All workspaces</option>
            {workspaces.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>
                {workspace.name}
              </option>
            ))}
          </select>
          <input className="field" value={from} onChange={(event) => setFrom(event.target.value)} />
          <input className="field" value={to} onChange={(event) => setTo(event.target.value)} />
          <label className="flex items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              checked={mute}
              onChange={(event) => setMute(event.target.checked)}
            />
            Mute
          </label>
        </div>
        <button className="app-button primary mt-3" onClick={() => void save()}>
          Save Focus Mode
        </button>
      </div>
      {modes.map((mode) => {
        const firstSchedule = mode.schedule[0];
        return (
          <div
            key={mode.id}
            className="grid grid-cols-[1fr_auto] gap-2 rounded-md border border-line p-3"
          >
            <div>
              <div className="text-sm font-semibold">{mode.name}</div>
              <div className="text-xs text-muted">
                {firstSchedule ? `${firstSchedule.from}-${firstSchedule.to}` : 'Manual'} /{' '}
                {mode.settings.muteNotifications ? 'Muted' : 'Normal'}
              </div>
            </div>
            <button
              className="icon-button"
              title="Delete"
              onClick={() => void api.focusModes.delete(mode.id).then(refresh)}
            >
              <Trash2 size={14} />
            </button>
          </div>
        );
      })}
    </section>
  );
}

function BrowserImportPanel({
  workspaces,
  selectedWorkspaceId,
  load
}: {
  workspaces: Workspace[];
  selectedWorkspaceId: string | null;
  load: () => Promise<void>;
}): JSX.Element {
  const [data, setData] = useState('');
  const [workspaceId, setWorkspaceId] = useState(selectedWorkspaceId ?? '');
  const [preview, setPreview] = useState<BrowserImportPreview | null>(null);
  const [result, setResult] = useState('');
  return (
    <section className="space-y-3">
      <div className="panel rounded-md p-3">
        <div className="mb-3 text-sm font-semibold">Browser Import</div>
        <select
          className="field mb-2 w-full"
          value={workspaceId}
          onChange={(event) => setWorkspaceId(event.target.value)}
        >
          {workspaces.map((workspace) => (
            <option key={workspace.id} value={workspace.id}>
              {workspace.name}
            </option>
          ))}
        </select>
        <textarea
          className="field h-48 w-full py-2"
          placeholder="Paste Chrome/Edge/Firefox bookmark JSON or HTML export"
          value={data}
          onChange={(event) => setData(event.target.value)}
        />
        <div className="mt-2 flex gap-2">
          <button
            className="app-button"
            onClick={() => void api.browserImport.preview(data).then(setPreview)}
          >
            Preview
          </button>
          <button
            className="app-button primary"
            disabled={!preview}
            onClick={() =>
              void api.browserImport
                .run(data, workspaceId || selectedWorkspaceId)
                .then(async (run) => {
                  setResult(`Imported ${run.created}, skipped ${run.skipped} from ${run.source}.`);
                  await load();
                })
            }
          >
            Import
          </button>
        </div>
      </div>
      {preview && (
        <div className="panel rounded-md p-3 text-sm">
          <div className="font-semibold">
            {preview.source}: {preview.importable}/{preview.total} importable
          </div>
          <div className="mt-2 max-h-72 space-y-2 overflow-y-auto">
            {preview.items.slice(0, 50).map((item) => (
              <div key={`${item.title}-${item.url}`} className="rounded-md border border-line p-2">
                <div className="truncate text-sm">{item.title}</div>
                <div className="truncate text-xs text-muted">{item.url}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {result && (
        <div className="rounded-md border border-line p-2 text-xs text-muted">{result}</div>
      )}
    </section>
  );
}

function RecipeStudioPanel({ refreshCatalog }: { refreshCatalog: () => void }): JSX.Element {
  const [name, setName] = useState('New App');
  const [url, setUrl] = useState('https://example.com');
  const [category, setCategory] = useState<ServiceCategory>('Productivity');
  const [analysis, setAnalysis] = useState<RecipeStudioAnalysis | null>(null);
  const [result, setResult] = useState('');
  const analyze = async (): Promise<void> => {
    setAnalysis(await api.recipeStudio.analyze({ name, url, category }));
  };
  const create = async (): Promise<void> => {
    const recipe = await api.recipeStudio.create({ name, url, category });
    setResult(`Created ${recipe.name}.`);
    refreshCatalog();
  };
  return (
    <section className="space-y-3">
      <div className="panel rounded-md p-3">
        <div className="mb-3 text-sm font-semibold">Recipe Studio</div>
        <div className="grid gap-2 lg:grid-cols-[1fr_1fr_180px]">
          <input className="field" value={name} onChange={(event) => setName(event.target.value)} />
          <input className="field" value={url} onChange={(event) => setUrl(event.target.value)} />
          <select
            className="field"
            value={category}
            onChange={(event) => setCategory(event.target.value as ServiceCategory)}
          >
            {CATEGORIES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-2 flex gap-2">
          <button className="app-button" onClick={() => void analyze()}>
            Analyze
          </button>
          <button className="app-button primary" onClick={() => void create()}>
            Create Recipe
          </button>
        </div>
      </div>
      {analysis && (
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="panel rounded-md p-3">
            <div className="text-sm font-semibold">{analysis.valid ? 'Ready' : 'Needs fixes'}</div>
            <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-shell p-2 text-xs">
              {JSON.stringify(analysis.recipe, null, 2)}
            </pre>
          </div>
          <div className="panel rounded-md p-3 text-xs text-muted">
            {[...analysis.issues, ...analysis.suggestions].map((item) => (
              <div key={item} className="mb-2 rounded-md border border-line p-2">
                {item}
              </div>
            ))}
          </div>
        </div>
      )}
      {result && (
        <div className="rounded-md border border-line p-2 text-xs text-muted">{result}</div>
      )}
    </section>
  );
}

function ExtensionPackPanel({ templates }: { templates: LocalExtensionTemplate[] }): JSX.Element {
  const [result, setResult] = useState('');
  return (
    <section className="grid gap-3 lg:grid-cols-2">
      {templates.map((template) => (
        <div key={template.id} className="panel rounded-md p-3">
          <div className="text-sm font-semibold">{template.name}</div>
          <div className="mt-1 text-xs text-muted">{template.description}</div>
          <div className="mt-2 text-xs text-muted">{template.capabilities.join(' / ')}</div>
          <button
            className="app-button mt-3"
            onClick={() =>
              void api.extensionPack
                .apply(template.id)
                .then((applied) => setResult(`${applied.name} enabled.`))
            }
          >
            Enable
          </button>
        </div>
      ))}
      {result && (
        <div className="rounded-md border border-line p-2 text-xs text-muted lg:col-span-2">
          {result}
        </div>
      )}
    </section>
  );
}

function FirewallPanel({
  rules,
  services,
  refresh
}: {
  rules: PrivacyFirewallRule[];
  services: ServiceInstance[];
  refresh: () => void;
}): JSX.Element {
  const [pattern, setPattern] = useState('tracker.example.com');
  const [ruleType, setRuleType] = useState<PrivacyFirewallRule['rule_type']>('domain');
  const [action, setAction] = useState<PrivacyFirewallRule['action']>('block');
  const [serviceId, setServiceId] = useState('');
  const [testUrl, setTestUrl] = useState('https://tracker.example.com/pixel.gif');
  const [result, setResult] = useState('');
  const save = async (): Promise<void> => {
    await api.firewall.upsert({
      pattern,
      rule_type: ruleType,
      action,
      service_instance_id: serviceId || null,
      enabled: true
    });
    refresh();
  };
  return (
    <section className="space-y-3">
      <div className="panel rounded-md p-3">
        <div className="mb-3 text-sm font-semibold">Rules-Based Privacy Firewall</div>
        <div className="grid gap-2 lg:grid-cols-5">
          <select
            className="field"
            value={ruleType}
            onChange={(event) =>
              setRuleType(event.target.value as PrivacyFirewallRule['rule_type'])
            }
          >
            <option value="domain">Domain</option>
            <option value="cookie">Cookie</option>
            <option value="permission">Permission</option>
            <option value="download">Download</option>
            <option value="clipboard">Clipboard</option>
            <option value="script">Script</option>
          </select>
          <input
            className="field lg:col-span-2"
            value={pattern}
            onChange={(event) => setPattern(event.target.value)}
          />
          <select
            className="field"
            value={action}
            onChange={(event) => setAction(event.target.value as PrivacyFirewallRule['action'])}
          >
            <option value="block">Block</option>
            <option value="ask">Ask</option>
            <option value="allow">Allow</option>
          </select>
          <select
            className="field"
            value={serviceId}
            onChange={(event) => setServiceId(event.target.value)}
          >
            <option value="">All services</option>
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.display_name}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-2 flex gap-2">
          <button className="app-button primary" onClick={() => void save()}>
            Save Rule
          </button>
          <input
            className="field flex-1"
            value={testUrl}
            onChange={(event) => setTestUrl(event.target.value)}
          />
          <button
            className="app-button"
            onClick={() =>
              void api.firewall
                .test(testUrl, serviceId || null)
                .then((test) => setResult(`${test.action}: ${test.rule?.pattern ?? 'no rule'}`))
            }
          >
            Test
          </button>
        </div>
        {result && (
          <div className="mt-2 rounded-md border border-line p-2 text-xs text-muted">{result}</div>
        )}
      </div>
      {rules.map((rule) => (
        <div
          key={rule.id}
          className="grid grid-cols-[1fr_auto] gap-2 rounded-md border border-line p-3"
        >
          <div>
            <div className="text-sm font-semibold">{rule.pattern}</div>
            <div className="text-xs text-muted">
              {rule.action} {rule.rule_type} /{' '}
              {rule.service_instance_id ? 'service-scoped' : 'global'}
            </div>
          </div>
          <button
            className="icon-button"
            title="Delete"
            onClick={() => void api.firewall.delete(rule.id).then(refresh)}
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
    </section>
  );
}

function SnapshotsPanel({
  snapshots,
  selectedWorkspaceId,
  refresh,
  load
}: {
  snapshots: WorkspaceSnapshot[];
  selectedWorkspaceId: string | null;
  refresh: () => void;
  load: () => Promise<void>;
}): JSX.Element {
  const [name, setName] = useState('Before changes');
  const create = async (): Promise<void> => {
    if (!selectedWorkspaceId) return;
    await api.snapshots.create(selectedWorkspaceId, name);
    refresh();
  };
  return (
    <section className="space-y-3">
      <div className="panel rounded-md p-3">
        <div className="mb-3 text-sm font-semibold">Workspace Snapshots</div>
        <div className="flex gap-2">
          <input
            className="field flex-1"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <button
            className="app-button primary"
            disabled={!selectedWorkspaceId}
            onClick={() => void create()}
          >
            Save Snapshot
          </button>
        </div>
      </div>
      {snapshots.length === 0 && <EmptyState label="No snapshots yet." />}
      {snapshots.map((snapshot) => (
        <div
          key={snapshot.id}
          className="grid grid-cols-[1fr_auto_auto] gap-2 rounded-md border border-line p-3"
        >
          <div>
            <div className="text-sm font-semibold">{snapshot.name}</div>
            <div className="text-xs text-muted">
              {snapshot.payload.services.length} services /{' '}
              {new Date(snapshot.created_at).toLocaleString()}
            </div>
          </div>
          <button
            className="app-button h-8 px-2 text-xs"
            onClick={() => void api.snapshots.restore(snapshot.id).then(async () => load())}
          >
            Restore
          </button>
          <button
            className="icon-button"
            title="Delete"
            onClick={() => void api.snapshots.delete(snapshot.id).then(refresh)}
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
    </section>
  );
}

function AnalyticsPanel({
  analytics,
  refresh
}: {
  analytics: PersonalAnalytics | null;
  refresh: () => void;
}): JSX.Element {
  if (!analytics) return <EmptyState label="Loading analytics." />;
  return (
    <section className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-4">
        <Metric label="Services" value={String(analytics.activeServices)} />
        <Metric label="Unread" value={String(analytics.unreadTotal)} />
        <Metric label="Open Tasks" value={String(analytics.openTasks)} />
        <Metric label="Trackers Blocked" value={String(analytics.trackerBlocks.blockedTotal)} />
      </div>
      <button className="app-button" onClick={refresh}>
        Refresh
      </button>
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="panel rounded-md p-3">
          <div className="mb-2 text-sm font-semibold">Noisy Services</div>
          {analytics.noisyServices.map((service) => (
            <div
              key={service.serviceId}
              className="flex justify-between border-b border-line py-2 text-sm last:border-b-0"
            >
              <span>{service.name}</span>
              <span className="text-muted">{service.notifications}</span>
            </div>
          ))}
        </div>
        <div className="panel rounded-md p-3">
          <div className="mb-2 text-sm font-semibold">Memory Leaders</div>
          {analytics.memoryTop.map((process) => (
            <div
              key={`${process.type}-${process.name}`}
              className="flex justify-between border-b border-line py-2 text-sm last:border-b-0"
            >
              <span className="truncate">{process.name || process.type}</span>
              <span className="text-muted">{process.memoryMB} MB</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PortablePanel({
  status,
  refresh
}: {
  status: PortableModeStatus | null;
  refresh: () => void;
}): JSX.Element {
  const [enabled, setEnabled] = useState(status?.enabled ?? false);
  const [root, setRoot] = useState(status?.rootPath ?? '');
  useEffect(() => {
    setEnabled(status?.enabled ?? false);
    setRoot(status?.rootPath ?? '');
  }, [status]);
  return (
    <section className="space-y-3">
      <div className="panel rounded-md p-3">
        <div className="mb-3 text-sm font-semibold">AppDeck Portable Mode</div>
        <label className="mb-2 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
          />
          Enable portable recovery root
        </label>
        <input
          className="field w-full"
          value={root}
          onChange={(event) => setRoot(event.target.value)}
        />
        <button
          className="app-button primary mt-2"
          onClick={() => void api.portable.configure(enabled, root).then(refresh)}
        >
          Save
        </button>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="panel rounded-md p-3 text-xs text-muted">
          <div className="mb-2 text-sm font-semibold text-ink">Recommended Roots</div>
          {(status?.recommendedPaths ?? []).map((item) => (
            <div key={item} className="mb-2 rounded-md border border-line p-2">
              {item}
            </div>
          ))}
        </div>
        <div className="panel rounded-md p-3 text-xs text-muted">
          <div className="mb-2 text-sm font-semibold text-ink">Notes</div>
          {(status?.notes ?? []).map((item) => (
            <div key={item} className="mb-2 rounded-md border border-line p-2">
              {item}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PeerSyncPanel({
  status,
  refresh
}: {
  status: PeerSyncStatus | null;
  refresh: () => void;
}): JSX.Element {
  const settings = useAppStore((state) => state.settings);
  const setSettingValue = useAppStore((state) => state.setSettingValue);
  const [label, setLabel] = useState('Laptop');
  const [endpoint, setEndpoint] = useState('https://device.tailnet.ts.net/appdeck#shared-secret');
  const [result, setResult] = useState('');
  const serveEnabled = settings.peer_sync_serve === 'true';
  const save = async (): Promise<void> => {
    await api.peerSync.upsert({ label, endpoint, enabled: true });
    refresh();
  };
  return (
    <section className="space-y-3">
      <div className="panel rounded-md p-3">
        <div className="mb-3 text-sm font-semibold">Encrypted Peer Sync</div>
        <label className="mb-2 flex items-center gap-2 rounded-md border border-line p-2 text-sm">
          <input
            type="checkbox"
            checked={serveEnabled}
            onChange={(event) =>
              void setSettingValue('peer_sync_serve', event.target.checked ? 'true' : 'false').then(
                refresh
              )
            }
          />
          <span>
            Share this device&apos;s vault with peers
            <span className="block text-xs text-muted">
              Opens a local encrypted endpoint (off by default). Peers still need the shared
              secret.
            </span>
          </span>
        </label>
        <div className="grid gap-2 lg:grid-cols-[1fr_2fr_auto]">
          <input
            className="field"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
          />
          <input
            className="field"
            value={endpoint}
            onChange={(event) => setEndpoint(event.target.value)}
          />
          <button className="app-button primary" onClick={() => void save()}>
            Add Peer
          </button>
        </div>
        <div className="mt-2 rounded-md border border-line p-2 text-xs text-muted">
          {status?.discoveryHint}
        </div>
        {status?.localEndpoint ? (
          <div className="mt-2 rounded-md border border-line p-2 text-xs text-muted">
            This device: {status.localEndpoint}
          </div>
        ) : null}
      </div>
      {status?.peers.map((peer) => (
        <div
          key={peer.id}
          className="grid grid-cols-[1fr_auto_auto] gap-2 rounded-md border border-line p-3"
        >
          <div>
            <div className="text-sm font-semibold">{peer.label}</div>
            <div className="truncate text-xs text-muted">{peer.endpoint}</div>
            {peer.last_seen_at ? (
              <div className="text-xs text-muted">
                Last synced {new Date(peer.last_seen_at).toLocaleString()}
              </div>
            ) : null}
          </div>
          <button
            className="app-button"
            title="Sync"
            onClick={() =>
              void api.peerSync.sync(peer.id).then((sync) => {
                setResult(
                  sync.status === 'synced'
                    ? `Synced ${peer.label}: ${sync.applied} changes.`
                    : `Sync ${sync.status}: ${sync.error ?? 'No changes.'}`
                );
                refresh();
              })
            }
          >
            Sync
          </button>
          <button
            className="icon-button"
            title="Delete"
            onClick={() => void api.peerSync.delete(peer.id).then(refresh)}
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      {result && (
        <div className="rounded-md border border-line p-2 text-xs text-muted">{result}</div>
      )}
    </section>
  );
}

function WorkKitsPanel({
  kits,
  refresh,
  load
}: {
  kits: WorkKit[];
  refresh: () => void;
  load: () => Promise<void>;
}): JSX.Element {
  const [result, setResult] = useState('');
  return (
    <section className="grid gap-3 lg:grid-cols-2">
      {kits.map((kit) => (
        <div key={kit.id} className="panel rounded-md p-3">
          <div className="text-sm font-semibold">{kit.name}</div>
          <div className="mt-1 text-xs text-muted">{kit.description}</div>
          <div className="mt-2 text-xs text-muted">
            {kit.payload.services.length} services / {kit.payload.aiPrompts?.length ?? 0} prompts
          </div>
          <button
            className="app-button primary mt-3"
            onClick={() =>
              void api.workKits.apply(kit.id).then(async (applied) => {
                setResult(`Created ${applied.kit.name} with ${applied.createdServices} services.`);
                refresh();
                await load();
              })
            }
          >
            Apply Kit
          </button>
        </div>
      ))}
      {result && (
        <div className="rounded-md border border-line p-2 text-xs text-muted lg:col-span-2">
          {result}
        </div>
      )}
    </section>
  );
}

function DownloadsPanel({
  downloads,
  refresh
}: {
  downloads: DownloadRecord[];
  refresh: () => void;
}): JSX.Element {
  return (
    <section className="panel rounded-md p-3">
      <div className="mb-3 flex justify-between gap-2">
        <div className="text-sm font-semibold">Downloads</div>
        <button className="app-button" onClick={() => void api.downloads.clear().then(refresh)}>
          Clear
        </button>
      </div>
      <div className="space-y-2">
        {downloads.length === 0 && <EmptyState label="No downloads yet." />}
        {downloads.map((download) => (
          <div
            key={download.id}
            className="grid grid-cols-[1fr_auto] gap-2 rounded-md border border-line p-2"
          >
            <div className="min-w-0">
              <div className="truncate text-sm">{download.filename}</div>
              <div className="truncate text-xs text-muted">
                {download.state} / {download.received_bytes} bytes /{' '}
                {new Date(download.started_at).toLocaleString()}
              </div>
            </div>
            <button
              className="app-button h-8 px-2 text-xs"
              disabled={!download.path}
              onClick={() => void api.downloads.open(download.id)}
            >
              Open
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

function ShortcutsPanel({
  shortcuts,
  refresh
}: {
  shortcuts: ShortcutBinding[];
  refresh: () => void;
}): JSX.Element {
  const [command, setCommand] = useState('');
  const [accelerator, setAccelerator] = useState('');
  const [scope, setScope] = useState<ShortcutBinding['scope']>('global');
  const conflict = shortcuts.some(
    (shortcut) => shortcut.accelerator === accelerator.trim() && shortcut.scope === scope
  );

  return (
    <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
      <section className="panel rounded-md p-3">
        <div className="mb-3 text-sm font-semibold">Shortcut</div>
        <div className="space-y-2">
          <input
            className="field w-full"
            value={command}
            placeholder="Command"
            onChange={(event) => setCommand(event.target.value)}
          />
          <input
            className="field w-full"
            value={accelerator}
            placeholder="Ctrl+Shift+K"
            onChange={(event) => setAccelerator(event.target.value)}
          />
          <select
            className="field w-full"
            value={scope}
            onChange={(event) => setScope(event.target.value as ShortcutBinding['scope'])}
          >
            {(['global', 'workspace', 'service'] as const).map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          {conflict && <div className="text-xs text-red-300">Shortcut conflict detected.</div>}
          <button
            className="app-button w-full border-accent text-white"
            disabled={!command.trim() || !accelerator.trim() || conflict}
            onClick={() =>
              void api.shortcuts
                .upsert({
                  command: command.trim(),
                  accelerator: accelerator.trim(),
                  scope,
                  enabled: true
                })
                .then(() => {
                  setCommand('');
                  setAccelerator('');
                  refresh();
                })
            }
          >
            Save
          </button>
        </div>
      </section>
      <section className="panel rounded-md p-3">
        <div className="space-y-2">
          {shortcuts.length === 0 && <EmptyState label="No custom shortcuts yet." />}
          {shortcuts.map((shortcut) => (
            <div
              key={shortcut.id}
              className="grid grid-cols-[1fr_auto] gap-2 rounded-md border border-line p-2"
            >
              <div className="min-w-0">
                <div className="truncate text-sm">{shortcut.command}</div>
                <div className="truncate text-xs text-muted">
                  {shortcut.accelerator} / {shortcut.scope}
                </div>
              </div>
              <button
                className="icon-button"
                title="Delete shortcut"
                onClick={() => void api.shortcuts.delete(shortcut.id).then(refresh)}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function SyncPanel({
  syncStatus,
  syncNow
}: {
  syncStatus: ReturnType<typeof useAppStore.getState>['syncStatus'];
  syncNow: () => Promise<void>;
}): JSX.Element {
  const [account, setAccount] = useState<{
    configured: boolean;
    email?: string;
    lastSyncAt?: number;
    lastError?: string;
  }>({
    configured: false
  });
  const [serverUrl, setServerUrl] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void api.account.status().then(setAccount);
  }, []);

  const runAccount = async (fn: () => Promise<void>, done: string): Promise<void> => {
    try {
      setMessage(null);
      await fn();
      setAccount(await api.account.status());
      setMessage(done);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  };

  const validServer = /^https?:\/\//.test(serverUrl.trim());

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <section className="panel rounded-md p-3">
        <div className="mb-3 text-sm font-semibold">Local Vault Sync</div>
        <div className="space-y-2 text-sm">
          <div className="rounded-md border border-line p-2 text-muted">
            {syncStatus.configured ? syncStatus.folderPath : 'File sync is not configured.'}
          </div>
          <div className="rounded-md border border-line p-2 text-muted">
            {syncStatus.lastError
              ? `Last sync failed: ${syncStatus.lastError}`
              : syncStatus.lastSyncAt
                ? `Healthy / Last sync ${new Date(syncStatus.lastSyncAt).toLocaleString()}`
                : 'No sync has run yet.'}
          </div>
          <button
            className="app-button"
            onClick={() => void syncNow().then(() => setMessage('Synced.'))}
          >
            Sync now
          </button>
        </div>
      </section>
      <section className="panel rounded-md p-3">
        <div className="mb-3 text-sm font-semibold">Self-host Server</div>
        <div className="space-y-2">
          <div className="rounded-md border border-line p-2 text-xs text-muted">
            {account.configured
              ? `Signed in as ${account.email ?? ''}${
                  account.lastError
                    ? ` / Last sync failed: ${account.lastError}`
                    : account.lastSyncAt
                      ? ` / Last sync ${new Date(account.lastSyncAt).toLocaleString()}`
                      : ''
                }`
              : 'Cloudflare Worker compatible, end-to-end encrypted.'}
          </div>
          <input
            className="field w-full"
            value={serverUrl}
            placeholder="https://your-worker.example.com"
            onChange={(event) => setServerUrl(event.target.value)}
          />
          <input
            className="field w-full"
            value={email}
            placeholder="Email"
            onChange={(event) => setEmail(event.target.value)}
          />
          <input
            className="field w-full"
            type="password"
            value={password}
            placeholder="Password"
            onChange={(event) => setPassword(event.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <button
              className="app-button"
              disabled={!validServer || !email.trim() || password.length < 8}
              onClick={() =>
                void runAccount(
                  () => api.account.signup(serverUrl, email, password),
                  'Account created.'
                )
              }
            >
              Sign up
            </button>
            <button
              className="app-button"
              disabled={!validServer || !email.trim() || !password}
              onClick={() =>
                void runAccount(() => api.account.login(serverUrl, email, password), 'Logged in.')
              }
            >
              Log in
            </button>
            <button
              className="app-button"
              onClick={() => void runAccount(() => api.account.syncNow(), 'Server synced.')}
            >
              Server sync
            </button>
          </div>
          {serverUrl.trim() && !validServer && (
            <div className="text-xs text-red-300">
              Server URL must start with http:// or https://.
            </div>
          )}
          {message && <div className="text-xs text-muted">{message}</div>}
        </div>
      </section>
    </div>
  );
}

function ImportPanel({
  workspaces,
  selectedWorkspaceId,
  load
}: {
  workspaces: Workspace[];
  selectedWorkspaceId: string | null;
  load: () => Promise<void>;
}): JSX.Element {
  const [data, setData] = useState('');
  const [workspaceId, setWorkspaceId] = useState(selectedWorkspaceId ?? '');
  const [preview, setPreview] = useState<MigrationPreview | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setWorkspaceId(selectedWorkspaceId ?? '');
  }, [selectedWorkspaceId]);

  return (
    <section className="panel rounded-md p-3">
      <div className="mb-3 grid gap-2 sm:grid-cols-[220px_1fr]">
        <select
          className="field"
          value={workspaceId}
          onChange={(event) => setWorkspaceId(event.target.value)}
        >
          {workspaces.map((workspace) => (
            <option key={workspace.id} value={workspace.id}>
              {workspace.name}
            </option>
          ))}
        </select>
        <div className="text-xs text-muted">
          Ferdium, Franz, Rambox, WebCatalog, Shift, or bookmark JSON
        </div>
      </div>
      <textarea
        className="field h-64 w-full py-2"
        value={data}
        onChange={(event) => setData(event.target.value)}
      />
      <div className="mt-3 flex items-center gap-2">
        <button
          className="app-button"
          disabled={!data.trim()}
          onClick={() =>
            void api.migration
              .preview(data)
              .then((result) => {
                setPreview(result);
                setMessage(
                  `${result.source}: ${result.importable} importable, ${result.skipped} skipped.`
                );
              })
              .catch((error: unknown) =>
                setMessage(error instanceof Error ? error.message : String(error))
              )
          }
        >
          Preview
        </button>
        <button
          className="app-button border-accent text-white"
          disabled={!data.trim() || preview?.importable === 0}
          onClick={() =>
            void api.migration
              .run(data, workspaceId || null)
              .then((result) => {
                setMessage(
                  `Imported ${result.created}, skipped ${result.skipped}. Rollback export is below.`
                );
                setPreview({
                  source: result.source,
                  total: result.created + result.skipped,
                  importable: result.created,
                  skipped: result.skipped,
                  items: [],
                  rollbackExport: result.rollbackExport
                });
                setData('');
                return load();
              })
              .catch((error: unknown) =>
                setMessage(error instanceof Error ? error.message : String(error))
              )
          }
        >
          Import
        </button>
        {message && <span className="text-xs text-muted">{message}</span>}
      </div>
      {preview && (
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-line p-2 text-xs">
            {preview.items.slice(0, 40).map((item, index) => (
              <div
                key={`${item.name}-${index}`}
                className={`rounded px-2 py-1 ${item.importable ? 'bg-elevated' : 'border border-red-500/30 text-red-200'}`}
              >
                <div className="truncate">{item.name}</div>
                <div className="truncate text-muted">
                  {item.willCreateCustomRecipe ? 'custom recipe' : (item.recipeId ?? 'skipped')}
                  {item.reason ? ` / ${item.reason}` : ''}
                </div>
              </div>
            ))}
            {preview.items.length === 0 && <div className="text-muted">Rollback/export only.</div>}
          </div>
          <textarea
            className="field h-48 w-full py-2 text-xs"
            readOnly
            value={preview.rollbackExport}
          />
        </div>
      )}
    </section>
  );
}

function DiagnosticsPanel({
  metrics,
  setMetrics,
  repairStatus,
  setRepairStatus
}: {
  metrics: AppMetrics | null;
  setMetrics: (metrics: AppMetrics) => void;
  repairStatus: RepairStatus | null;
  setRepairStatus: (status: RepairStatus) => void;
}): JSX.Element {
  const [repairResult, setRepairResult] = useState('');
  return (
    <section className="space-y-3">
      <div className="panel rounded-md p-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="text-sm font-semibold">Runtime</div>
          <button className="app-button" onClick={() => void api.metrics.get().then(setMetrics)}>
            Refresh
          </button>
        </div>
        <div className="mb-3 text-sm">Memory: {metrics ? `${metrics.totalMemoryMB} MB` : '-'}</div>
        <div className="space-y-1">
          {metrics?.processes.map((process, index) => (
            <div
              key={`${process.type}-${process.name}-${index}`}
              className="grid grid-cols-[120px_1fr_80px] gap-2 rounded-md border border-line px-2 py-1 text-xs"
            >
              <span className="truncate text-muted">{process.type}</span>
              <span className="truncate">{process.name}</span>
              <span className="text-right">{process.memoryMB} MB</span>
            </div>
          ))}
        </div>
      </div>

      <div className="panel rounded-md p-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="text-sm font-semibold">Repair</div>
          <div className="flex gap-2">
            <button
              className="app-button"
              onClick={() => void api.repair.status().then(setRepairStatus)}
            >
              Check
            </button>
            <button
              className="app-button primary"
              onClick={() =>
                void api.repair.run().then((result) => {
                  setRepairStatus(result);
                  setRepairResult(`Fixed ${result.fixed} issues.`);
                })
              }
            >
              Repair
            </button>
          </div>
        </div>
        <div className="grid gap-2 text-xs lg:grid-cols-4">
          <Metric label="DB" value={repairStatus?.integrityOk ? 'OK' : 'Check'} />
          <Metric label="Bad URLs" value={String(repairStatus?.invalidLastUrls.length ?? 0)} />
          <Metric
            label="Missing Recipes"
            value={String(repairStatus?.missingRecipes.length ?? 0)}
          />
          <Metric
            label="Safe Mode"
            value={repairStatus?.safeModeRecommended ? 'Recommended' : 'Not needed'}
          />
        </div>
        {repairResult && <div className="mt-3 text-xs text-muted">{repairResult}</div>}
        {repairStatus?.integrityMessages.some((message) => message !== 'ok') ? (
          <div className="mt-3 space-y-1 text-xs text-muted">
            {repairStatus.integrityMessages.map((message) => (
              <div key={message} className="rounded-md border border-line p-2">
                {message}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function ColorRow({
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

function EmptyState({ label }: { label: string }): JSX.Element {
  return (
    <div className="rounded-md border border-dashed border-line p-6 text-center text-sm text-muted">
      {label}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="panel rounded-md p-3">
      <div className="text-xs uppercase text-muted">{label}</div>
      <div className="mt-1 truncate text-lg font-semibold">{value}</div>
    </div>
  );
}

function numberOrNull(value: string): number | null {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function numberOrDefault(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function proxyFromFields(
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

function registryToCatalog(entry: RecipeRegistryEntry): RecipeCatalogItem {
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

function targetOptions(
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

function labelFromId(value: string): string {
  return value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (char) => char.toUpperCase());
}

function domainsFrom(url: string, rawDomains: string): string[] {
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

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function titleFor(panel: Panel): string {
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
