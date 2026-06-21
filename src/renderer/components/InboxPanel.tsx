import { useState } from 'react';
import { BellOff, CheckCheck, Clock, Filter, Sparkles, Trash2, X } from 'lucide-react';
import { api } from '../ipc/client';
import { useAppStore } from '../state/appStore';

export function InboxPanel(): JSX.Element | null {
  const {
    inboxOpen,
    setInboxOpen,
    notifications,
    services,
    markNotificationRead,
    markAllNotificationsRead,
    clearNotifications,
    loadNotifications,
    updateService,
    selectService,
    aiConfigured
  } = useAppStore();
  const [brief, setBrief] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);
  if (!inboxOpen) return null;

  const service = (instanceId: string) => services.find((candidate) => candidate.id === instanceId);
  const serviceName = (instanceId: string): string => service(instanceId)?.display_name ?? 'Service';
  const visible = unreadOnly ? notifications.filter((notification) => !notification.read_at) : notifications;

  const runBrief = async (): Promise<void> => {
    setBusy(true);
    setBrief(null);
    try {
      const result = await api.ai.brief();
      setBrief(result.text);
    } catch (error) {
      setBrief(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <aside className="absolute right-0 top-0 z-30 flex h-full w-96 flex-col border-l border-line bg-panel shadow-2xl">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-line px-3">
        <div className="text-sm font-semibold">Inbox</div>
        <div className="flex items-center gap-1">
          <button className={`icon-button ${unreadOnly ? 'border-accent text-white' : ''}`} title="Unread only" onClick={() => setUnreadOnly((value) => !value)}>
            <Filter size={15} />
          </button>
          {aiConfigured && (
            <button className="icon-button" title="AI brief" disabled={busy} onClick={() => void runBrief()}>
              <Sparkles size={15} />
            </button>
          )}
          <button className="icon-button" title="Mark all read" onClick={() => void markAllNotificationsRead()}>
            <CheckCheck size={15} />
          </button>
          <button className="icon-button" title="Clear all" onClick={() => void clearNotifications()}>
            <Trash2 size={15} />
          </button>
          <button className="icon-button" title="Close" onClick={() => setInboxOpen(false)}>
            <X size={15} />
          </button>
        </div>
      </header>
      {brief !== null && (
        <div className="max-h-56 shrink-0 overflow-y-auto border-b border-line bg-shell p-3 text-xs leading-relaxed whitespace-pre-wrap text-ink">
          {busy ? 'Thinking…' : brief}
        </div>
      )}
      <div className="flex-1 overflow-y-auto">
        {visible.length === 0 && <div className="p-6 text-center text-xs text-muted">No notifications.</div>}
        {visible.map((notification) => {
          const svc = service(notification.instance_id);
          return (
            <div
              key={notification.id}
              className={`group flex items-start gap-2 border-b border-line/60 px-3 py-2 hover:bg-shell ${notification.read_at ? 'opacity-60' : ''}`}
            >
              <button
                className="flex min-w-0 flex-1 flex-col gap-0.5 text-left"
                onClick={() => {
                  void markNotificationRead(notification.id);
                  void selectService(notification.instance_id);
                  setInboxOpen(false);
                }}
              >
                <span className="truncate text-xs font-semibold text-ink">{notification.title || serviceName(notification.instance_id)}</span>
                <span className="truncate text-xs text-muted">{notification.body}</span>
                <span className="text-[10px] uppercase tracking-wide text-muted">{serviceName(notification.instance_id)}</span>
              </button>
              <div className="flex shrink-0 flex-col gap-1 opacity-0 transition group-hover:opacity-100">
                <button
                  className="text-muted hover:text-white"
                  title="Snooze 1 hour"
                  onClick={() => void api.notifications.snooze(notification.id, Date.now() + 3_600_000).then(() => void loadNotifications())}
                >
                  <Clock size={13} />
                </button>
                {svc && (
                  <button
                    className={`hover:text-white ${svc.muted ? 'text-accent' : 'text-muted'}`}
                    title={svc.muted ? 'Unmute service' : 'Mute service'}
                    onClick={() => void updateService(svc.id, { muted: !svc.muted })}
                  >
                    <BellOff size={13} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
