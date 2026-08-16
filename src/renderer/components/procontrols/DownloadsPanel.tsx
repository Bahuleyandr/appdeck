import type { JSX } from 'react';
import type {
  DownloadRecord
} from '../../../shared/types';
import { api } from '../../ipc/client';
import { EmptyState } from './helpers';

export function DownloadsPanel({
  downloads,
  refresh
}: {
  downloads: DownloadRecord[];
  refresh: () => void;
}): JSX.Element {
  return (
    <section className="panel rounded-md p-3">
      <div className="mb-3 flex justify-between gap-2">
        <div className="text-sm font-semibold">Downloads</div>
        <button className="app-button" onClick={() => void api.downloads.clear().then(refresh)}>
          Clear
        </button>
      </div>
      <div className="space-y-2">
        {downloads.length === 0 && <EmptyState label="No downloads yet." />}
        {downloads.map((download) => (
          <div
            key={download.id}
            className="grid grid-cols-[1fr_auto] gap-2 rounded-md border border-line p-2"
          >
            <div className="min-w-0">
              <div className="truncate text-sm">{download.filename}</div>
              <div className="truncate text-xs text-muted">
                {download.state} / {download.received_bytes} bytes /{' '}
                {new Date(download.started_at).toLocaleString()}
              </div>
            </div>
            <button
              className="app-button h-8 px-2 text-xs"
              disabled={!download.path}
              onClick={() => void api.downloads.open(download.id)}
            >
              Open
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
