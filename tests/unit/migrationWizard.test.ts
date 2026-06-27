import { describe, expect, it } from 'vitest';
import { listServiceInstances } from '../../src/main/db/repositories/serviceInstances.js';
import { RecipeLoader } from '../../src/main/recipes/loader.js';
import { previewMigration, runMigration } from '../../src/main/services/migrationWizard.js';
import { createTestDb } from './helpers.js';

describe('migration wizard', () => {
  it('previews mixed competitor exports without writing', () => {
    const { db } = createTestDb();
    const loader = new RecipeLoader(db);
    const raw = JSON.stringify({
      app: 'rambox',
      services: [
        { recipeId: 'gmail', name: 'Mail' },
        { name: 'Internal', customUrl: 'https://internal.example.com' },
        { name: 'Broken' }
      ]
    });

    const preview = previewMigration(raw, loader);
    expect(preview.source).toBe('rambox');
    expect(preview.total).toBe(2);
    expect(preview.importable).toBe(2);
    expect(listServiceInstances(db)).toHaveLength(0);
  });

  it('runs imports and creates custom recipes for valid URLs', () => {
    const { db, deviceId } = createTestDb();
    const loader = new RecipeLoader(db);
    const raw = JSON.stringify({
      services: [
        { recipeId: 'gmail', name: 'Mail' },
        { name: 'Internal', url: 'https://internal.example.com' }
      ]
    });

    const result = runMigration(db, deviceId, loader, raw);
    expect(result.created).toBe(2);
    expect(result.rollbackExport).toContain('Internal');
    expect(listServiceInstances(db)).toHaveLength(2);
  });
});
