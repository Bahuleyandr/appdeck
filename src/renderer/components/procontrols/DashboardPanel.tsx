import { Trash2 } from 'lucide-react';
import type { JSX } from 'react';
import { useState } from 'react';
import type {
  Dashboard
} from '../../../shared/types';
import { api } from '../../ipc/client';
import { EmptyState, labelFromId } from './helpers';

export function DashboardPanel({
  dashboards,
  selectedWorkspaceId,
  refresh
}: {
  dashboards: Dashboard[];
  selectedWorkspaceId: string | null;
  refresh: () => void;
}): JSX.Element {
  const [name, setName] = useState('');
  const [widgetType, setWidgetType] = useState<Dashboard['widgets'][number]['type']>('shortcuts');

  return (
    <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
      <section className="panel rounded-md p-3">
        <div className="mb-3 text-sm font-semibold">Dashboard</div>
        <div className="space-y-2">
          <input
            className="field w-full"
            value={name}
            placeholder="Dashboard name"
            onChange={(event) => setName(event.target.value)}
          />
          <button
            className="app-button w-full border-accent text-white"
            disabled={!name.trim()}
            onClick={() =>
              void api.dashboards
                .upsert({ name: name.trim(), workspace_id: selectedWorkspaceId })
                .then(() => {
                  setName('');
                  refresh();
                })
            }
          >
            Create
          </button>
        </div>
      </section>
      <section className="panel rounded-md p-3">
        <div className="space-y-2">
          {dashboards.length === 0 && <EmptyState label="No dashboards yet." />}
          {dashboards.map((dashboard) => (
            <div key={dashboard.id} className="rounded-md border border-line p-2">
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{dashboard.name}</div>
                  <div className="text-xs text-muted">{dashboard.widgets.length} widgets</div>
                </div>
                <select
                  className="field h-8 w-36 text-xs"
                  value={widgetType}
                  onChange={(event) =>
                    setWidgetType(event.target.value as Dashboard['widgets'][number]['type'])
                  }
                >
                  {(
                    [
                      'shortcuts',
                      'notifications',
                      'tasks',
                      'unread',
                      'notes',
                      'clock',
                      'savedTabs'
                    ] as const
                  ).map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
                <button
                  className="app-button h-8 px-2 text-xs"
                  onClick={() =>
                    void api.dashboards
                      .upsert({
                        ...dashboard,
                        widgets: [
                          ...dashboard.widgets,
                          {
                            id: crypto.randomUUID(),
                            type: widgetType,
                            title: labelFromId(widgetType),
                            config: {}
                          }
                        ]
                      })
                      .then(refresh)
                  }
                >
                  Add widget
                </button>
                <button
                  className="icon-button"
                  aria-label="Delete dashboard"
                  title="Delete dashboard"
                  onClick={() => void api.dashboards.delete(dashboard.id).then(refresh)}
                >
                  <Trash2 size={15} />
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {dashboard.widgets.map((widget) => (
                  <span
                    key={widget.id}
                    className="rounded bg-elevated px-1.5 py-0.5 text-[11px] text-muted"
                  >
                    {widget.title}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
