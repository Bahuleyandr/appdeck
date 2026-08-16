import { Trash2 } from 'lucide-react';
import type { JSX } from 'react';
import { useState } from 'react';
import type {
  ShortcutBinding
} from '../../../shared/types';
import { api } from '../../ipc/client';
import { EmptyState } from './helpers';

export function ShortcutsPanel({
  shortcuts,
  refresh
}: {
  shortcuts: ShortcutBinding[];
  refresh: () => void;
}): JSX.Element {
  const [command, setCommand] = useState('');
  const [accelerator, setAccelerator] = useState('');
  const [scope, setScope] = useState<ShortcutBinding['scope']>('global');
  const conflict = shortcuts.some(
    (shortcut) => shortcut.accelerator === accelerator.trim() && shortcut.scope === scope
  );

  return (
    <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
      <section className="panel rounded-md p-3">
        <div className="mb-3 text-sm font-semibold">Shortcut</div>
        <div className="space-y-2">
          <input
            className="field w-full"
            value={command}
            placeholder="Command"
            onChange={(event) => setCommand(event.target.value)}
          />
          <input
            className="field w-full"
            value={accelerator}
            placeholder="Ctrl+Shift+K"
            onChange={(event) => setAccelerator(event.target.value)}
          />
          <select
            className="field w-full"
            value={scope}
            onChange={(event) => setScope(event.target.value as ShortcutBinding['scope'])}
          >
            {(['global', 'workspace', 'service'] as const).map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          {conflict && <div className="text-xs text-red-300">Shortcut conflict detected.</div>}
          <button
            className="app-button w-full border-accent text-white"
            disabled={!command.trim() || !accelerator.trim() || conflict}
            onClick={() =>
              void api.shortcuts
                .upsert({
                  command: command.trim(),
                  accelerator: accelerator.trim(),
                  scope,
                  enabled: true
                })
                .then(() => {
                  setCommand('');
                  setAccelerator('');
                  refresh();
                })
            }
          >
            Save
          </button>
        </div>
      </section>
      <section className="panel rounded-md p-3">
        <div className="space-y-2">
          {shortcuts.length === 0 && <EmptyState label="No custom shortcuts yet." />}
          {shortcuts.map((shortcut) => (
            <div
              key={shortcut.id}
              className="grid grid-cols-[1fr_auto] gap-2 rounded-md border border-line p-2"
            >
              <div className="min-w-0">
                <div className="truncate text-sm">{shortcut.command}</div>
                <div className="truncate text-xs text-muted">
                  {shortcut.accelerator} / {shortcut.scope}
                </div>
              </div>
              <button
                className="icon-button"
                title="Delete shortcut"
                onClick={() => void api.shortcuts.delete(shortcut.id).then(refresh)}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
