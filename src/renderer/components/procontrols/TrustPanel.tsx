import type { JSX } from 'react';
import { useState } from 'react';
import type {
  TrustStatus
} from '../../../shared/types';
import { api } from '../../ipc/client';

export function TrustPanel({
  status,
  refresh
}: {
  status: TrustStatus | null;
  refresh: () => void;
}): JSX.Element {
  const [updatingBlocklist, setUpdatingBlocklist] = useState(false);
  const [blocklistError, setBlocklistError] = useState<string | null>(null);
  const blocklist = status?.tracker.blocklist;
  const updateBlocklist = (): void => {
    setUpdatingBlocklist(true);
    setBlocklistError(null);
    api.trust
      .updateBlocklist()
      .then(() => refresh())
      .catch(() => setBlocklistError('Blocklist update failed. Check your connection.'))
      .finally(() => setUpdatingBlocklist(false));
  };
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <section className="panel rounded-md p-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="text-sm font-semibold">Privacy Shield</div>
          <button className="app-button" onClick={refresh}>
            Refresh
          </button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-md border border-line p-3">
            <div className="text-xs text-muted">Tracker blocking</div>
            <div className="mt-1 text-xl font-semibold">
              {status?.tracker.enabled ? 'On' : 'Off'}
            </div>
          </div>
          <div className="rounded-md border border-line p-3">
            <div className="text-xs text-muted">Blocked requests</div>
            <div className="mt-1 text-xl font-semibold">{status?.tracker.blockedTotal ?? 0}</div>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 rounded-md border border-line p-3">
          <div>
            <div className="text-xs text-muted">Blocklist</div>
            <div className="mt-1 text-sm">
              {blocklist?.loaded
                ? `${blocklist.lists.join(' + ') || 'Bundled snapshot'} · ${
                    blocklist.generatedAt
                      ? new Date(blocklist.generatedAt).toLocaleDateString()
                      : 'unknown date'
                  }`
                : 'Not loaded'}
            </div>
            {blocklistError && <div className="mt-1 text-xs text-red-400">{blocklistError}</div>}
          </div>
          <button className="app-button" onClick={updateBlocklist} disabled={updatingBlocklist}>
            {updatingBlocklist ? 'Updating…' : 'Update blocklist'}
          </button>
        </div>
        <div className="mt-3 space-y-1">
          {(status?.tracker.topHosts ?? []).map((host) => (
            <div
              key={host.host}
              className="flex justify-between rounded-md border border-line px-2 py-1 text-xs"
            >
              <span className="truncate">{host.host}</span>
              <span className="text-muted">{host.count}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="panel rounded-md p-3">
        <div className="mb-3 text-sm font-semibold">Vault Inspector</div>
        <div className="rounded-md border border-line p-2 text-sm">
          {status?.vault.safe ? 'Vault denylist passed' : (status?.vault.error ?? 'Loading')}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <TrustList title="Syncs" items={status?.vault.syncs ?? []} />
          <TrustList title="Never Syncs" items={status?.vault.neverSyncs ?? []} />
        </div>
      </section>

      <section className="panel rounded-md p-3 xl:col-span-2">
        <div className="mb-3 text-sm font-semibold">Release Readiness</div>
        <div className="grid gap-2 md:grid-cols-2">
          {(status?.release ?? []).map((item) => (
            <div key={item.label} className="rounded-md border border-line p-2">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span>{item.label}</span>
                <span className={item.ok ? 'text-accent' : 'text-red-300'}>
                  {item.ok ? 'ready' : 'missing'}
                </span>
              </div>
              <div className="mt-1 text-xs text-muted">{item.detail}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function TrustList({ title, items }: { title: string; items: string[] }): JSX.Element {
  return (
    <div className="rounded-md border border-line p-2">
      <div className="mb-2 text-xs font-semibold text-muted">{title}</div>
      <div className="space-y-1">
        {items.map((item) => (
          <div key={item} className="rounded bg-elevated px-2 py-1 text-xs">
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}
