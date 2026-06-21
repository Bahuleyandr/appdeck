import { useEffect, useMemo, useRef } from 'react';
import { ExternalLink, Moon, Plus, RefreshCw, X } from 'lucide-react';
import type { ServiceInstance, ServiceTab } from '../../shared/types';
import { api } from '../ipc/client';
import { useAppStore } from '../state/appStore';

const STRIP_H = 30;

export function TileLayout(): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { services, selectedServiceIds, layoutMode, serviceStates, tabs, loadTabs, newTab, closeTab, selectTab, settingsOpen, catalogOpen, commandOpen, taskPanelOpen, inboxOpen, locked, settings } =
    useAppStore();
  // Native WebContentsViews paint above the HTML layer. Full-screen modals must hide the panes
  // entirely; side panels (Inbox/Tasks) are flex columns that shrink the container instead, so the
  // ResizeObserver recomputes pane bounds to the narrower area — no overlap, service stays visible.
  const modalOpen = settingsOpen || catalogOpen || commandOpen || locked || settings.onboarded !== 'true';

  const visibleServices = useMemo(() => {
    const selected = selectedServiceIds
      .map((id) => services.find((service) => service.id === id))
      .filter((service): service is NonNullable<typeof service> => Boolean(service));
    return selected.length ? selected : services.slice(0, layoutMode === 'single' ? 1 : layoutMode === 'split' ? 2 : 4);
  }, [layoutMode, selectedServiceIds, services]);

  const activeTab = (service: ServiceInstance): ServiceTab | undefined => {
    const list = tabs[service.id];
    return list?.find((tab) => tab.active) ?? list?.[0];
  };
  const isLauncher = (service: ServiceInstance): boolean => service.recipe_id === 'signal';

  // Ensure tabs are loaded for every visible (non-launcher) service.
  useEffect(() => {
    for (const service of visibleServices) {
      if (!isLauncher(service) && !tabs[service.id]) {
        void loadTabs(service.id);
      }
    }
  }, [visibleServices, tabs, loadTabs]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    let frame = 0;
    const syncBounds = (): void => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (modalOpen) {
          void api.views.setBounds({ entries: [], visibleIds: [] });
          return;
        }
        const root = node.getBoundingClientRect();
        const entries = visibleServices
          .map((service, index) => {
            const sleeping = (serviceStates[service.id] ?? 'ready') === 'sleeping';
            const tab = activeTab(service);
            if (isLauncher(service) || sleeping || !tab) {
              return null;
            }
            const cell = slotRect(root, index, visibleServices.length, layoutMode);
            // Strip only shows at 2+ tabs; single-tab services use the full pane.
            const top = (tabs[service.id]?.length ?? 0) > 1 ? STRIP_H : 0;
            return {
              viewId: `${service.id}#${tab.id}`,
              rect: { x: cell.x, y: cell.y + top, width: cell.width, height: Math.max(0, cell.height - top) }
            };
          })
          .filter((entry): entry is { viewId: string; rect: { x: number; y: number; width: number; height: number } } => entry !== null);
        void api.views.setBounds({ entries, visibleIds: entries.map((entry) => entry.viewId) });
      });
    };
    const observer = new ResizeObserver(syncBounds);
    observer.observe(node);
    syncBounds();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      void api.views.setBounds({ entries: [], visibleIds: [] });
    };
  }, [layoutMode, visibleServices, serviceStates, tabs, modalOpen, inboxOpen, taskPanelOpen]);

  if (!visibleServices.length) {
    return (
      <main className="flex flex-1 items-center justify-center bg-shell text-muted">
        <button className="app-button" onClick={() => useAppStore.getState().setCatalogOpen(true)}>
          Add service
        </button>
      </main>
    );
  }

  return (
    <main ref={containerRef} className="relative flex-1 overflow-hidden bg-shell">
      <div className={`grid h-full gap-2 p-2 ${layoutMode === 'single' ? 'grid-cols-1' : layoutMode === 'split' ? 'grid-cols-2' : 'grid-cols-2 grid-rows-2'}`}>
        {visibleServices.map((service) => {
          const state = serviceStates[service.id] ?? 'ready';
          const launcher = isLauncher(service);
          const serviceTabs = tabs[service.id] ?? [];
          const current = activeTab(service);
          return (
            <section key={service.id} className="relative flex flex-col overflow-hidden rounded-md border border-line bg-panel">
              {!launcher && serviceTabs.length > 1 && (
                <div className="flex h-[30px] shrink-0 items-center gap-1 overflow-x-auto border-b border-line bg-shell px-1">
                  {serviceTabs.map((tab) => (
                    <div
                      key={tab.id}
                      className={`flex h-6 max-w-40 shrink-0 items-center gap-1 rounded px-2 text-xs ${tab.id === current?.id ? 'bg-panel text-ink' : 'text-muted hover:text-ink'}`}
                    >
                      <button className="truncate" onClick={() => void selectTab(service.id, tab.id)}>
                        {tab.title || service.display_name}
                      </button>
                      {serviceTabs.length > 1 && (
                        <button className="text-muted hover:text-white" onClick={() => void closeTab(service.id, tab.id)}>
                          <X size={11} />
                        </button>
                      )}
                    </div>
                  ))}
                  <button className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted hover:text-white" title="New tab" onClick={() => void newTab(service.id)}>
                    <Plus size={13} />
                  </button>
                </div>
              )}
              <div className="relative flex-1">
                {(state === 'sleeping' || state === 'crashed' || launcher) && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-panel text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-md border border-line text-muted">
                      {launcher ? <ExternalLink size={22} /> : state === 'sleeping' ? <Moon size={22} /> : <RefreshCw size={22} />}
                    </div>
                    <div className="text-sm font-semibold">{service.display_name}</div>
                    <div className="max-w-sm px-6 text-xs text-muted">
                      {launcher ? 'Signal opens through the installed desktop client.' : state === 'sleeping' ? 'Sleeping' : 'Crashed'}
                    </div>
                    {!launcher && (
                      <button className="app-button" onClick={() => void api.services.wake(service.id)}>
                        Wake
                      </button>
                    )}
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}

function slotRect(root: DOMRect, index: number, count: number, mode: 'single' | 'split' | 'grid'): { x: number; y: number; width: number; height: number } {
  const gap = 8;
  const padding = 8;
  const x = root.x + padding;
  const y = root.y + padding;
  const width = root.width - padding * 2;
  const height = root.height - padding * 2;
  if (mode === 'single' || count === 1) {
    return { x, y, width, height };
  }
  if (mode === 'split') {
    const each = (width - gap) / 2;
    return { x: x + index * (each + gap), y, width: each, height };
  }
  const cols = 2;
  const rows = Math.ceil(Math.min(count, 4) / cols);
  const cellW = (width - gap) / cols;
  const cellH = (height - gap * (rows - 1)) / rows;
  return {
    x: x + (index % cols) * (cellW + gap),
    y: y + Math.floor(index / cols) * (cellH + gap),
    width: cellW,
    height: cellH
  };
}
