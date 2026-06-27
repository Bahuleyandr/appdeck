import {
  Bell,
  BellOff,
  Columns2,
  Crown,
  Grid2X2,
  Inbox,
  LayoutDashboard,
  Lock,
  PanelRight,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Square,
  SquarePlus
} from 'lucide-react';
import { api } from '../ipc/client';
import { useAppStore } from '../state/appStore';

export function Toolbar(): JSX.Element {
  const {
    selectedServiceIds,
    layoutMode,
    setLayoutMode,
    setCatalogOpen,
    setCommandOpen,
    setSettingsOpen,
    setProControlsOpen,
    setTaskPanelOpen,
    setInboxOpen,
    setDashboardOpen,
    unreadNotifications,
    settings,
    toggleDnd,
    newTab,
    lock
  } = useAppStore();
  const activeService = selectedServiceIds[0];
  const dnd = settings.global_dnd === 'true';
  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-line bg-shell px-3">
      <button className="icon-button" title="Add service" onClick={() => setCatalogOpen(true)}>
        <Plus size={17} />
      </button>
      <button
        className="icon-button"
        title="Reload"
        disabled={!activeService}
        onClick={() => activeService && void api.services.reload(activeService)}
      >
        <RefreshCw size={16} />
      </button>
      <button
        className="icon-button"
        title="New tab (Ctrl+T)"
        disabled={!activeService}
        onClick={() => activeService && void newTab(activeService)}
      >
        <SquarePlus size={16} />
      </button>
      <div className="mx-2 h-6 w-px bg-line" />
      <button
        className={`icon-button ${layoutMode === 'single' ? 'bg-elevated text-ink ring-1 ring-inset ring-accent/60' : ''}`}
        title="Single view"
        onClick={() => void setLayoutMode('single')}
      >
        <Square size={16} />
      </button>
      <button
        className={`icon-button ${layoutMode === 'split' ? 'bg-elevated text-ink ring-1 ring-inset ring-accent/60' : ''}`}
        title="Split view"
        onClick={() => void setLayoutMode('split')}
      >
        <Columns2 size={16} />
      </button>
      <button
        className={`icon-button ${layoutMode === 'grid' ? 'bg-elevated text-ink ring-1 ring-inset ring-accent/60' : ''}`}
        title="Grid view"
        onClick={() => void setLayoutMode('grid')}
      >
        <Grid2X2 size={16} />
      </button>
      <div className="flex-1" />
      <button
        className={`icon-button ${dnd ? 'bg-elevated text-ink ring-1 ring-inset ring-accent/60' : ''}`}
        title={dnd ? 'Do Not Disturb on' : 'Do Not Disturb off'}
        onClick={() => void toggleDnd()}
      >
        {dnd ? <BellOff size={16} /> : <Bell size={16} />}
      </button>
      <button className="icon-button" title="Dashboard home" onClick={() => setDashboardOpen(true)}>
        <LayoutDashboard size={16} />
      </button>
      <button className="icon-button relative" title="Inbox" onClick={() => setInboxOpen(true)}>
        <Inbox size={16} />
        {unreadNotifications > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-black">
            {unreadNotifications > 99 ? '99+' : unreadNotifications}
          </span>
        )}
      </button>
      <button className="icon-button" title="Command palette" onClick={() => setCommandOpen(true)}>
        <Search size={16} />
      </button>
      <button className="icon-button" title="Tasks" onClick={() => setTaskPanelOpen(true)}>
        <PanelRight size={16} />
      </button>
      <button
        className="icon-button"
        title="Control Center"
        onClick={() => setProControlsOpen(true)}
      >
        <Crown size={16} />
      </button>
      <button className="icon-button" title="Settings" onClick={() => setSettingsOpen(true)}>
        <Settings size={16} />
      </button>
      <button className="icon-button" title="Lock" onClick={() => void lock()}>
        <Lock size={16} />
      </button>
    </header>
  );
}
