import { describe, expect, it } from 'vitest';
import {
  importRecipeRegistryPack,
  getRecipeRegistryEntry,
  listRecipeRegistryEntries,
  recipeRegistryStats,
  seedRecipeRegistry,
  validateRecipeRegistryPack
} from '../../src/main/db/repositories/recipeRegistry.js';
import { createServiceInstance } from '../../src/main/db/repositories/serviceInstances.js';
import { deleteMeta } from '../../src/main/db/repositories/meta.js';
import { listWorkspaces } from '../../src/main/db/repositories/workspaces.js';
import { RecipeLoader } from '../../src/main/recipes/loader.js';
import { createTestDb } from './helpers.js';

describe('recipe registry', () => {
  it('seeds an honest catalog: every seed entry is a distinct real app', () => {
    const { db } = createTestDb();
    const stats = recipeRegistryStats(db);
    const seeds = listRecipeRegistryEntries(db, '', 2000).filter(
      (entry) => entry.source === 'seed'
    );

    // One row per hand-curated app — no name-variant padding.
    expect(stats.seed).toBeGreaterThanOrEqual(80);
    expect(stats.seed).toBeLessThan(200);
    expect(seeds).toHaveLength(stats.seed);
    expect(new Set(seeds.map((entry) => entry.start_url)).size).toBe(seeds.length);
    expect(new Set(seeds.map((entry) => entry.name)).size).toBe(seeds.length);
    // "Azure Portal" is a real product name; the fabricated v1 suffixes were Inbox/Admin/Lite/….
    expect(seeds.some((entry) => / (Inbox|Admin|Lite|Workspace|Reports)$/.test(entry.name))).toBe(
      false
    );
  });

  it('prunes legacy synthetic seed variants on reseed, keeping rows in use', () => {
    const { db, deviceId } = createTestDb();
    const workspace = listWorkspaces(db)[0];
    if (!workspace) throw new Error('Expected default workspace');
    const insertLegacy = db.prepare(
      `INSERT OR REPLACE INTO recipe_registry_entries
        (id, name, category, start_url, allowed_domains, aliases, icon, icon_path, default_user_agent,
         unread_spec, mobile_mode, source, created_at, updated_at)
       VALUES (?, ?, 'Chat', 'https://app.slack.com/', '[]', '[]', NULL, NULL, NULL, NULL, 0, 'seed', 0, 0)`
    );
    insertLegacy.run('seed-slack-portal', 'Slack Portal');
    insertLegacy.run('seed-slack-inbox', 'Slack Inbox');
    createServiceInstance(db, deviceId, {
      recipeId: 'seed-slack-portal',
      workspaceId: workspace.id,
      displayName: 'Kept Slack'
    });

    deleteMeta(db, 'registry_seed_version');
    seedRecipeRegistry(db);

    // Unreferenced padding is gone; a row a service still points at survives.
    expect(getRecipeRegistryEntry(db, 'seed-slack-inbox')).toBe(null);
    expect(getRecipeRegistryEntry(db, 'seed-slack-portal')?.name).toBe('Slack Portal');
    expect(getRecipeRegistryEntry(db, 'seed-slack')?.name).toBe('Slack');
  });

  it('compacts synthetic seed variants in the user-facing app catalog', () => {
    const { db } = createTestDb();
    const catalog = new RecipeLoader(db).catalog();
    const whatsappNames = catalog
      .filter((recipe) => recipe.name.toLowerCase().includes('whatsapp'))
      .map((recipe) => recipe.name);

    expect(whatsappNames).toEqual(['WhatsApp Web']);
    expect(catalog.some((recipe) => recipe.name === 'Fastmail')).toBe(true);
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
