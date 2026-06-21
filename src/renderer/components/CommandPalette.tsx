import { useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';
import type { PaletteItem } from '../../shared/types';
import { api } from '../ipc/client';
import { useAppStore } from '../state/appStore';

export function CommandPalette(): JSX.Element | null {
  const { commandOpen, setCommandOpen, selectService, selectWorkspace, lock, selectedServiceIds, markNotificationRead } = useAppStore();
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<PaletteItem[]>([]);
  useEffect(() => {
    if (!commandOpen) return;
    void api.palette.query(query).then(setItems);
  }, [commandOpen, query]);
  if (!commandOpen) return null;
  return (
    <div className="absolute inset-0 z-50 flex items-start justify-center bg-black/45 pt-24">
      <section className="w-[620px] rounded-md border border-line bg-panel shadow-2xl">
        <div className="flex h-12 items-center gap-2 border-b border-line px-3">
          <Search size={16} className="text-muted" />
          <input className="h-full flex-1 bg-transparent text-sm outline-none" autoFocus value={query} onChange={(event) => setQuery(event.target.value)} />
          <button className="icon-button" title="Close" onClick={() => setCommandOpen(false)}>
            <X size={16} />
          </button>
        </div>
        <div className="max-h-96 overflow-y-auto p-2">
          {items.map((item) => (
            <button
              key={`${item.type}-${item.id}`}
              className="flex h-10 w-full items-center justify-between rounded-md px-3 text-left text-sm hover:bg-shell"
              onClick={() => {
                setCommandOpen(false);
                if (item.action === 'select-service') void selectService(item.id);
                if (item.action === 'select-workspace') void selectWorkspace(item.id);
                if (item.action === 'lock') void lock();
                if (item.action === 'reload' && selectedServiceIds[0]) void api.services.reload(selectedServiceIds[0]);
                if (item.action === 'open-notification' && item.instanceId) {
                  void markNotificationRead(Number(item.id));
                  void selectService(item.instanceId);
                }
              }}
            >
              <span className="flex min-w-0 flex-col">
                <span className="truncate">{item.label}</span>
                {item.sublabel && <span className="truncate text-xs text-muted">{item.sublabel}</span>}
              </span>
              <span className="ml-2 shrink-0 text-xs text-muted">{item.type}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
