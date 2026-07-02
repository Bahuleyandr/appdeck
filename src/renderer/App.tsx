import { lazy, Suspense, useEffect } from 'react';
import { CommandPalette } from './components/CommandPalette';
import { InboxPanel } from './components/InboxPanel';
import { LockScreen } from './components/LockScreen';
import { Onboarding } from './components/Onboarding';
import { ServiceRail } from './components/ServiceRail';
import { TaskPanel } from './components/TaskPanel';
import { TileLayout } from './components/TileLayout';
import { Toolbar } from './components/Toolbar';
import { WorkspaceRail } from './components/WorkspaceRail';
import type { SettingsMap } from './ipc/client';
import { api } from './ipc/client';
import { useAppStore } from './state/appStore';

// Heavy, infrequently-opened panels are code-split so their JS only downloads on first open,
// keeping the initial renderer bundle small. ProControls alone is the bulk of the chunk.
const ProControls = lazy(() =>
  import('./components/ProControls').then((module) => ({ default: module.ProControls }))
);
const DashboardHome = lazy(() =>
  import('./components/DashboardHome').then((module) => ({ default: module.DashboardHome }))
);
const Settings = lazy(() =>
  import('./components/Settings').then((module) => ({ default: module.Settings }))
);
const ServiceCatalog = lazy(() =>
  import('./components/ServiceCatalog').then((module) => ({ default: module.ServiceCatalog }))
);

// Service-affecting shortcuts must not fire while the user is typing in a field; app-level ones
// (palette, settings, lock) stay global like in mainstream launchers.
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  if (target.isContentEditable) {
    return true;
  }
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

export function App(): JSX.Element {
  const {
    loading,
    loadError,
    load,
    setServiceState,
    setUnread,
    setLocked,
    selectService,
    setCommandOpen,
    bumpUnread,
    applySettings,
    proControlsOpen,
    dashboardOpen,
    settingsOpen,
    catalogOpen
  } = useAppStore();

  useEffect(() => {
    void load();
    // Bursty mutations (drag-reorder, work-kit apply) fire many data-changed events; coalesce
    // them into one reload instead of racing parallel full refetches.
    let reloadTimer: number | undefined;
    const unsubscribers = [
      api.on('event:service-state', (payload) => {
        const event = payload as {
          instanceId: string;
          state: Parameters<typeof setServiceState>[1];
        };
        setServiceState(event.instanceId, event.state);
      }),
      api.on('event:unread', (payload) => {
        const event = payload as { instanceId: string; count: Parameters<typeof setUnread>[1] };
        setUnread(event.instanceId, event.count);
      }),
      api.on('event:locked', () => setLocked(true)),
      api.on('event:notification-clicked', (payload) => {
        const event = payload as { instanceId: string };
        void selectService(event.instanceId);
      }),
      api.on('event:data-changed', () => {
        window.clearTimeout(reloadTimer);
        reloadTimer = window.setTimeout(() => {
          void load();
        }, 150);
      }),
      api.on('event:notification', (payload) => {
        const event = payload as { unread?: number };
        if (typeof event.unread === 'number') bumpUnread(event.unread);
      }),
      api.on('event:settings-changed', (payload) => {
        applySettings(payload as SettingsMap);
      })
    ];
    const keyHandler = (event: KeyboardEvent): void => {
      const mod = event.ctrlKey || event.metaKey;
      const state = useAppStore.getState();
      const active = state.selectedServiceIds[0];
      const typing = isEditableTarget(event.target);

      if (mod && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandOpen(true);
        return;
      }
      if (mod && event.key.toLowerCase() === 't' && active && !typing) {
        event.preventDefault();
        void state.newTab(active);
        return;
      }
      if (mod && event.key === ',') {
        event.preventDefault();
        state.setSettingsOpen(true);
        return;
      }
      if (mod && event.key.toLowerCase() === 'l') {
        event.preventDefault();
        void state.lock();
        return;
      }
      if (mod && event.key.toLowerCase() === 'r' && active && !typing) {
        event.preventDefault();
        void api.services.reload(active);
        return;
      }
      // Ctrl/Cmd + 1..9 jumps to the Nth (enabled) service.
      if (mod && /^[1-9]$/.test(event.key) && !typing) {
        const target = state.services.filter((s) => !s.disabled)[Number(event.key) - 1];
        if (target) {
          event.preventDefault();
          void state.selectService(target.id);
        }
        return;
      }
      // Ctrl+Tab / Ctrl+Shift+Tab cycles tabs within the active service.
      if (event.ctrlKey && event.key === 'Tab' && active && !typing) {
        const list = state.tabs[active] ?? [];
        if (list.length > 1) {
          event.preventDefault();
          const cur = Math.max(
            0,
            list.findIndex((tab) => tab.active)
          );
          const target = list[(cur + (event.shiftKey ? -1 : 1) + list.length) % list.length];
          if (target) void state.selectTab(active, target.id);
        }
        return;
      }
      // Ctrl/Cmd + W closes the active tab, but never the last one (the pane would vanish).
      if (mod && event.key.toLowerCase() === 'w' && active && !typing) {
        const list = state.tabs[active] ?? [];
        const cur = list.find((tab) => tab.active) ?? list[0];
        if (list.length > 1 && cur) {
          event.preventDefault();
          void state.closeTab(active, cur.id);
        }
      }
    };
    window.addEventListener('keydown', keyHandler);
    return () => {
      window.clearTimeout(reloadTimer);
      unsubscribers.forEach((unsubscribe) => unsubscribe());
      window.removeEventListener('keydown', keyHandler);
    };
  }, [
    load,
    selectService,
    setCommandOpen,
    setLocked,
    setServiceState,
    setUnread,
    bumpUnread,
    applySettings
  ]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-shell text-muted">
        Loading AppDeck
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-shell text-ink">
        <div className="text-lg font-semibold">AppDeck could not load</div>
        <div className="max-w-lg break-words text-center text-sm text-muted">{loadError}</div>
        <button className="app-button primary" onClick={() => void load()}>
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="relative flex h-full w-full overflow-hidden bg-shell text-ink">
      <WorkspaceRail />
      <ServiceRail />
      <div className="flex min-w-0 flex-1 flex-col">
        <Toolbar />
        <TileLayout />
      </div>
      <InboxPanel />
      <TaskPanel />
      <CommandPalette />
      <Onboarding />
      <LockScreen />
      <Suspense fallback={null}>
        {catalogOpen && <ServiceCatalog />}
        {proControlsOpen && <ProControls />}
        {dashboardOpen && <DashboardHome />}
        {settingsOpen && <Settings />}
      </Suspense>
    </div>
  );
}
