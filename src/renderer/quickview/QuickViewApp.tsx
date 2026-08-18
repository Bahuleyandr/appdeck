import type { JSX, ReactNode } from 'react';
import { useEffect, useState } from 'react';
import type { QuickViewNotification, QuickViewService, QuickViewState } from '../../shared/types.js';

/** Bridge exposed by src/preload/quickview.ts — only the quick-view channels, nothing else. */
interface QuickViewBridge {
  getState(): Promise<unknown>;
  openService(instanceId: string): Promise<unknown>;
  openApp(): Promise<unknown>;
  close(): Promise<unknown>;
  onState(callback: (state: unknown) => void): () => void;
}

const bridge = (window as unknown as { appdeckQuickView: QuickViewBridge }).appdeckQuickView;

function applyTheme(theme: string): void {
  const light =
    theme === 'light' ||
    (theme === 'system' && !window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('light', light);
}

export function QuickViewApp(): JSX.Element {
  const [state, setState] = useState<QuickViewState | null>(null);

  useEffect(() => {
    let mounted = true;
    const receive = (payload: unknown): void => {
      if (!mounted) return;
      const next = payload as QuickViewState;
      applyTheme(next.theme);
      setState(next);
    };
    void bridge.getState().then(receive);
    const unsubscribe = bridge.onState(receive);
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        void bridge.close();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      mounted = false;
      unsubscribe();
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const unreadServices = state?.services.filter(
    (service) => service.unread.direct > 0 || service.unread.indirect > 0
  );

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-shell text-ink">
      <header className="flex shrink-0 items-center justify-between border-b border-line px-3 py-2">
        <span className="text-sm font-semibold">
          AppDeck
          {state && state.totalUnread > 0 ? (
            <span className="ml-2 rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent">
              {state.totalUnread} unread
            </span>
          ) : null}
        </span>
        <button
          type="button"
          className="rounded-md bg-elevated px-2.5 py-1 text-xs font-medium text-ink hover:bg-line"
          onClick={() => void bridge.openApp()}
        >
          Open AppDeck
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {!state ? null : (
          <>
            <SectionLabel>Services</SectionLabel>
            {unreadServices && unreadServices.length > 0 ? (
              unreadServices.map((service) => (
                <ServiceRow key={service.id} service={service} />
              ))
            ) : (
              <EmptyRow>No unread messages</EmptyRow>
            )}

            <SectionLabel>Recent notifications</SectionLabel>
            {state.notifications.length > 0 ? (
              state.notifications.map((notification) => (
                <NotificationRow key={notification.id} notification={notification} />
              ))
            ) : (
              <EmptyRow>Nothing yet — notifications will show up here</EmptyRow>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div className="px-3 pt-3 pb-1 text-[11px] font-semibold tracking-wide text-muted uppercase">
      {children}
    </div>
  );
}

function EmptyRow({ children }: { children: ReactNode }): JSX.Element {
  return <div className="px-3 py-2 text-xs text-muted">{children}</div>;
}

function ServiceRow({ service }: { service: QuickViewService }): JSX.Element {
  return (
    <button
      type="button"
      className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-elevated"
      onClick={() => void bridge.openService(service.id)}
    >
      <span
        aria-hidden
        className="h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ background: service.color ?? 'rgb(var(--accent))' }}
      />
      <span className="min-w-0 flex-1 truncate text-sm">{service.name}</span>
      {service.unread.direct > 0 ? (
        <span className="rounded-full bg-accent px-1.5 py-0.5 text-[11px] font-semibold text-shell">
          {service.unread.direct}
        </span>
      ) : (
        <span className="text-[11px] text-muted">{service.unread.indirect}</span>
      )}
    </button>
  );
}

function NotificationRow({
  notification
}: {
  notification: QuickViewNotification;
}): JSX.Element {
  return (
    <button
      type="button"
      className="block w-full px-3 py-2 text-left hover:bg-elevated"
      onClick={() => void bridge.openService(notification.serviceId)}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="min-w-0 truncate text-xs font-semibold">{notification.serviceName}</span>
        <span className="shrink-0 text-[11px] text-muted">
          {formatTimestamp(notification.timestamp)}
        </span>
      </div>
      {notification.title ? (
        <div className="mt-0.5 truncate text-xs text-ink">{notification.title}</div>
      ) : null}
      {notification.body ? (
        <div className="mt-0.5 line-clamp-2 text-xs text-muted">{notification.body}</div>
      ) : null}
    </button>
  );
}

function formatTimestamp(timestamp: number): string {
  const deltaMs = Date.now() - timestamp;
  if (deltaMs < 60_000) return 'now';
  if (deltaMs < 3_600_000) return `${Math.floor(deltaMs / 60_000)}m`;
  if (deltaMs < 86_400_000) return `${Math.floor(deltaMs / 3_600_000)}h`;
  return new Date(timestamp).toLocaleDateString();
}
