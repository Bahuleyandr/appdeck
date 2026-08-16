import type { JSX } from 'react';
import { useState } from 'react';
import type {
  RecipeStudioAnalysis,
  ServiceCategory
} from '../../../shared/types';
import { api } from '../../ipc/client';
import { CATEGORIES } from './helpers';

export function RecipeStudioPanel({ refreshCatalog }: { refreshCatalog: () => void }): JSX.Element {
  const [name, setName] = useState('New App');
  const [url, setUrl] = useState('https://example.com');
  const [category, setCategory] = useState<ServiceCategory>('Productivity');
  const [analysis, setAnalysis] = useState<RecipeStudioAnalysis | null>(null);
  const [result, setResult] = useState('');
  const analyze = async (): Promise<void> => {
    setAnalysis(await api.recipeStudio.analyze({ name, url, category }));
  };
  const create = async (): Promise<void> => {
    const recipe = await api.recipeStudio.create({ name, url, category });
    setResult(`Created ${recipe.name}.`);
    refreshCatalog();
  };
  return (
    <section className="space-y-3">
      <div className="panel rounded-md p-3">
        <div className="mb-3 text-sm font-semibold">Recipe Studio</div>
        <div className="grid gap-2 lg:grid-cols-[1fr_1fr_180px]">
          <input className="field" value={name} onChange={(event) => setName(event.target.value)} />
          <input className="field" value={url} onChange={(event) => setUrl(event.target.value)} />
          <select
            className="field"
            value={category}
            onChange={(event) => setCategory(event.target.value as ServiceCategory)}
          >
            {CATEGORIES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-2 flex gap-2">
          <button className="app-button" onClick={() => void analyze()}>
            Analyze
          </button>
          <button className="app-button primary" onClick={() => void create()}>
            Create Recipe
          </button>
        </div>
      </div>
      {analysis && (
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="panel rounded-md p-3">
            <div className="text-sm font-semibold">{analysis.valid ? 'Ready' : 'Needs fixes'}</div>
            <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-shell p-2 text-xs">
              {JSON.stringify(analysis.recipe, null, 2)}
            </pre>
          </div>
          <div className="panel rounded-md p-3 text-xs text-muted">
            {[...analysis.issues, ...analysis.suggestions].map((item) => (
              <div key={item} className="mb-2 rounded-md border border-line p-2">
                {item}
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
