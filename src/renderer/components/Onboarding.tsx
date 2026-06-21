import { Check, Plus } from 'lucide-react';
import { useAppStore } from '../state/appStore';

export function Onboarding(): JSX.Element | null {
  const { settings, setSettingValue, recipes, createService, services } = useAppStore();
  if (settings.onboarded === 'true') return null;

  const starters = recipes.filter((recipe) => recipe.source === 'builtin' && !recipe.isLauncherOnly);
  const added = new Set(services.map((service) => service.recipe_id));

  return (
    <div className="absolute inset-0 z-[70] flex items-center justify-center bg-shell">
      <section className="w-[640px] rounded-md border border-line bg-panel p-6 shadow-2xl">
        <h1 className="text-lg font-semibold">Welcome to AppDeck</h1>
        <p className="mt-1 text-sm text-muted">Add a few services to get started. Everything runs isolated, sleeps when idle, and stays local.</p>

        <div className="mt-5 text-xs font-semibold uppercase tracking-wide text-muted">Theme</div>
        <div className="mt-2 flex gap-2">
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

        <div className="mt-5 text-xs font-semibold uppercase tracking-wide text-muted">Starter services</div>
        <div className="mt-2 grid grid-cols-3 gap-2">
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

        <div className="mt-6 flex justify-end">
          <button className="app-button border-accent text-white" onClick={() => void setSettingValue('onboarded', 'true')}>
            Start using AppDeck
          </button>
        </div>
      </section>
    </div>
  );
}
