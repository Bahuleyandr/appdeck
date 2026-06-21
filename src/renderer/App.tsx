import { useEffect } from 'react';
import { CommandPalette } from './components/CommandPalette';
import { InboxPanel } from './components/InboxPanel';
import { LockScreen } from './components/LockScreen';
import { Onboarding } from './components/Onboarding';
import { ServiceCatalog } from './components/ServiceCatalog';
import { ServiceRail } from './components/ServiceRail';
import { Settings } from './components/Settings';
import { TaskPanel } from './components/TaskPanel';
import { TileLayout } from './components/TileLayout';
import { Toolbar } from './components/Toolbar';
import { WorkspaceRail } from './components/WorkspaceRail';
import type { SettingsMap } from './ipc/client';
import { api } from './ipc/client';
import { useAppStore } from './state/appStore';

export function App(): JSX.Element {
  const { loading, load, setServiceState, setUnread, setLocked, selectService, setCommandOpen, bumpUnread, applySettings } = useAppStore();

  useEffect(() => {
    void load();
    const unsubscribers = [
      api.on('event:service-state', (payload) => {
        const event = payload as { instanceId: string; state: Parameters<typeof setServiceState>[1] };
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
        void load();
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
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandOpen(true);
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 't') {
        const state = useAppStore.getState();
        const active = state.selectedServiceIds[0];
        if (active) {
          event.preventDefault();
          void state.newTab(active);
        }
      }
    };
    window.addEventListener('keydown', keyHandler);
    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
      window.removeEventListener('keydown', keyHandler);
    };
  }, [load, selectService, setCommandOpen, setLocked, setServiceState, setUnread, bumpUnread, applySettings]);

  if (loading) {
    return <div className="flex h-full items-center justify-center bg-shell text-muted">Loading AppDeck</div>;
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
      <ServiceCatalog />
      <CommandPalette />
      <Settings />
      <Onboarding />
      <LockScreen />
    </div>
  );
}
