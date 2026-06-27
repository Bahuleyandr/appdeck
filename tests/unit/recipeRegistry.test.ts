import { describe, expect, it } from 'vitest';
import {
  importRecipeRegistryPack,
  listRecipeRegistryEntries,
  recipeRegistryStats,
  validateRecipeRegistryPack
} from '../../src/main/db/repositories/recipeRegistry.js';
import { createTestDb } from './helpers.js';

describe('recipe registry', () => {
  it('seeds a personal-pro sized app catalog', () => {
    const { db } = createTestDb();
    const stats = recipeRegistryStats(db);

    expect(stats.seed).toBeGreaterThanOrEqual(1500);
    expect(stats.total).toBeGreaterThanOrEqual(1500);
    expect(listRecipeRegistryEntries(db, 'slack mobile', 5)[0]?.mobile_mode).toBe(true);
  });

  it('imports community JSON packs with aliases and inferred domains', () => {
    const { db } = createTestDb();
    const result = importRecipeRegistryPack(
      db,
      JSON.stringify({
        entries: [
          {
            id: 'community-local-tool',
            name: 'Local Tool',
            category: 'Dev',
            url: 'https://tool.example.com/app',
            aliases: ['Toolbox'],
            mobileMode: true
          },
          { name: '', url: 'not-enough' }
        ]
      })
    );

    expect(result).toEqual({ imported: 1, skipped: 1 });
    const imported = listRecipeRegistryEntries(db, 'toolbox', 1)[0];
    expect(imported?.id).toBe('community-local-tool');
    expect(imported?.source).toBe('community');
    expect(imported?.allowed_domains).toContain('tool.example.com');
    expect(imported?.mobile_mode).toBe(true);
  });

  it('validates packs before import', () => {
    const preview = validateRecipeRegistryPack(
      JSON.stringify({
        entries: [
          { name: 'Good', category: 'Dev', url: 'https://good.example.com' },
          { name: 'Bad', category: 'Unknown', url: 'not-a-url' }
        ]
      })
    );

    expect(preview.valid).toBe(false);
    expect(preview.imported).toBe(1);
    expect(preview.skipped).toBe(1);
    expect(preview.issues.length).toBeGreaterThan(0);
  });
});
