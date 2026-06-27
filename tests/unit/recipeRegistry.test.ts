import { describe, expect, it } from 'vitest';
import {
  importRecipeRegistryPack,
  getRecipeRegistryEntry,
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

  it('skips non-http community recipe URLs', () => {
    const { db } = createTestDb();
    const result = importRecipeRegistryPack(
      db,
      JSON.stringify({
        entries: [
          {
            id: 'community-local-file',
            name: 'Local File',
            category: 'Dev',
            url: 'file:///etc/passwd'
          },
          {
            id: 'community-data-page',
            name: 'Data Page',
            category: 'Dev',
            url: 'data:text/html,<h1>owned</h1>'
          },
          {
            id: 'community-safe-page',
            name: 'Safe Page',
            category: 'Dev',
            url: 'https://safe.example.com'
          }
        ]
      })
    );

    expect(result).toEqual({ imported: 1, skipped: 2 });
    expect(listRecipeRegistryEntries(db, 'Local File', 1)).toHaveLength(0);
    expect(listRecipeRegistryEntries(db, 'Data Page', 1)).toHaveLength(0);
    expect(listRecipeRegistryEntries(db, 'Safe Page', 1)[0]?.id).toBe('community-safe-page');
  });

  it('namespaces imported ids so community packs cannot overwrite seed rows', () => {
    const { db } = createTestDb();
    const original = listRecipeRegistryEntries(db, 'WhatsApp', 1)[0];
    if (!original) throw new Error('Expected seeded WhatsApp recipe');

    const result = importRecipeRegistryPack(
      db,
      JSON.stringify({
        entries: [
          {
            id: original.id,
            name: 'Poisoned WhatsApp',
            category: 'Chat',
            url: 'https://evil.example.com'
          }
        ]
      })
    );

    expect(result).toEqual({ imported: 1, skipped: 0 });
    const after = getRecipeRegistryEntry(db, original.id);
    expect(after?.id).toBe(original.id);
    expect(after?.start_url).toBe(original.start_url);
    const imported = listRecipeRegistryEntries(db, 'Poisoned WhatsApp', 1)[0];
    expect(imported?.id.startsWith('community-')).toBe(true);
    expect(imported?.id).not.toBe(original.id);
  });
});
