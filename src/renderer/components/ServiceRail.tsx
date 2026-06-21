import { MessageCircle, Plus, Trash2 } from 'lucide-react';
import { useAppStore } from '../state/appStore';

export function ServiceRail(): JSX.Element {
  const { services, selectedServiceIds, unread, selectService, setCatalogOpen, deleteService } = useAppStore();
  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-line bg-panel">
      <div className="flex h-12 items-center justify-between border-b border-line px-3">
        <span className="text-sm font-semibold text-ink">Services</span>
        <button className="icon-button" title="Add service" onClick={() => setCatalogOpen(true)}>
          <Plus size={17} />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {services.map((service) => {
          const selected = selectedServiceIds.includes(service.id);
          const count = unread[service.id]?.direct ?? 0;
          return (
            <div
              key={service.id}
              className={`group mb-1 flex h-11 items-center gap-2 rounded-md border px-2 ${
                selected ? 'border-accent bg-accent/10' : 'border-transparent hover:border-line hover:bg-shell'
              }`}
            >
              <button className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => void selectService(service.id)}>
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white"
                  style={{ backgroundColor: service.color ?? '#475569' }}
                >
                  <MessageCircle size={15} />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm">{service.display_name}</span>
                {count > 0 ? (
                  <span className="rounded-full bg-accent px-1.5 text-xs font-bold text-shell">{count}</span>
                ) : null}
              </button>
              <button
                className="hidden text-muted hover:text-white group-hover:block"
                title="Remove service"
                onClick={() => void deleteService(service.id)}
              >
                <Trash2 size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
