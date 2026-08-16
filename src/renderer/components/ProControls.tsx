import { Crown, ShieldCheck, SlidersHorizontal, X } from 'lucide-react';
import type { JSX } from 'react';
import { useEffect, useMemo, useState } from 'react';
import type {
  AiPrompt,
  AppMetrics,
  AutomationRule,
  Dashboard,
  DownloadRecord,
  ExtensionRecord,
  FocusMode,
  FocusModeStatus,
  LinkRule,
  LocalExtensionTemplate,
  PeerSyncStatus,
  PerformanceStatus,
  PermissionPolicy,
  PersonalAnalytics,
  PortableModeStatus,
  PrivacyFirewallRule,
  RepairStatus,
  ShortcutBinding,
  TrustStatus,
  WorkKit,
  WorkspaceSnapshot
} from '../../shared/types';
import { api } from '../ipc/client';
import { useAppStore } from '../state/appStore';
import { titleFor } from './procontrols/helpers';
import type { Panel } from './procontrols/helpers';
import { WorkspacePanel } from './procontrols/WorkspacePanel';
import { ProfilePanel } from './procontrols/ProfilePanel';
import { ServicePanel } from './procontrols/ServicePanel';
import { CustomAppPanel } from './procontrols/CustomAppPanel';
import { ExtensionPanel } from './procontrols/ExtensionPanel';
import { CatalogPanel } from './procontrols/CatalogPanel';
import { LinkRulesPanel } from './procontrols/LinkRulesPanel';
import { DashboardPanel } from './procontrols/DashboardPanel';
import { PrivacyPanel } from './procontrols/PrivacyPanel';
import { TrustPanel } from './procontrols/TrustPanel';
import { PerformancePanel } from './procontrols/PerformancePanel';
import { AiWorkflowPanel } from './procontrols/AiWorkflowPanel';
import { AutomationsPanel } from './procontrols/AutomationsPanel';
import { FocusModesPanel } from './procontrols/FocusModesPanel';
import { BrowserImportPanel } from './procontrols/BrowserImportPanel';
import { RecipeStudioPanel } from './procontrols/RecipeStudioPanel';
import { ExtensionPackPanel } from './procontrols/ExtensionPackPanel';
import { FirewallPanel } from './procontrols/FirewallPanel';
import { SnapshotsPanel } from './procontrols/SnapshotsPanel';
import { AnalyticsPanel } from './procontrols/AnalyticsPanel';
import { PortablePanel } from './procontrols/PortablePanel';
import { PeerSyncPanel } from './procontrols/PeerSyncPanel';
import { WorkKitsPanel } from './procontrols/WorkKitsPanel';
import { DownloadsPanel } from './procontrols/DownloadsPanel';
import { ShortcutsPanel } from './procontrols/ShortcutsPanel';
import { SyncPanel } from './procontrols/SyncPanel';
import { ImportPanel } from './procontrols/ImportPanel';
import { DiagnosticsPanel } from './procontrols/DiagnosticsPanel';

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
