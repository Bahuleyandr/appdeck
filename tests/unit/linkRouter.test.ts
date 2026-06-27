import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createServiceInstance } from '../../src/main/db/repositories/serviceInstances.js';
import { listWorkspaces } from '../../src/main/db/repositories/workspaces.js';
import { RecipeLoader } from '../../src/main/recipes/loader.js';
import { LinkRouter } from '../../src/main/services/linkRouter.js';
import type { ServiceViewManager } from '../../src/main/views/serviceViewManager.js';
import { createTestDb } from './helpers.js';

const electronMock = vi.hoisted(() => ({
  openExternal: vi.fn()
}));

vi.mock('electron', () => ({
  shell: {
    openExternal: electronMock.openExternal
  }
}));

function fakeViewManager() {
  return {
    routeNavigate: vi.fn(),
    wake: vi.fn(),
    navigate: vi.fn(),
    focus: vi.fn()
  };
}

describe('link router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('routes matching service URLs through pending-aware route navigation', () => {
    const { db, deviceId } = createTestDb();
    const workspace = listWorkspaces(db)[0];
    if (!workspace) throw new Error('Expected default workspace');
    const service = createServiceInstance(db, deviceId, {
      recipeId: 'github',
      workspaceId: workspace.id,
      displayName: 'GitHub'
    });
    const viewManager = fakeViewManager();
    const router = new LinkRouter(
      db,
      new RecipeLoader(db),
      viewManager as unknown as ServiceViewManager,
      vi.fn()
    );

    const target = 'https://github.com/Bahuleyandr/appdeck';
    expect(router.route(target)).toBe(true);

    expect(viewManager.routeNavigate).toHaveBeenCalledWith(service.id, target);
    expect(viewManager.focus).toHaveBeenCalledWith(service.id);
    expect(viewManager.navigate).not.toHaveBeenCalled();
  });

  it('opens unmatched URLs externally', () => {
    const { db } = createTestDb();
    const viewManager = fakeViewManager();
    const router = new LinkRouter(
      db,
      new RecipeLoader(db),
      viewManager as unknown as ServiceViewManager,
      vi.fn()
    );
    const target = 'https://example.invalid/path';

    expect(router.route(target)).toBe(false);

    expect(electronMock.openExternal).toHaveBeenCalledWith(target);
    expect(viewManager.routeNavigate).not.toHaveBeenCalled();
  });
});
