import {
  Bell,
  BellOff,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  RefreshCw,
  Sun,
  Trash2,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { api } from '../ipc/client';
import { useAppStore } from '../state/appStore';

const WIDTH_KEY = 'appdeck.sidebar.width';
const COLLAPSED_KEY = 'appdeck.sidebar.collapsed';
const MIN_WIDTH = 180;
const MAX_WIDTH = 480;
const DEFAULT_WIDTH = 256;
const COLLAPSED_WIDTH = 56;

function readWidth(): number {
  const raw = Number.parseInt(localStorage.getItem(WIDTH_KEY) ?? '', 10);
  if (!Number.isFinite(raw)) return DEFAULT_WIDTH;
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, raw));
}

export function ServiceRail(): JSX.Element {
  const {
    services,
    selectedServiceIds,
    serviceStates,
    unread,
    selectService,
    setCatalogOpen,
    deleteService,
    updateService,
    reorderServices,
    sleepService,
    wakeService
  } = useAppStore();
  const [width, setWidth] = useState(readWidth);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSED_KEY) === 'true');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [dragId, setDragId] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const dragging = useRef(false);
  const showMemory = useAppStore((state) => state.settings.show_memory_badges === 'true');
  const [memoryByService, setMemoryByService] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!showMemory) {
      setMemoryByService({});
      return;
    }
    let cancelled = false;
    const poll = (): void => {
      void api.metrics.get().then((metrics) => {
        if (cancelled) return;
        const next: Record<string, number> = {};
        for (const row of metrics.services ?? []) {
          next[row.instanceId] = row.memoryMB;
        }
        setMemoryByService(next);
      });
    };
    poll();
    const timer = window.setInterval(poll, 10_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [showMemory]);

  useEffect(() => {
    localStorage.setItem(WIDTH_KEY, String(width));
  }, [width]);
  useEffect(() => {
    localStorage.setItem(COLLAPSED_KEY, String(collapsed));
  }, [collapsed]);
  useEffect(() => {
    if (!menu) return;
    const close = (): void => setMenu(null);
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setMenu(null);
    };
    window.addEventListener('click', close);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [menu]);

  const startResize = (event: ReactPointerEvent): void => {
    event.preventDefault();
    dragging.current = true;
    const startX = event.clientX;
    const startWidth = width;
    const onMove = (move: PointerEvent): void => {
      if (!dragging.current) return;
      setWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + (move.clientX - startX))));
    };
    const onUp = (): void => {
      dragging.current = false;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const startRename = (id: string, name: string): void => {
    setMenu(null);
    setEditingId(id);
    setDraft(name);
  };
  const commitRename = async (id: string, current: string): Promise<void> => {
    const name = draft.trim();
    setEditingId(null);
    if (name && name !== current) await updateService(id, { display_name: name });
  };

  const dropOn = (targetId: string): void => {
    if (!dragId || dragId === targetId) {
      setDragId(null);
      return;
    }
    const ids = services.map((service) => service.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    setDragId(null);
    if (from < 0 || to < 0) return;
    ids.splice(from, 1);
    ids.splice(to, 0, dragId);
    void reorderServices(ids);
  };

  const adjustZoom = (id: string, delta: number | null): void => {
    const current = services.find((service) => service.id === id)?.zoom_factor ?? 1;
    const next = delta === null ? 1 : Math.min(2.5, Math.max(0.5, Math.round((current + delta) * 10) / 10));
    void api.services.setZoom(id, next);
    void updateService(id, { zoom_factor: next });
    setMenu(null);
  };

  if (collapsed) {
    return (
      <aside
        className="flex h-full shrink-0 flex-col items-center gap-1 border-r border-line bg-panel py-2"
        style={{ width: COLLAPSED_WIDTH }}
      >
        <button
          className="icon-button h-8 w-8"
          title="Expand services"
          onClick={() => setCollapsed(false)}
        >
          <PanelLeftOpen size={16} />
        </button>
        <div className="my-1 h-px w-6 bg-line" />
        <div className="flex min-h-0 flex-1 flex-col items-center gap-1 overflow-y-auto">
          {services.map((service) => {
            const selected = selectedServiceIds.includes(service.id);
            const count = unread[service.id]?.direct ?? 0;
            return (
              <button
                key={service.id}
                className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-xs font-semibold text-white transition ${
                  selected ? 'ring-2 ring-accent' : service.disabled ? 'opacity-40' : 'hover:opacity-80'
                }`}
                style={{ backgroundColor: service.color ?? '#475569' }}
                disabled={service.disabled}
                title={service.display_name}
                onClick={() => void selectService(service.id)}
              >
                {service.display_name.charAt(0).toUpperCase()}
                {count > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold leading-none text-shell">
                    {count > 99 ? '99+' : count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <button
          className="icon-button h-8 w-8"
          title="Add service"
          onClick={() => setCatalogOpen(true)}
        >
          <Plus size={16} />
        </button>
      </aside>
    );
  }

  const menuService = menu ? services.find((service) => service.id === menu.id) : undefined;

  return (
    <aside
      className="relative flex h-full shrink-0 flex-col border-r border-line bg-panel"
      style={{ width }}
    >
      <div className="flex h-12 items-center justify-between border-b border-line px-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">Services</span>
        <div className="flex items-center gap-1">
          <button
            className="icon-button h-7 w-7"
            title="Add service"
            onClick={() => setCatalogOpen(true)}
          >
            <Plus size={16} />
          </button>
          <button
            className="icon-button h-7 w-7"
            title="Collapse sidebar"
            onClick={() => setCollapsed(true)}
          >
            <PanelLeftClose size={16} />
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {services.length === 0 && (
          <button
            className="mt-4 w-full rounded-lg border border-dashed border-line px-3 py-6 text-center text-xs text-muted hover:border-accent/60 hover:text-ink"
            onClick={() => setCatalogOpen(true)}
          >
            Add your first service
          </button>
        )}
        {services.map((service) => {
          const selected = selectedServiceIds.includes(service.id);
          const count = unread[service.id]?.direct ?? 0;
          const editing = editingId === service.id;
          return (
            <div
              key={service.id}
              draggable={!editing}
              onDragStart={() => setDragId(service.id)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => dropOn(service.id)}
              onContextMenu={(event) => {
                event.preventDefault();
                setMenu({ id: service.id, x: event.clientX, y: event.clientY });
              }}
              className={`group relative mb-0.5 flex h-11 items-center gap-2.5 rounded-lg px-2 transition-colors ${
                selected ? 'bg-elevated' : service.disabled ? 'opacity-40' : 'hover:bg-elevated/50'
              } ${dragId === service.id ? 'opacity-50' : ''}`}
            >
              {selected && (
                <span className="absolute bottom-2 left-0 top-2 w-0.5 rounded-full bg-accent" />
              )}
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-semibold text-white"
                style={{ backgroundColor: service.color ?? '#475569' }}
              >
                {service.display_name.charAt(0).toUpperCase()}
              </span>
              {editing ? (
                <input
                  className="field h-7 min-w-0 flex-1 px-2 py-0 text-sm"
                  autoFocus
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onBlur={() => void commitRename(service.id, service.display_name)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void commitRename(service.id, service.display_name);
                    if (event.key === 'Escape') setEditingId(null);
                  }}
                />
              ) : (
                <button
                  className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                  disabled={service.disabled}
                  title={service.disabled ? `${service.display_name} disabled` : service.display_name}
                  onClick={() => void selectService(service.id)}
                  onDoubleClick={() => startRename(service.id, service.display_name)}
                >
                  <span
                    className={`min-w-0 flex-1 truncate text-sm ${selected ? 'text-ink' : 'text-ink/85'}`}
                  >
                    {service.display_name}
                  </span>
                  {service.muted && <BellOff size={12} className="shrink-0 text-muted" />}
                  {service.disabled && (
                    <span className="rounded bg-elevated px-1.5 py-0.5 text-[11px] text-muted">
                      off
                    </span>
                  )}
                  {showMemory && memoryByService[service.id] !== undefined && (
                    <span
                      className="rounded bg-elevated px-1.5 py-0.5 text-[11px] tabular-nums text-muted"
                      title="Approximate renderer memory (0 = sleeping)"
                    >
                      {memoryByService[service.id]} MB
                    </span>
                  )}
                  {count > 0 && (
                    <span className="rounded-full bg-accent px-1.5 py-0.5 text-[11px] font-semibold leading-none text-shell">
                      {count > 99 ? '99+' : count}
                    </span>
                  )}
                </button>
              )}
              {!editing && (
                <div className="flex shrink-0 items-center opacity-0 transition group-hover:opacity-100">
                  <button
                    className="p-1 text-muted hover:text-ink"
                    title="Rename"
                    onClick={() => startRename(service.id, service.display_name)}
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    className="p-1 text-muted hover:text-ink"
                    title="Remove service"
                    onClick={() => void deleteService(service.id)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div
        className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-accent/40"
        onPointerDown={startResize}
        title="Drag to resize"
      />
      {menu && menuService && (
        <div
          className="fixed z-[90] w-44 overflow-hidden rounded-md border border-line bg-panel py-1 text-sm shadow-2xl"
          style={{ left: menu.x, top: menu.y }}
          onClick={(event) => event.stopPropagation()}
        >
          <MenuItem
            icon={<Pencil size={14} />}
            label="Rename"
            onClick={() => startRename(menuService.id, menuService.display_name)}
          />
          <MenuItem
            icon={menuService.muted ? <Bell size={14} /> : <BellOff size={14} />}
            label={menuService.muted ? 'Unmute' : 'Mute'}
            onClick={() => {
              void updateService(menuService.id, { muted: !menuService.muted });
              setMenu(null);
            }}
          />
          <MenuItem
            icon={
              serviceStates[menuService.id] === 'sleeping' ? <Sun size={14} /> : <Moon size={14} />
            }
            label={serviceStates[menuService.id] === 'sleeping' ? 'Wake' : 'Sleep'}
            onClick={() => {
              if (serviceStates[menuService.id] === 'sleeping') void wakeService(menuService.id);
              else void sleepService(menuService.id);
              setMenu(null);
            }}
          />
          <MenuItem
            icon={<RefreshCw size={14} />}
            label="Reload"
            onClick={() => {
              void api.services.reload(menuService.id);
              setMenu(null);
            }}
          />
          <div className="my-1 h-px bg-line" />
          <MenuItem
            icon={<ZoomIn size={14} />}
            label="Zoom in"
            onClick={() => adjustZoom(menuService.id, 0.1)}
          />
          <MenuItem
            icon={<ZoomOut size={14} />}
            label="Zoom out"
            onClick={() => adjustZoom(menuService.id, -0.1)}
          />
          <MenuItem icon={null} label="Reset zoom" onClick={() => adjustZoom(menuService.id, null)} />
          <div className="my-1 h-px bg-line" />
          <MenuItem
            icon={<Trash2 size={14} />}
            label="Remove"
            danger
            onClick={() => {
              void deleteService(menuService.id);
              setMenu(null);
            }}
          />
        </div>
      )}
    </aside>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  danger
}: {
  icon: JSX.Element | null;
  label: string;
  onClick: () => void;
  danger?: boolean;
}): JSX.Element {
  return (
    <button
      className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-elevated ${
        danger ? 'text-red-300' : 'text-ink/90'
      }`}
      onClick={onClick}
    >
      <span className="flex w-4 justify-center text-muted">{icon}</span>
      {label}
    </button>
  );
}
