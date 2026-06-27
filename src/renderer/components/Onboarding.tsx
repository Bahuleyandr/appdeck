import { useState } from 'react';
import { Check, Plus } from 'lucide-react';
import type { MigrationPreview } from '../../shared/types';
import { api } from '../ipc/client';
import { useAppStore } from '../state/appStore';

export function Onboarding(): JSX.Element | null {
  const { settings, setSettingValue, recipes, createService, services, load } = useAppStore();
  const [mode, setMode] = useState<'switch' | 'starters'>('switch');
  const [source, setSource] = useState('Rambox');
  const [migrationData, setMigrationData] = useState('');
  const [preview, setPreview] = useState<MigrationPreview | null>(null);
  const [message, setMessage] = useState('');
  if (settings.onboarded === 'true') return null;

  const starters = recipes.filter(
    (recipe) => recipe.source === 'builtin' && !recipe.isLauncherOnly
  );
  const added = new Set(services.map((service) => service.recipe_id));
  const sources = ['Rambox', 'Wavebox', 'Franz', 'Ferdium', 'WebCatalog', 'Chrome'];

  const previewMigration = async (): Promise<void> => {
    setMessage('');
    try {
      setPreview(await api.migration.preview(migrationData));
    } catch {
      setPreview(null);
      setMessage('Paste a valid JSON export or Chrome bookmarks JSON.');
    }
  };

  const runMigration = async (): Promise<void> => {
    setMessage('');
    try {
      const result = await api.migration.run(migrationData);
      await load();
      setMessage(`Imported ${result.created} services. Skipped ${result.skipped}.`);
      await setSettingValue('onboarded', 'true');
    } catch {
      setMessage('Import failed. Check the export text and try again.');
    }
  };

  return (
    <div className="absolute inset-0 z-[70] flex items-center justify-center overflow-hidden bg-shell p-4">
      <section className="flex max-h-[calc(100vh-2rem)] w-[min(760px,calc(100vw-2rem))] flex-col overflow-hidden rounded-md border border-line bg-panel shadow-2xl">
        <div className="shrink-0 border-b border-line/60 px-6 py-5">
          <h1 className="text-lg font-semibold">Welcome to AppDeck</h1>
          <p className="mt-1 text-sm text-muted">
            Move an existing workspace over, or start fresh with a few isolated services.
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">Theme</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {(['system', 'light', 'dark'] as const).map((theme) => (
              <button
                key={theme}
                className={`app-button capitalize ${settings.theme === theme ? 'border-accent text-white' : ''}`}
                onClick={() => void setSettingValue('theme', theme)}
              >
                {theme}
              </button>
            ))}
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <button
              className={`rounded-md border p-3 text-left ${mode === 'switch' ? 'border-accent bg-accent/10' : 'border-line hover:border-accent/70'}`}
              onClick={() => setMode('switch')}
            >
              <div className="text-sm font-semibold">Switch from another app</div>
              <div className="mt-1 text-xs text-muted">
                Paste an export and let AppDeck build it.
              </div>
            </button>
            <button
              className={`rounded-md border p-3 text-left ${mode === 'starters' ? 'border-accent bg-accent/10' : 'border-line hover:border-accent/70'}`}
              onClick={() => setMode('starters')}
            >
              <div className="text-sm font-semibold">Start fresh</div>
              <div className="mt-1 text-xs text-muted">Pick a few services manually.</div>
            </button>
          </div>

          {mode === 'switch' ? (
            <div className="mt-5">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted">Source</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {sources.map((item) => (
                  <button
                    key={item}
                    className={`app-button ${source === item ? 'border-accent text-white' : ''}`}
                    onClick={() => setSource(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
              <textarea
                className="mt-3 h-32 w-full resize-none rounded-md border border-line bg-shell p-3 text-xs outline-none focus:border-accent"
                placeholder={`Paste your ${source} export here`}
                value={migrationData}
                onChange={(event) => {
                  setMigrationData(event.target.value);
                  setPreview(null);
                  setMessage('');
                }}
              />
              {preview ? (
                <div className="mt-3 rounded-md border border-line bg-shell p-3 text-sm">
                  <div className="font-semibold">
                    {preview.importable} of {preview.total} services ready to import
                  </div>
                  <div className="mt-1 text-xs text-muted">
                    Detected {preview.source}. {preview.skipped} items will be skipped.
                  </div>
                  <div className="mt-2 grid max-h-24 grid-cols-2 gap-1 overflow-y-auto text-xs">
                    {preview.items.slice(0, 8).map((item, index) => (
                      <div key={`${item.name}-${index}`} className="truncate text-muted">
                        {item.importable ? 'Ready' : 'Skip'}: {item.name}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              {message ? <div className="mt-3 text-sm text-muted">{message}</div> : null}
            </div>
          ) : (
            <div className="mt-5">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted">
                Starter services
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {starters.map((recipe) => {
                  const isAdded = added.has(recipe.id);
                  return (
                    <button
                      key={recipe.id}
                      className={`flex h-10 items-center justify-between rounded-md border px-3 text-sm ${isAdded ? 'border-accent text-accent' : 'border-line hover:border-accent/70'}`}
                      disabled={isAdded}
                      onClick={() => void createService(recipe)}
                    >
                      <span className="truncate">{recipe.name}</span>
                      {isAdded ? <Check size={14} /> : <Plus size={14} />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap justify-between gap-2 border-t border-line/60 px-6 py-4">
          <button className="app-button" onClick={() => void setSettingValue('onboarded', 'true')}>
            Skip
          </button>
          {mode === 'switch' ? (
            <div className="flex gap-2">
              <button
                className="app-button"
                disabled={!migrationData.trim()}
                onClick={() => void previewMigration()}
              >
                Preview
              </button>
              <button
                className="app-button border-accent text-white"
                disabled={!preview || preview.importable === 0}
                onClick={() => void runMigration()}
              >
                Build workspace
              </button>
            </div>
          ) : (
            <button
              className="app-button border-accent text-white"
              onClick={() => void setSettingValue('onboarded', 'true')}
            >
              Start using AppDeck
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
