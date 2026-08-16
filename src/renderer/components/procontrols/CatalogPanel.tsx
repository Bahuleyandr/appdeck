import type { JSX } from 'react';
import { useEffect, useState } from 'react';
import type {
  RecipeCatalogItem,
  RecipePackValidation,
  RecipeRegistryEntry
} from '../../../shared/types';
import { api } from '../../ipc/client';
import { EmptyState, registryToCatalog } from './helpers';

export function CatalogPanel({
  stats,
  createService
}: {
  stats: { total: number; seed: number; community: number; user: number } | null;
  createService: (
    recipe: RecipeCatalogItem,
    displayName?: string,
    profileId?: string | null
  ) => Promise<void>;
}): JSX.Element {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<RecipeRegistryEntry[]>([]);
  const [pack, setPack] = useState('');
  const [validation, setValidation] = useState<RecipePackValidation | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    // Debounce + cancel so a slow older query can never overwrite a newer result set.
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void api.registry.search(q, 80).then((entries) => {
        if (!cancelled) setResults(entries);
      });
    }, 120);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [q]);

  return (
    <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
      <section className="panel rounded-md p-3">
        <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_auto]">
          <input
            className="field"
            value={q}
            placeholder="Search the curated app catalog"
            onChange={(event) => setQ(event.target.value)}
          />
          <div className="rounded-md border border-line px-3 py-2 text-xs text-muted">
            {stats ? `${stats.total} apps, ${stats.community} community` : 'Loading'}
          </div>
        </div>
        <div className="grid gap-2 lg:grid-cols-2">
          {results.map((entry) => (
            <div key={entry.id} className="rounded-md border border-line p-2">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{entry.name}</div>
                  <div className="truncate text-xs text-muted">{entry.start_url}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <span className="rounded bg-elevated px-1.5 py-0.5 text-[11px] text-muted">
                      {entry.category}
                    </span>
                    {entry.mobile_mode && (
                      <span className="rounded bg-elevated px-1.5 py-0.5 text-[11px] text-muted">
                        mobile
                      </span>
                    )}
                    <span className="rounded bg-elevated px-1.5 py-0.5 text-[11px] text-muted">
                      {entry.source}
                    </span>
                  </div>
                </div>
                <button
                  className="app-button h-8 px-2 text-xs"
                  onClick={() => void createService(registryToCatalog(entry))}
                >
                  Add
                </button>
              </div>
            </div>
          ))}
          {results.length === 0 && <EmptyState label="No recipes found." />}
        </div>
      </section>

      <section className="panel rounded-md p-3">
        <div className="mb-3 text-sm font-semibold">Community Pack</div>
        <textarea
          className="field h-64 w-full py-2"
          value={pack}
          placeholder='{"entries":[{"name":"Example","url":"https://example.com","category":"Productivity"}]}'
          onChange={(event) => setPack(event.target.value)}
        />
        <div className="mt-3 flex items-center gap-2">
          <button
            className="app-button"
            disabled={!pack.trim()}
            onClick={() =>
              void api.registry
                .validate(pack)
                .then((result) => {
                  setValidation(result);
                  setMessage(
                    result.valid ? `Valid pack: ${result.imported} entries.` : 'Pack has issues.'
                  );
                })
                .catch((error: unknown) =>
                  setMessage(error instanceof Error ? error.message : String(error))
                )
            }
          >
            Validate
          </button>
          <button
            className="app-button border-accent text-white"
            disabled={!pack.trim() || validation?.valid === false}
            onClick={() =>
              void api.registry
                .import(pack)
                .then((result) => {
                  setMessage(`Imported ${result.imported}, skipped ${result.skipped}.`);
                  setPack('');
                  setValidation(null);
                  return api.registry.search(q, 80).then(setResults);
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
        {validation && (
          <div className="mt-3 space-y-2 text-xs">
            {validation.issues.length > 0 && (
              <div className="rounded-md border border-red-500/40 p-2 text-red-200">
                {validation.issues.slice(0, 4).join(' · ')}
              </div>
            )}
            <div className="rounded-md border border-line p-2 text-muted">
              Preview: {validation.imported} importable, {validation.skipped} skipped
            </div>
            <div className="max-h-28 space-y-1 overflow-y-auto">
              {validation.entries.slice(0, 8).map((entry) => (
                <div key={entry.id} className="truncate rounded bg-elevated px-2 py-1">
                  {entry.name} / {entry.category}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
