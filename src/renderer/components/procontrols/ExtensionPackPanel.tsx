import type { JSX } from 'react';
import { useState } from 'react';
import type {
  LocalExtensionTemplate
} from '../../../shared/types';
import { api } from '../../ipc/client';

export function ExtensionPackPanel({ templates }: { templates: LocalExtensionTemplate[] }): JSX.Element {
  const [result, setResult] = useState('');
  return (
    <section className="grid gap-3 lg:grid-cols-2">
      {templates.map((template) => (
        <div key={template.id} className="panel rounded-md p-3">
          <div className="text-sm font-semibold">{template.name}</div>
          <div className="mt-1 text-xs text-muted">{template.description}</div>
          <div className="mt-2 text-xs text-muted">{template.capabilities.join(' / ')}</div>
          <button
            className="app-button mt-3"
            onClick={() =>
              void api.extensionPack
                .apply(template.id)
                .then((applied) => setResult(`${applied.name} enabled.`))
            }
          >
            Enable
          </button>
        </div>
      ))}
      {result && (
        <div className="rounded-md border border-line p-2 text-xs text-muted lg:col-span-2">
          {result}
        </div>
      )}
    </section>
  );
}
