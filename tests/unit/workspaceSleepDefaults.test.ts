import { describe, expect, it } from 'vitest';
import {
  createServiceInstance,
  getServiceInstance
} from '../../src/main/db/repositories/serviceInstances.js';
import {
  createWorkspace,
  listWorkspaces,
  updateWorkspace
} from '../../src/main/db/repositories/workspaces.js';
import { createTestDb } from './helpers.js';

describe('workspace sleep defaults', () => {
  it('applies the workspace default to services created in it', () => {
    const { db, deviceId } = createTestDb();
    const workspace = createWorkspace(db, deviceId, { name: 'Focused' });
    updateWorkspace(db, deviceId, workspace.id, { sleep_defaults: { idleMinutes: 5 } });

    const service = createServiceInstance(db, deviceId, {
      recipeId: 'whatsapp',
      workspaceId: workspace.id,
      displayName: 'Inherits'
    });

    expect(service.sleep_policy.idleMinutes).toBe(5);
    expect(getServiceInstance(db, service.id)?.sleep_policy.idleMinutes).toBe(5);
  });

  it('carries a never-sleep workspace default through to new services', () => {
    const { db, deviceId } = createTestDb();
    const workspace = createWorkspace(db, deviceId, { name: 'Always On' });
    updateWorkspace(db, deviceId, workspace.id, { sleep_defaults: { idleMinutes: null } });

    const service = createServiceInstance(db, deviceId, {
      recipeId: 'whatsapp',
      workspaceId: workspace.id,
      displayName: 'Never sleeps'
    });

    // Explicit null must survive as null (never sleep), not collapse to the 30-minute default.
    expect(service.sleep_policy.idleMinutes).toBe(null);
  });

  it('leaves the policy empty when the workspace has no default', () => {
    const { db, deviceId } = createTestDb();
    const workspace = createWorkspace(db, deviceId, { name: 'Plain' });
    updateWorkspace(db, deviceId, workspace.id, { sleep_defaults: {} });

    const service = createServiceInstance(db, deviceId, {
      recipeId: 'whatsapp',
      workspaceId: workspace.id,
      displayName: 'Default policy'
    });

    expect(service.sleep_policy.idleMinutes).toBeUndefined();
  });

  it('does not inherit from an unrelated workspace', () => {
    const { db, deviceId } = createTestDb();
    const home = listWorkspaces(db)[0];
    if (!home) throw new Error('Expected default workspace');
    const other = createWorkspace(db, deviceId, { name: 'Other' });
    updateWorkspace(db, deviceId, other.id, { sleep_defaults: { idleMinutes: 2 } });

    const service = createServiceInstance(db, deviceId, {
      recipeId: 'whatsapp',
      workspaceId: home.id,
      displayName: 'Home service'
    });

    expect(service.sleep_policy.idleMinutes).not.toBe(2);
  });
});
