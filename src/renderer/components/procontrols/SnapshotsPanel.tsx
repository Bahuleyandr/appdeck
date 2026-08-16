import { Trash2 } from 'lucide-react';
import type { JSX } from 'react';
import { useState } from 'react';
import type { WorkspaceSnapshot } from '../../../shared/types';
import { api } from '../../ipc/client';
import { EmptyState } from './helpers';

export function SnapshotsPanel({
  snapshots,
  selectedWorkspaceId,
  refresh,
  load
}: {
  snapshots: WorkspaceSnapshot[];
  selectedWorkspaceId: string | null;
  refresh: () => void;
  load: () => Promise<void>;
}): JSX.Element {
  const [name, setName] = useState('Before changes');
  const create = async (): Promise<void> => {
    if (!selectedWorkspaceId) return;
    await api.snapshots.create(selectedWorkspaceId, name);
    refresh();
  };
  return (
    <section className="space-y-3">
      <div className="panel rounded-md p-3">
        <div className="mb-3 text-sm font-semibold">Workspace Snapshots</div>
        <div className="flex gap-2">
          <input
            className="field flex-1"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <button
            className="app-button primary"
            disabled={!selectedWorkspaceId}
            onClick={() => void create()}
          >
            Save Snapshot
          </button>
        </div>
      </div>
      {snapshots.length === 0 && <EmptyState label="No snapshots yet." />}
      {snapshots.map((snapshot) => (
        <div
          key={snapshot.id}
          className="grid grid-cols-[1fr_auto_auto] gap-2 rounded-md border border-line p-3"
        >
          <div>
            <div className="text-sm font-semibold">{snapshot.name}</div>
            <div className="text-xs text-muted">
              {snapshot.payload.services.length} services /{' '}
              {new Date(snapshot.created_at).toLocaleString()}
            </div>
          </div>
          <button
            className="app-button h-8 px-2 text-xs"
            onClick={() => void api.snapshots.restore(snapshot.id).then(async () => load())}
          >
            Restore
          </button>
          <button
            className="icon-button"
            title="Delete"
            onClick={() => void api.snapshots.delete(snapshot.id).then(refresh)}
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
    </section>
  );
}
