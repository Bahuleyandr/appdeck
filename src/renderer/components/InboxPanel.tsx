import { useEffect, useState } from 'react';
import {
  Archive,
  BellMinus,
  BellOff,
  CheckCheck,
  Clock,
  Copy,
  Filter,
  Reply,
  Search,
  Sparkles,
  Trash2,
  Wand2,
  X
} from 'lucide-react';
import type { AiRun, NotificationRecord } from '../../shared/types';
import { api } from '../ipc/client';
import { useAppStore } from '../state/appStore';

type Priority = 'high' | 'normal' | 'low';
const RANK: Record<Priority, number> = { high: 0, normal: 1, low: 2 };

function dotClass(priority: Priority): string {
  return priority === 'high' ? 'bg-red-400' : priority === 'low' ? 'bg-slate-500' : 'bg-amber-400';
}

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
  const [priorities, setPriorities] = useState<Record<number, { priority: Priority; reason: string }>>(
    {}
  );
  const [prioritized, setPrioritized] = useState(false);
  const [replyFor, setReplyFor] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');
  const [suggestions, setSuggestions] = useState<Array<{ instanceId: string; reason: string }> | null>(
    null
  );
  const [archiveMode, setArchiveMode] = useState(false);
  const [archiveQuery, setArchiveQuery] = useState('');
  const [archive, setArchive] = useState<NotificationRecord[]>([]);
  const [archiveDone, setArchiveDone] = useState(false);
  const [lastSeenAt, setLastSeenAt] = useState<number | null>(null);
  const [latestRun, setLatestRun] = useState<AiRun | null>(null);
  const [runDismissed, setRunDismissed] = useState(false);

  useEffect(() => {
    if (!inboxOpen) return;
    void api.notifications.lastSeen().then((seen) => setLastSeenAt(seen.at));
    void api.aiRuns.list(1).then((runs) => setLatestRun(runs[0] ?? null));
    const unsubscribe = api.on('event:ai-run', (payload) => {
      setLatestRun(payload as AiRun);
      setRunDismissed(false);
    });
    return unsubscribe;
  }, [inboxOpen]);

  // Browse mode groups by service (alphabetical, newest first inside a group); search results
  // stay in relevance order.
  const sortForBrowse = (records: NotificationRecord[]): NotificationRecord[] =>
    [...records].sort((a, b) => {
      const nameA = services.find((s) => s.id === a.instance_id)?.display_name ?? a.instance_id;
      const nameB = services.find((s) => s.id === b.instance_id)?.display_name ?? b.instance_id;
      return nameA.localeCompare(nameB) || b.created_at - a.created_at;
    });

  useEffect(() => {
    if (!inboxOpen || !archiveMode) return;
    const query = archiveQuery.trim();
    let cancelled = false;
    const timer = window.setTimeout(() => {
      const request = query ? api.notifications.search(query) : api.notifications.list(200);
      void request.then((records) => {
        if (cancelled) return;
        setArchive(query ? records : sortForBrowse(records));
        setArchiveDone(records.length < 200 || Boolean(query));
      });
    }, 150);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [inboxOpen, archiveMode, archiveQuery, services]);

  if (!inboxOpen) return null;

  const service = (instanceId: string) => services.find((candidate) => candidate.id === instanceId);
  const serviceName = (instanceId: string): string => service(instanceId)?.display_name ?? 'Service';

  const close = (): void => {
    void api.notifications.markSeen();
    setInboxOpen(false);
  };

  const loadOlderArchive = (): void => {
    if (!archive.length) return;
    const cursor = Math.min(...archive.map((record) => record.id));
    void api.notifications.list(200, false, cursor).then((records) => {
      setArchive((current) => sortForBrowse([...current, ...records]));
      if (records.length < 200) setArchiveDone(true);
    });
  };
  const visible = unreadOnly
    ? notifications.filter((notification) => !notification.read_at)
    : notifications;
  const ordered = prioritized
    ? [...visible].sort(
        (a, b) =>
          RANK[priorities[a.id]?.priority ?? 'normal'] - RANK[priorities[b.id]?.priority ?? 'normal']
      )
    : visible;

  const errText = (error: unknown): string =>
    error instanceof Error ? error.message : String(error);

  const runBrief = async (): Promise<void> => {
    setBusy(true);
    setBrief(null);
    try {
      setBrief((await api.ai.brief()).text);
    } catch (error) {
      setBrief(errText(error));
    } finally {
      setBusy(false);
    }
  };

  const runPrioritize = async (): Promise<void> => {
    setBusy(true);
    try {
      const items = await api.ai.triage();
      const map: Record<number, { priority: Priority; reason: string }> = {};
      for (const item of items) map[item.notificationId] = { priority: item.priority, reason: item.reason };
      setPriorities(map);
      setPrioritized(true);
    } catch (error) {
      setBrief(errText(error));
    } finally {
      setBusy(false);
    }
  };

  const runReply = async (id: number): Promise<void> => {
    setReplyFor(id);
    setReplyText('Drafting…');
    try {
      setReplyText((await api.ai.draftReply(id)).text);
    } catch (error) {
      setReplyText(errText(error));
    }
  };

  const runSuggest = async (): Promise<void> => {
    setBusy(true);
    try {
      setSuggestions(await api.ai.suggestMutes());
    } catch (error) {
      setBrief(errText(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <aside className="flex h-full w-96 shrink-0 flex-col border-l border-line bg-panel">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-line px-3">
        <div className="text-sm font-semibold">{archiveMode ? 'Archive' : 'Inbox'}</div>
        <div className="flex items-center gap-1">
          <button
            className={`icon-button ${archiveMode ? 'border-accent text-white' : ''}`}
            title="Archive — everything, searchable"
            onClick={() => setArchiveMode((value) => !value)}
          >
            <Archive size={15} />
          </button>
          <button
            className={`icon-button ${unreadOnly ? 'border-accent text-white' : ''}`}
            title="Unread only"
            onClick={() => setUnreadOnly((value) => !value)}
          >
            <Filter size={15} />
          </button>
          {aiConfigured && (
            <>
              <button className="icon-button" title="AI brief" disabled={busy} onClick={() => void runBrief()}>
                <Sparkles size={15} />
              </button>
              <button
                className={`icon-button ${prioritized ? 'border-accent text-white' : ''}`}
                title="Prioritize with AI"
                disabled={busy}
                onClick={() => void runPrioritize()}
              >
                <Wand2 size={15} />
              </button>
              <button
                className="icon-button"
                title="Suggest services to mute"
                disabled={busy}
                onClick={() => void runSuggest()}
              >
                <BellMinus size={15} />
              </button>
            </>
          )}
          <button className="icon-button" title="Mark all read" onClick={() => void markAllNotificationsRead()}>
            <CheckCheck size={15} />
          </button>
          <button className="icon-button" title="Clear all" onClick={() => void clearNotifications()}>
            <Trash2 size={15} />
          </button>
          <button className="icon-button" title="Close" onClick={close}>
            <X size={15} />
          </button>
        </div>
      </header>
      {brief !== null && (
        <div className="max-h-56 shrink-0 overflow-y-auto border-b border-line bg-shell p-3 text-xs leading-relaxed whitespace-pre-wrap text-ink">
          {busy ? 'Thinking…' : brief}
        </div>
      )}
      {latestRun && !runDismissed && !archiveMode && brief === null && (
        <div className="shrink-0 border-b border-line bg-shell p-3 text-xs">
          <div className="mb-1.5 flex items-center justify-between font-semibold text-ink">
            <span className="flex items-center gap-1.5">
              <Sparkles size={12} className="text-accent" />
              {latestRun.title} · {new Date(latestRun.created_at).toLocaleString()}
            </span>
            <button className="text-muted hover:text-ink" onClick={() => setRunDismissed(true)}>
              <X size={13} />
            </button>
          </div>
          <div className="max-h-40 overflow-y-auto whitespace-pre-wrap leading-relaxed text-muted">
            {latestRun.text}
          </div>
        </div>
      )}
      {suggestions !== null && (
        <div className="shrink-0 border-b border-line bg-shell p-3 text-xs">
          <div className="mb-1.5 flex items-center justify-between font-semibold text-ink">
            <span>Suggested mutes</span>
            <button className="text-muted hover:text-ink" onClick={() => setSuggestions(null)}>
              <X size={13} />
            </button>
          </div>
          {suggestions.length === 0 ? (
            <div className="text-muted">Nothing noisy enough to suggest muting.</div>
          ) : (
            suggestions.map((suggestion) => (
              <div key={suggestion.instanceId} className="mb-1 flex items-center justify-between gap-2">
                <span className="min-w-0 flex-1 truncate text-muted">
                  <span className="text-ink">{serviceName(suggestion.instanceId)}</span> — {suggestion.reason}
                </span>
                <button
                  className="shrink-0 rounded border border-line px-2 py-0.5 text-[11px] text-ink hover:bg-elevated"
                  onClick={() => {
                    void updateService(suggestion.instanceId, { muted: true });
                    setSuggestions((current) =>
                      (current ?? []).filter((item) => item.instanceId !== suggestion.instanceId)
                    );
                  }}
                >
                  Mute
                </button>
              </div>
            ))
          )}
        </div>
      )}
      <div className="flex-1 overflow-y-auto">
        {archiveMode && (
          <div className="sticky top-0 z-10 border-b border-line bg-panel p-2">
            <div className="relative">
              <Search size={13} className="pointer-events-none absolute left-2 top-2 text-muted" />
              <input
                className="field w-full py-1.5 pl-7 text-xs"
                placeholder="Search every notification…"
                autoFocus
                value={archiveQuery}
                onChange={(event) => setArchiveQuery(event.target.value)}
              />
            </div>
          </div>
        )}
        {(archiveMode ? archive : ordered).length === 0 && (
          <div className="p-6 text-center text-xs text-muted">
            {archiveMode && archiveQuery.trim() ? 'No matches.' : 'No notifications.'}
          </div>
        )}
        {(archiveMode ? archive : ordered).map((notification, index, list) => {
          const svc = service(notification.instance_id);
          const priority = archiveMode ? undefined : priorities[notification.id]?.priority;
          const showSeenDivider =
            !archiveMode &&
            lastSeenAt !== null &&
            index > 0 &&
            notification.created_at <= lastSeenAt &&
            (list[index - 1]?.created_at ?? 0) > lastSeenAt;
          const showGroupHeader =
            archiveMode && notification.instance_id !== list[index - 1]?.instance_id;
          return (
            <div
              key={notification.id}
              className={`group border-b border-line/60 ${notification.read_at ? 'opacity-60' : ''}`}
            >
              {showSeenDivider && (
                <div className="flex items-center gap-2 px-3 py-1 text-[10px] uppercase tracking-wide text-muted">
                  <span className="h-px flex-1 bg-line" />
                  Seen before
                  <span className="h-px flex-1 bg-line" />
                </div>
              )}
              {showGroupHeader && (
                <div className="bg-shell px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
                  {serviceName(notification.instance_id)}
                </div>
              )}
              <div className="flex items-start gap-2 px-3 py-2 hover:bg-shell">
                {priority && (
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dotClass(priority)}`}
                    title={priorities[notification.id]?.reason}
                  />
                )}
                <button
                  className="flex min-w-0 flex-1 flex-col gap-0.5 text-left"
                  onClick={() => {
                    void markNotificationRead(notification.id);
                    void selectService(notification.instance_id);
                    close();
                  }}
                >
                  <span className="truncate text-xs font-semibold text-ink">
                    {notification.title || serviceName(notification.instance_id)}
                  </span>
                  <span className="truncate text-xs text-muted">{notification.body}</span>
                  <span className="text-[10px] uppercase tracking-wide text-muted">
                    {archiveMode
                      ? new Date(notification.created_at).toLocaleString()
                      : serviceName(notification.instance_id)}
                  </span>
                </button>
                <div className="flex shrink-0 flex-col gap-1 opacity-0 transition group-hover:opacity-100">
                  {aiConfigured && (
                    <button
                      className="text-muted hover:text-white"
                      title="Draft a reply with AI"
                      onClick={() => void runReply(notification.id)}
                    >
                      <Reply size={13} />
                    </button>
                  )}
                  <button
                    className="text-muted hover:text-white"
                    title="Snooze 1 hour"
                    onClick={() =>
                      void api.notifications
                        .snooze(notification.id, Date.now() + 3_600_000)
                        .then(() => void loadNotifications())
                    }
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
              {replyFor === notification.id && (
                <div className="border-t border-line/60 bg-shell p-2">
                  <textarea
                    className="field h-24 w-full resize-none text-xs"
                    value={replyText}
                    onChange={(event) => setReplyText(event.target.value)}
                  />
                  <div className="mt-1 flex justify-end gap-1">
                    <button
                      className="flex items-center gap-1 rounded border border-line px-2 py-0.5 text-[11px] text-ink hover:bg-elevated"
                      onClick={() => void navigator.clipboard.writeText(replyText).catch(() => undefined)}
                    >
                      <Copy size={12} /> Copy
                    </button>
                    <button
                      className="rounded px-2 py-0.5 text-[11px] text-muted hover:text-ink"
                      onClick={() => setReplyFor(null)}
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {archiveMode && !archiveDone && !archiveQuery.trim() && archive.length > 0 && (
          <button
            className="w-full border-b border-line/60 px-3 py-2 text-center text-xs text-muted hover:bg-shell hover:text-ink"
            onClick={loadOlderArchive}
          >
            Load older notifications
          </button>
        )}
      </div>
    </aside>
  );
}
