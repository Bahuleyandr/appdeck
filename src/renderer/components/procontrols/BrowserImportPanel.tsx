import type { JSX } from 'react';
import { useState } from 'react';
import type {
  BrowserImportPreview,
  Workspace
} from '../../../shared/types';
import { api } from '../../ipc/client';

export function BrowserImportPanel({
  workspaces,
  selectedWorkspaceId,
  load
}: {
  workspaces: Workspace[];
  selectedWorkspaceId: string | null;
  load: () => Promise<void>;
}): JSX.Element {
  const [data, setData] = useState('');
  const [workspaceId, setWorkspaceId] = useState(selectedWorkspaceId ?? '');
  const [preview, setPreview] = useState<BrowserImportPreview | null>(null);
  const [result, setResult] = useState('');
  return (
    <section className="space-y-3">
      <div className="panel rounded-md p-3">
        <div className="mb-3 text-sm font-semibold">Browser Import</div>
        <select
          className="field mb-2 w-full"
          value={workspaceId}
          onChange={(event) => setWorkspaceId(event.target.value)}
        >
          {workspaces.map((workspace) => (
            <option key={workspace.id} value={workspace.id}>
              {workspace.name}
            </option>
          ))}
        </select>
        <textarea
          className="field h-48 w-full py-2"
          placeholder="Paste Chrome/Edge/Firefox bookmark JSON or HTML export"
          value={data}
          onChange={(event) => setData(event.target.value)}
        />
        <div className="mt-2 flex gap-2">
          <button
            className="app-button"
            onClick={() => void api.browserImport.preview(data).then(setPreview)}
          >
            Preview
          </button>
          <button
            className="app-button primary"
            disabled={!preview}
            onClick={() =>
              void api.browserImport
                .run(data, workspaceId || selectedWorkspaceId)
                .then(async (run) => {
                  setResult(`Imported ${run.created}, skipped ${run.skipped} from ${run.source}.`);
                  await load();
                })
            }
          >
            Import
          </button>
        </div>
      </div>
      {preview && (
        <div className="panel rounded-md p-3 text-sm">
          <div className="font-semibold">
            {preview.source}: {preview.importable}/{preview.total} importable
          </div>
          <div className="mt-2 max-h-72 space-y-2 overflow-y-auto">
            {preview.items.slice(0, 50).map((item) => (
              <div key={`${item.title}-${item.url}`} className="rounded-md border border-line p-2">
                <div className="truncate text-sm">{item.title}</div>
                <div className="truncate text-xs text-muted">{item.url}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {result && (
        <div className="rounded-md border border-line p-2 text-xs text-muted">{result}</div>
      )}
    </section>
  );
}
