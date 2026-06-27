import { describe, expect, it } from 'vitest';
import {
  createServiceInstance,
  getServiceInstance
} from '../../src/main/db/repositories/serviceInstances.js';
import { listWorkspaces } from '../../src/main/db/repositories/workspaces.js';
import { RecipeLoader } from '../../src/main/recipes/loader.js';
import { buildRepairStatus, runRepair } from '../../src/main/services/repair.js';
import { createTestDb } from './helpers.js';

describe('repair service', () => {
  it('cleans invalid last URLs and disables services with missing recipes', () => {
    const { db, deviceId } = createTestDb();
    const workspace = listWorkspaces(db)[0];
    if (!workspace) throw new Error('Expected workspace');
    const service = createServiceInstance(db, deviceId, {
      recipeId: 'github',
      workspaceId: workspace.id,
      displayName: 'GitHub'
    });
    db.prepare('UPDATE service_instances SET last_url = ? WHERE id = ?').run(
      'file:///etc/passwd',
      service.id
    );
    db.prepare('UPDATE service_instances SET recipe_id = ? WHERE id = ?').run(
      'missing-recipe',
      service.id
    );
    const loader = new RecipeLoader(db);

    const before = buildRepairStatus(db, loader);
    expect(before.invalidLastUrls).toHaveLength(1);
    expect(before.missingRecipes).toHaveLength(1);

    const result = runRepair(db, deviceId, loader);
    expect(result.fixed).toBe(2);
    expect(getServiceInstance(db, service.id)?.last_url).toBeNull();
    expect(getServiceInstance(db, service.id)?.disabled).toBe(true);
  });
});
