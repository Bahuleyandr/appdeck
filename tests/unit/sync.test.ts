import { describe, expect, it } from 'vitest';
import { createServiceInstance } from '../../src/main/db/repositories/serviceInstances.js';
import { listWorkspaces } from '../../src/main/db/repositories/workspaces.js';
import { mergeVaultPlaintext } from '../../src/main/sync/merge.js';
import { buildVaultPlaintext, vaultContentHash } from '../../src/main/sync/vault.js';
import { createTestDb } from './helpers.js';

function firstWorkspaceId(db: ReturnType<typeof createTestDb>['db']): string {
  const workspace = listWorkspaces(db)[0];
  if (!workspace) throw new Error('Expected default workspace');
  return workspace.id;
}

describe('sync convergence', () => {
  it('two devices reach an identical vault content hash after exchanging changes', () => {
    const a = createTestDb();
    const b = createTestDb();
    createServiceInstance(a.db, a.deviceId, { recipeId: 'gmail', workspaceId: firstWorkspaceId(a.db), displayName: 'A Mail' });
    createServiceInstance(b.db, b.deviceId, { recipeId: 'slack', workspaceId: firstWorkspaceId(b.db), displayName: 'B Slack' });

    mergeVaultPlaintext(b.db, buildVaultPlaintext(a.db));
    mergeVaultPlaintext(a.db, buildVaultPlaintext(b.db));
    mergeVaultPlaintext(b.db, buildVaultPlaintext(a.db));

    expect(vaultContentHash(buildVaultPlaintext(a.db))).toBe(vaultContentHash(buildVaultPlaintext(b.db)));
  });

  it('re-merging an identical vault applies nothing (loop guard)', () => {
    const a = createTestDb();
    const result = mergeVaultPlaintext(a.db, buildVaultPlaintext(a.db));
    expect(result.applied).toBe(0);
  });
});
