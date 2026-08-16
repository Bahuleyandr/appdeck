import type { JSX } from 'react';
import { useEffect, useState } from 'react';
import type {
  MigrationPreview,
  Workspace
} from '../../../shared/types';
import { api } from '../../ipc/client';

export function ImportPanel({
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
  const [preview, setPreview] = useState<MigrationPreview | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setWorkspaceId(selectedWorkspaceId ?? '');
  }, [selectedWorkspaceId]);

  return (
    <section className="panel rounded-md p-3">
      <div className="mb-3 grid gap-2 sm:grid-cols-[220px_1fr]">
        <select
          className="field"
          value={workspaceId}
          onChange={(event) => setWorkspaceId(event.target.value)}
        >
          {workspaces.map((workspace) => (
            <option key={workspace.id} value={workspace.id}>
              {workspace.name}
            </option>
          ))}
        </select>
        <div className="text-xs text-muted">
          Ferdium, Franz, Rambox, WebCatalog, Shift, or bookmark JSON
        </div>
      </div>
      <textarea
        className="field h-64 w-full py-2"
        value={data}
        onChange={(event) => setData(event.target.value)}
      />
      <div className="mt-3 flex items-center gap-2">
        <button
          className="app-button"
          disabled={!data.trim()}
          onClick={() =>
            void api.migration
              .preview(data)
              .then((result) => {
                setPreview(result);
                setMessage(
                  `${result.source}: ${result.importable} importable, ${result.skipped} skipped.`
                );
              })
              .catch((error: unknown) =>
                setMessage(error instanceof Error ? error.message : String(error))
              )
          }
        >
          Preview
        </button>
        <button
          className="app-button border-accent text-white"
          disabled={!data.trim() || preview?.importable === 0}
          onClick={() =>
            void api.migration
              .run(data, workspaceId || null)
              .then((result) => {
                setMessage(
                  `Imported ${result.created}, skipped ${result.skipped}. Rollback export is below.`
                );
                setPreview({
                  source: result.source,
                  total: result.created + result.skipped,
                  importable: result.created,
                  skipped: result.skipped,
                  items: [],
                  rollbackExport: result.rollbackExport
                });
                setData('');
                return load();
              })
              .catch((error: unknown) =>
                setMessage(error instanceof Error ? error.message : String(error))
              )
          }
        >
          Import
        </button>
        {message && <span className="text-xs text-muted">{message}</span>}
      </div>
      {preview && (
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-line p-2 text-xs">
            {preview.items.slice(0, 40).map((item, index) => (
              <div
                key={`${item.name}-${index}`}
                className={`rounded px-2 py-1 ${item.importable ? 'bg-elevated' : 'border border-red-500/30 text-red-200'}`}
              >
                <div className="truncate">{item.name}</div>
                <div className="truncate text-muted">
                  {item.willCreateCustomRecipe ? 'custom recipe' : (item.recipeId ?? 'skipped')}
                  {item.reason ? ` / ${item.reason}` : ''}
                </div>
              </div>
            ))}
            {preview.items.length === 0 && <div className="text-muted">Rollback/export only.</div>}
          </div>
          <textarea
            className="field h-48 w-full py-2 text-xs"
            readOnly
            value={preview.rollbackExport}
          />
        </div>
      )}
    </section>
  );
}
