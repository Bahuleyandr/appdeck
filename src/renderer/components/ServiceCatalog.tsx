import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import type { RecipeCatalogItem } from '../../shared/types';
import { useAppStore } from '../state/appStore';

export function ServiceCatalog(): JSX.Element | null {
  const { catalogOpen, recipes, createService, createCustomService, setCatalogOpen } = useAppStore();
  const [query, setQuery] = useState('');
  const [customName, setCustomName] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const filtered = useMemo(
    () => recipes.filter((recipe) => recipe.name.toLowerCase().includes(query.toLowerCase())),
    [query, recipes]
  );
  if (!catalogOpen) return null;
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/55">
      <section className="flex h-[640px] w-[760px] max-w-[92vw] flex-col rounded-md border border-line bg-panel shadow-2xl">
        <header className="flex h-12 items-center justify-between border-b border-line px-4">
          <div className="text-sm font-semibold">Catalog</div>
          <button className="icon-button" title="Close" onClick={() => setCatalogOpen(false)}>
            <X size={16} />
          </button>
        </header>
        <div className="flex items-center gap-2 border-b border-line p-3">
          <Search size={16} className="text-muted" />
          <input className="field flex-1" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search" />
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-[1fr_280px]">
          <div className="min-h-0 overflow-y-auto p-3">
            <div className="grid grid-cols-2 gap-2">
              {filtered.map((recipe) => (
                <RecipeButton key={recipe.id} recipe={recipe} onAdd={() => void createService(recipe)} />
              ))}
            </div>
          </div>
          <aside className="border-l border-line p-3">
            <div className="mb-3 text-sm font-semibold">Custom</div>
            <div className="space-y-2">
              <input className="field w-full" value={customName} onChange={(event) => setCustomName(event.target.value)} placeholder="Name" />
              <input className="field w-full" value={customUrl} onChange={(event) => setCustomUrl(event.target.value)} placeholder="https://example.com" />
              <button
                className="app-button w-full"
                disabled={!customName.trim() || !customUrl.trim()}
                onClick={() => {
                  const domains = domainsFromUrl(customUrl);
                  if (!domains.length) return;
                  void createCustomService({ name: customName, url: customUrl, domains, category: 'Other' }).then(() => {
                    setCustomName('');
                    setCustomUrl('');
                  });
                }}
              >
                Add custom
              </button>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}

function RecipeButton({ recipe, onAdd }: { recipe: RecipeCatalogItem; onAdd: () => void }): JSX.Element {
  return (
    <button className="flex h-20 flex-col items-start justify-between rounded-md border border-line bg-shell p-3 text-left hover:border-accent" onClick={onAdd}>
      <span className="text-sm font-semibold">{recipe.name}</span>
      <span className="text-xs text-muted">{recipe.category}</span>
    </button>
  );
}

function domainsFromUrl(value: string): string[] {
  try {
    return [new URL(value).hostname];
  } catch {
    return [];
  }
}
