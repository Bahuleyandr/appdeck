import { Trash2 } from 'lucide-react';
import type { JSX } from 'react';
import { useState } from 'react';
import type {
  PeerSyncStatus
} from '../../../shared/types';
import { api } from '../../ipc/client';
import { useAppStore } from '../../state/appStore';

export function PeerSyncPanel({
  status,
  refresh
}: {
  status: PeerSyncStatus | null;
  refresh: () => void;
}): JSX.Element {
  const settings = useAppStore((state) => state.settings);
  const setSettingValue = useAppStore((state) => state.setSettingValue);
  const [label, setLabel] = useState('Laptop');
  const [endpoint, setEndpoint] = useState('https://device.tailnet.ts.net/appdeck#shared-secret');
  const [result, setResult] = useState('');
  const serveEnabled = settings.peer_sync_serve === 'true';
  const save = async (): Promise<void> => {
    await api.peerSync.upsert({ label, endpoint, enabled: true });
    refresh();
  };
  return (
    <section className="space-y-3">
      <div className="panel rounded-md p-3">
        <div className="mb-3 text-sm font-semibold">Encrypted Peer Sync</div>
        <label className="mb-2 flex items-center gap-2 rounded-md border border-line p-2 text-sm">
          <input
            type="checkbox"
            checked={serveEnabled}
            onChange={(event) =>
              void setSettingValue('peer_sync_serve', event.target.checked ? 'true' : 'false').then(
                refresh
              )
            }
          />
          <span>
            Share this device&apos;s vault with peers
            <span className="block text-xs text-muted">
              Opens a local encrypted endpoint (off by default). Peers still need the shared secret.
            </span>
          </span>
        </label>
        <div className="grid gap-2 lg:grid-cols-[1fr_2fr_auto]">
          <input
            className="field"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
          />
          <input
            className="field"
            value={endpoint}
            onChange={(event) => setEndpoint(event.target.value)}
          />
          <button className="app-button primary" onClick={() => void save()}>
            Add Peer
          </button>
        </div>
        <div className="mt-2 rounded-md border border-line p-2 text-xs text-muted">
          {status?.discoveryHint}
        </div>
        {status?.localEndpoint ? (
          <div className="mt-2 rounded-md border border-line p-2 text-xs text-muted">
            This device: {status.localEndpoint}
          </div>
        ) : null}
      </div>
      {status?.peers.map((peer) => (
        <div
          key={peer.id}
          className="grid grid-cols-[1fr_auto_auto] gap-2 rounded-md border border-line p-3"
        >
          <div>
            <div className="text-sm font-semibold">{peer.label}</div>
            <div className="truncate text-xs text-muted">{peer.endpoint}</div>
            {peer.last_seen_at ? (
              <div className="text-xs text-muted">
                Last synced {new Date(peer.last_seen_at).toLocaleString()}
              </div>
            ) : null}
          </div>
          <button
            className="app-button"
            title="Sync"
            onClick={() =>
              void api.peerSync.sync(peer.id).then((sync) => {
                setResult(
                  sync.status === 'synced'
                    ? `Synced ${peer.label}: ${sync.applied} changes.`
                    : `Sync ${sync.status}: ${sync.error ?? 'No changes.'}`
                );
                refresh();
              })
            }
          >
            Sync
          </button>
          <button
            className="icon-button"
            title="Delete"
            onClick={() => void api.peerSync.delete(peer.id).then(refresh)}
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      {result && (
        <div className="rounded-md border border-line p-2 text-xs text-muted">{result}</div>
      )}
    </section>
  );
}
