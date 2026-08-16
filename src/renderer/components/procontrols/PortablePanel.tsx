import type { JSX } from 'react';
import { useEffect, useState } from 'react';
import type {
  PortableModeStatus
} from '../../../shared/types';
import { api } from '../../ipc/client';

export function PortablePanel({
  status,
  refresh
}: {
  status: PortableModeStatus | null;
  refresh: () => void;
}): JSX.Element {
  const [enabled, setEnabled] = useState(status?.enabled ?? false);
  const [root, setRoot] = useState(status?.rootPath ?? '');
  useEffect(() => {
    setEnabled(status?.enabled ?? false);
    setRoot(status?.rootPath ?? '');
  }, [status]);
  return (
    <section className="space-y-3">
      <div className="panel rounded-md p-3">
        <div className="mb-3 text-sm font-semibold">AppDeck Portable Mode</div>
        <label className="mb-2 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
          />
          Enable portable recovery root
        </label>
        <input
          className="field w-full"
          value={root}
          onChange={(event) => setRoot(event.target.value)}
        />
        <button
          className="app-button primary mt-2"
          onClick={() => void api.portable.configure(enabled, root).then(refresh)}
        >
          Save
        </button>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="panel rounded-md p-3 text-xs text-muted">
          <div className="mb-2 text-sm font-semibold text-ink">Recommended Roots</div>
          {(status?.recommendedPaths ?? []).map((item) => (
            <div key={item} className="mb-2 rounded-md border border-line p-2">
              {item}
            </div>
          ))}
        </div>
        <div className="panel rounded-md p-3 text-xs text-muted">
          <div className="mb-2 text-sm font-semibold text-ink">Notes</div>
          {(status?.notes ?? []).map((item) => (
            <div key={item} className="mb-2 rounded-md border border-line p-2">
              {item}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
