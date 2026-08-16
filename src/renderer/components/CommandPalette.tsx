import type { JSX } from 'react';
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent
} from 'react';
import { Search, X } from 'lucide-react';
import type { PaletteItem } from '../../shared/types';
import { api } from '../ipc/client';
import { useAppStore } from '../state/appStore';

export function CommandPalette(): JSX.Element | null {
  const {
    commandOpen,
    setCommandOpen,
    selectService,
    selectWorkspace,
    lock,
    selectedServiceIds,
    markNotificationRead,
    setDashboardOpen,
    setProControlsOpen,
    setSettingsOpen,
    setTaskPanelOpen,
    setCatalogOpen
  } = useAppStore();
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<PaletteItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listId = useId();
  const optionId = (index: number): string => `${listId}-option-${index}`;
  const listRef = useRef<HTMLDivElement | null>(null);

  // The list scrolls at ~9 rows; keep the keyboard selection inside the viewport so Enter can
  // never activate a row the user cannot see.
  useEffect(() => {
    if (!commandOpen) return;
    const active = listRef.current?.querySelector(`#${CSS.escape(optionId(selectedIndex))}`);
    active?.scrollIntoView({ block: 'nearest' });
  }, [commandOpen, selectedIndex, items]);

  useEffect(() => {
    if (!commandOpen) return;
    // Debounce + cancel so a slow older query can never overwrite a newer result set.
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void api.palette.query(query).then((results) => {
        if (cancelled) return;
        setItems(results);
        setSelectedIndex(0);
      });
    }, 120);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [commandOpen, query]);
  if (!commandOpen) return null;

  const activate = (item: PaletteItem): void => {
    setCommandOpen(false);
    if (item.action === 'select-service') void selectService(item.id);
    if (item.action === 'select-workspace') void selectWorkspace(item.id);
    if (item.action === 'lock') void lock();
    if (item.action === 'reload' && selectedServiceIds[0])
      void api.services.reload(selectedServiceIds[0]);
    if (item.action === 'open-dashboard') setDashboardOpen(true);
    if (item.action === 'open-pro-controls') setProControlsOpen(true);
    if (item.action === 'open-downloads') setProControlsOpen(true, 'downloads');
    if (item.action === 'open-automations') setProControlsOpen(true, 'automations');
    if (item.action === 'open-focus-modes') setProControlsOpen(true, 'focus');
    if (item.action === 'open-browser-bookmarks') setProControlsOpen(true, 'browserImport');
    if (item.action === 'open-recipe-studio') setProControlsOpen(true, 'recipeStudio');
    if (item.action === 'open-firewall') setProControlsOpen(true, 'firewall');
    if (item.action === 'open-snapshots') setProControlsOpen(true, 'snapshots');
    if (item.action === 'open-analytics') setProControlsOpen(true, 'analytics');
    if (item.action === 'open-work-kits') setProControlsOpen(true, 'workKits');
    if (item.action === 'open-peer-sync') setProControlsOpen(true, 'peerSync');
    if (item.action === 'open-portable') setProControlsOpen(true, 'portable');
    if (item.action === 'open-settings') setSettingsOpen(true);
    if (item.action === 'open-tasks') setTaskPanelOpen(true);
    if (item.action === 'add-service' || item.action === 'open-add-service') setCatalogOpen(true);
    if (item.action === 'open-download') void api.downloads.open(item.id);
    if (item.action === 'open-notification' && item.instanceId) {
      void markNotificationRead(Number(item.id));
      void selectService(item.instanceId);
    }
  };

  const handleKeyDown = (event: ReactKeyboardEvent): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      setCommandOpen(false);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelectedIndex((current) => Math.min(current + 1, Math.max(items.length - 1, 0)));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelectedIndex((current) => Math.max(current - 1, 0));
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const item = items[selectedIndex];
      if (item) activate(item);
    }
  };

  return (
    <div className="absolute inset-0 z-50 flex items-start justify-center bg-black/45 pt-24">
      {/* Key handling lives on the container so Escape and the arrows keep working after focus
          moves off the input (tabbing, or clicking a result). */}
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="w-[620px] rounded-md border border-line bg-panel shadow-2xl"
        onKeyDown={handleKeyDown}
      >
        <div className="flex h-12 items-center gap-2 border-b border-line px-3">
          <Search size={16} aria-hidden="true" className="text-muted" />
          <input
            className="h-full flex-1 bg-transparent text-sm outline-hidden"
            autoFocus
            role="combobox"
            aria-expanded
            aria-controls={listId}
            aria-activedescendant={items.length ? optionId(selectedIndex) : undefined}
            aria-label="Search services, workspaces, notifications and commands"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <button
            className="icon-button"
            aria-label="Close"
            title="Close"
            onClick={() => setCommandOpen(false)}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <div id={listId} ref={listRef} role="listbox" className="max-h-96 overflow-y-auto p-2">
          {items.map((item, index) => {
            const selected = index === selectedIndex;
            return (
              <button
                key={`${item.type}-${item.id}`}
                id={optionId(index)}
                role="option"
                aria-selected={selected}
                // Selection needs to read differently from a passing hover, so it keeps a ring
                // rather than only the shared background tint.
                className={`flex h-10 w-full items-center justify-between rounded-md px-3 text-left text-sm hover:bg-shell/60 ${
                  selected ? 'bg-shell ring-1 ring-accent' : ''
                }`}
                onMouseEnter={() => setSelectedIndex(index)}
                onClick={() => activate(item)}
              >
                <span className="flex min-w-0 flex-col">
                  <span className="truncate">{item.label}</span>
                  {item.sublabel && (
                    <span className="truncate text-xs text-muted">{item.sublabel}</span>
                  )}
                </span>
                <span className="ml-2 shrink-0 text-xs text-muted">{item.type}</span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
