import {
  Bell,
  CheckSquare,
  Download,
  LayoutDashboard,
  Pin,
  Plus,
  RefreshCw,
  Save,
  X
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import type { DashboardSnapshot } from '../../shared/types';
import { api } from '../ipc/client';
import { useAppStore } from '../state/appStore';

export function DashboardHome(): JSX.Element | null {
  const {
    dashboardOpen,
    setDashboardOpen,
    selectedWorkspaceId,
    selectedServiceIds,
    selectService,
    setCatalogOpen,
    setInboxOpen,
    setTaskPanelOpen
  } = useAppStore();
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [sessionName, setSessionName] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const refresh = (): void => {
    void api.dashboards.snapshot(selectedWorkspaceId).then(setSnapshot);
  };

  useEffect(() => {
    if (!dashboardOpen) return;
    refresh();
  }, [dashboardOpen, selectedWorkspaceId]);

  if (!dashboardOpen) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/55">
      <section className="flex h-[86vh] w-[1100px] max-w-[94vw] flex-col overflow-hidden rounded-md border border-line bg-panel shadow-2xl">
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-line px-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <LayoutDashboard size={16} className="text-accent" />
            Dashboard Home
          </div>
          <div className="flex items-center gap-2">
            <button className="icon-button" title="Refresh" onClick={refresh}>
              <RefreshCw size={16} />
            </button>
            <button className="icon-button" title="Close" onClick={() => setDashboardOpen(false)}>
              <X size={16} />
            </button>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4 xl:grid-cols-[1.2fr_0.8fr]">
          <section className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <Metric label="Unread" value={String(snapshot?.unreadTotal ?? 0)} />
              <Metric label="Services" value={String(snapshot?.services.length ?? 0)} />
              <Metric
                label="Tasks"
                value={String(snapshot?.tasks.filter((task) => !task.done).length ?? 0)}
              />
            </div>

            <Panel title="Pinned And Active" icon={<Pin size={15} />}>
              <div className="grid gap-2 md:grid-cols-2">
                {(snapshot?.services ?? []).map((service) => (
                  <button
                    key={service.id}
                    className="flex h-12 items-center gap-2 rounded-md border border-line px-2 text-left hover:bg-shell"
                    disabled={service.disabled}
                    onClick={() => {
                      setDashboardOpen(false);
                      void selectService(service.id);
                    }}
                  >
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-xs font-semibold text-white"
                      style={{ backgroundColor: service.color ?? '#475569' }}
                    >
                      {service.display_name.charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm">{service.display_name}</span>
                    {service.disabled && <span className="text-xs text-muted">off</span>}
                    {service.pinned && <Pin size={13} className="text-accent" />}
                  </button>
                ))}
                {(snapshot?.services.length ?? 0) === 0 && (
                  <button
                    className="rounded-md border border-dashed border-line p-6 text-sm text-muted hover:border-accent/60 hover:text-ink"
                    onClick={() => {
                      setDashboardOpen(false);
                      setCatalogOpen(true);
                    }}
                  >
                    <Plus size={16} className="mx-auto mb-2" />
                    Add service
                  </button>
                )}
              </div>
            </Panel>

            <Panel title="Recent Notifications" icon={<Bell size={15} />}>
              <div className="space-y-2">
                {(snapshot?.notifications ?? []).map((notification) => (
                  <div key={notification.id} className="rounded-md border border-line p-2">
                    <div className="truncate text-sm">{notification.title || 'Notification'}</div>
                    <div className="truncate text-xs text-muted">{notification.body}</div>
                  </div>
                ))}
                {(snapshot?.notifications.length ?? 0) === 0 && (
                  <Empty label="No notifications yet." />
                )}
              </div>
            </Panel>
          </section>

          <section className="space-y-4">
            <Panel title="Quick Actions" icon={<LayoutDashboard size={15} />}>
              <div className="grid gap-2">
                <button
                  className="app-button justify-start"
                  onClick={() => {
                    setDashboardOpen(false);
                    setInboxOpen(true);
                  }}
                >
                  <Bell size={15} />
                  Inbox
                </button>
                <button
                  className="app-button justify-start"
                  onClick={() => {
                    setDashboardOpen(false);
                    setTaskPanelOpen(true);
                  }}
                >
                  <CheckSquare size={15} />
                  Tasks
                </button>
                <button
                  className="app-button justify-start"
                  onClick={() => {
                    setDashboardOpen(false);
                    setCatalogOpen(true);
                  }}
                >
                  <Plus size={15} />
                  Add Service
                </button>
              </div>
            </Panel>

            <Panel title="Save Session" icon={<Save size={15} />}>
              <div className="grid gap-2">
                <input
                  className="field"
                  value={sessionName}
                  placeholder="Session name"
                  onChange={(event) => setSessionName(event.target.value)}
                />
                <button
                  className="app-button"
                  disabled={!sessionName.trim() || selectedServiceIds.length === 0}
                  onClick={() =>
                    void api.dashboards
                      .saveSession({
                        workspaceId: selectedWorkspaceId,
                        name: sessionName.trim(),
                        serviceIds: selectedServiceIds
                      })
                      .then(() => {
                        setSessionName('');
                        setMessage('Saved.');
                        refresh();
                      })
                  }
                >
                  Save current view
                </button>
                {message && <div className="text-xs text-muted">{message}</div>}
              </div>
              <div className="mt-3 space-y-1">
                {(snapshot?.savedSessions ?? []).slice(0, 5).map((session) => (
                  <div key={session.id} className="rounded-md border border-line px-2 py-1 text-xs">
                    {session.name}
                    <span className="ml-2 text-muted">{session.service_ids.length} services</span>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="Tasks" icon={<CheckSquare size={15} />}>
              <div className="space-y-1">
                {(snapshot?.tasks ?? []).slice(0, 6).map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-2 rounded-md border border-line px-2 py-1 text-sm"
                  >
                    <span className={task.done ? 'text-muted line-through' : ''}>{task.title}</span>
                  </div>
                ))}
                {(snapshot?.tasks.length ?? 0) === 0 && <Empty label="No tasks yet." />}
              </div>
            </Panel>

            <Panel title="Downloads" icon={<Download size={15} />}>
              <div className="space-y-1">
                {(snapshot?.downloads ?? []).slice(0, 5).map((download) => (
                  <button
                    key={download.id}
                    className="flex w-full items-center justify-between gap-2 rounded-md border border-line px-2 py-1 text-left text-xs hover:bg-shell"
                    disabled={!download.path}
                    onClick={() => void api.downloads.open(download.id)}
                  >
                    <span className="truncate">{download.filename}</span>
                    <span className="shrink-0 text-muted">{download.state}</span>
                  </button>
                ))}
                {(snapshot?.downloads.length ?? 0) === 0 && <Empty label="No downloads yet." />}
              </div>
            </Panel>
          </section>
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="rounded-md border border-line bg-shell p-3">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function Panel({
  title,
  icon,
  children
}: {
  title: string;
  icon: JSX.Element;
  children: ReactNode;
}): JSX.Element {
  return (
    <section className="panel rounded-md p-3">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
        {icon}
        {title}
      </div>
      {children}
    </section>
  );
}

function Empty({ label }: { label: string }): JSX.Element {
  return (
    <div className="rounded-md border border-dashed border-line p-4 text-center text-xs text-muted">
      {label}
    </div>
  );
}
