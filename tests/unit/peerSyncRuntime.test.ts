import { describe, expect, it } from 'vitest';
import {
  createServiceInstance,
  listServiceInstances
} from '../../src/main/db/repositories/serviceInstances.js';
import { listWorkspaces } from '../../src/main/db/repositories/workspaces.js';
import {
  exportEncryptedPeerVault,
  importEncryptedPeerVault
} from '../../src/main/services/peerSyncRuntime.js';
import { createTestDb } from './helpers.js';

describe('encrypted peer sync runtime', () => {
  it('exports and imports encrypted vault payloads between devices', () => {
    const a = createTestDb();
    const b = createTestDb();
    const workspace = listWorkspaces(a.db)[0];
    if (!workspace) throw new Error('Expected workspace');
    createServiceInstance(a.db, a.deviceId, {
      recipeId: 'github',
      workspaceId: workspace.id,
      displayName: 'GitHub'
    });

    const envelope = exportEncryptedPeerVault(a.db, 'shared LAN secret');
    expect(JSON.stringify(envelope)).not.toContain('GitHub');
    expect(() => importEncryptedPeerVault(b.db, envelope, 'wrong secret')).toThrow();

    const result = importEncryptedPeerVault(b.db, envelope, 'shared LAN secret');
    expect(result.applied).toBeGreaterThan(0);
    expect(
      listServiceInstances(b.db, undefined, true).some(
        (service) => service.display_name === 'GitHub'
      )
    ).toBe(true);
  });
});
