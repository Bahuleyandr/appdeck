import type { JSX } from 'react';
import { useState } from 'react';
import type {
  WorkKit
} from '../../../shared/types';
import { api } from '../../ipc/client';

export function WorkKitsPanel({
  kits,
  refresh,
  load
}: {
  kits: WorkKit[];
  refresh: () => void;
  load: () => Promise<void>;
}): JSX.Element {
  const [result, setResult] = useState('');
  return (
    <section className="grid gap-3 lg:grid-cols-2">
      {kits.map((kit) => (
        <div key={kit.id} className="panel rounded-md p-3">
          <div className="text-sm font-semibold">{kit.name}</div>
          <div className="mt-1 text-xs text-muted">{kit.description}</div>
          <div className="mt-2 text-xs text-muted">
            {kit.payload.services.length} services / {kit.payload.aiPrompts?.length ?? 0} prompts
          </div>
          <button
            className="app-button primary mt-3"
            onClick={() =>
              void api.workKits.apply(kit.id).then(async (applied) => {
                setResult(`Created ${applied.kit.name} with ${applied.createdServices} services.`);
                refresh();
                await load();
              })
            }
          >
            Apply Kit
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
