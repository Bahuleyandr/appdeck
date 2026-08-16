import type { JSX } from 'react';
import type {
  PerformanceStatus
} from '../../../shared/types';
import { useAppStore } from '../../state/appStore';
import { EmptyState } from './helpers';

export function PerformancePanel({
  status,
  refresh
}: {
  status: PerformanceStatus | null;
  refresh: () => void;
}): JSX.Element {
  const settings = useAppStore((state) => state.settings);
  const setSettingValue = useAppStore((state) => state.setSettingValue);
  return (
    <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
      <section className="panel rounded-md p-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="text-sm font-semibold">Performance</div>
          <button className="app-button" onClick={refresh}>
            Refresh
          </button>
        </div>
        <div className="grid gap-2">
          <div className="rounded-md border border-line p-3">
            <div className="text-xs text-muted">Memory</div>
            <div className="mt-1 text-2xl font-semibold">{status?.totalMemoryMB ?? '-'} MB</div>
          </div>
          <div className="rounded-md border border-line p-3">
            <div className="text-xs text-muted">Saved by sleeping (estimate, this session)</div>
            <div className="mt-1 text-2xl font-semibold">{status?.estimatedSavedMB ?? 0} MB</div>
          </div>
          <div className="rounded-md border border-line p-3">
            <div className="text-xs text-muted">Services</div>
            <div className="mt-1 text-2xl font-semibold">
              {status
                ? `${status.serviceCount - status.disabledServiceCount}/${status.serviceCount}`
                : '-'}
            </div>
          </div>
          <label className="flex items-center gap-2 rounded-md border border-line p-2 text-sm">
            <input
              type="checkbox"
              checked={settings.show_memory_badges === 'true'}
              onChange={(event) =>
                void setSettingValue('show_memory_badges', event.target.checked ? 'true' : 'false')
              }
            />
            Show memory badges in the service rail
          </label>
        </div>
        <div className="mt-3 space-y-2">
          {(status?.suggestions ?? []).map((suggestion) => (
            <div
              key={`${suggestion.title}-${suggestion.detail}`}
              className="rounded-md border border-line p-2"
            >
              <div className="text-sm">{suggestion.title}</div>
              <div className="mt-1 text-xs text-muted">{suggestion.detail}</div>
            </div>
          ))}
          {status?.suggestions.length === 0 && <EmptyState label="No performance suggestions." />}
        </div>
      </section>
      <section className="panel rounded-md p-3">
        <div className="mb-3 text-sm font-semibold">Per service</div>
        <div className="mb-4 space-y-1">
          {(status?.services ?? []).map((service) => (
            <div
              key={service.instanceId}
              className="grid grid-cols-[1fr_80px_80px] gap-2 rounded-md border border-line px-2 py-1 text-xs"
            >
              <span className="truncate">{service.displayName}</span>
              <span className="text-muted">{service.state}</span>
              <span className="text-right">
                {service.state === 'sleeping' ? '0 MB' : `${service.memoryMB} MB`}
              </span>
            </div>
          ))}
          {!status?.services?.length && <EmptyState label="No live services yet." />}
        </div>
        <div className="mb-3 text-sm font-semibold">Processes</div>
        <div className="space-y-1">
          {status?.processes.map((process, index) => (
            <div
              key={`${process.type}-${process.name}-${index}`}
              className="grid grid-cols-[120px_1fr_80px] gap-2 rounded-md border border-line px-2 py-1 text-xs"
            >
              <span className="truncate text-muted">{process.type}</span>
              <span className="truncate">{process.name}</span>
              <span className="text-right">{process.memoryMB} MB</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
