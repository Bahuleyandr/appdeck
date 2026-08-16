import { Plus, Trash2 } from 'lucide-react';
import type { JSX } from 'react';
import { useState } from 'react';
import type {
  ExtensionRecord
} from '../../../shared/types';
import { api } from '../../ipc/client';
import { EmptyState } from './helpers';

export function ExtensionPanel({
  extensions,
  refresh
}: {
  extensions: ExtensionRecord[];
  refresh: () => void;
}): JSX.Element {
  const [path, setPath] = useState('');
  return (
    <section className="panel rounded-md p-3">
      <div className="mb-3 flex gap-2">
        <input
          className="field flex-1"
          value={path}
          placeholder="Path to unpacked extension folder"
          onChange={(event) => setPath(event.target.value)}
        />
        <button
          className="app-button"
          disabled={!path.trim()}
          onClick={() =>
            void api.extensions.add(path.trim()).then(() => {
              setPath('');
              refresh();
            })
          }
        >
          <Plus size={15} />
          Add
        </button>
      </div>
      <div className="space-y-2">
        {extensions.length === 0 && <EmptyState label="No extensions installed." />}
        {extensions.map((extension) => (
          <div
            key={extension.id}
            className="grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-md border border-line p-2"
          >
            <input
              type="checkbox"
              checked={extension.enabled}
              onChange={(event) =>
                void api.extensions.setEnabled(extension.id, event.target.checked).then(refresh)
              }
            />
            <div className="min-w-0">
              <div className="truncate text-sm">{extension.name}</div>
              <div className="truncate text-xs text-muted">{extension.path}</div>
            </div>
            <button
              className="icon-button"
              aria-label="Remove extension"
              title="Remove extension"
              onClick={() => void api.extensions.remove(extension.id).then(refresh)}
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
