import { Plus, Trash2 } from 'lucide-react';
import { useAppStore } from '../state/appStore';

export function ServiceRail(): JSX.Element {
  const { services, selectedServiceIds, unread, selectService, setCatalogOpen, deleteService } =
    useAppStore();
  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-line bg-panel">
      <div className="flex h-12 items-center justify-between border-b border-line px-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">Services</span>
        <button
          className="icon-button h-7 w-7"
          title="Add service"
          onClick={() => setCatalogOpen(true)}
        >
          <Plus size={16} />
        </button>
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
          return (
            <div
              key={service.id}
              className={`group relative mb-0.5 flex h-11 items-center gap-2.5 rounded-lg px-2 transition-colors ${
                selected ? 'bg-elevated' : service.disabled ? 'opacity-40' : 'hover:bg-elevated/50'
              }`}
            >
              {selected && (
                <span className="absolute bottom-2 left-0 top-2 w-0.5 rounded-full bg-accent" />
              )}
              <button
                className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                disabled={service.disabled}
                title={service.disabled ? `${service.display_name} disabled` : service.display_name}
                onClick={() => void selectService(service.id)}
              >
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-semibold text-white"
                  style={{ backgroundColor: service.color ?? '#475569' }}
                >
                  {service.display_name.charAt(0).toUpperCase()}
                </span>
                <span
                  className={`min-w-0 flex-1 truncate text-sm ${selected ? 'text-ink' : 'text-ink/85'}`}
                >
                  {service.display_name}
                </span>
                {service.disabled && (
                  <span className="rounded bg-elevated px-1.5 py-0.5 text-[11px] text-muted">
                    off
                  </span>
                )}
                {count > 0 && (
                  <span className="rounded-full bg-accent px-1.5 py-0.5 text-[11px] font-semibold leading-none text-shell">
                    {count > 99 ? '99+' : count}
                  </span>
                )}
              </button>
              <button
                className="shrink-0 text-muted opacity-0 transition hover:text-ink group-hover:opacity-100"
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
