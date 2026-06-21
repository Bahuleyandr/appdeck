import { describe, expect, it } from 'vitest';
import { createServiceInstance, setServiceLastUrl, updateServiceInstance } from '../../src/main/db/repositories/serviceInstances.js';
import { generateRootKey } from '../../src/main/sync/crypto.js';
import { assertVaultHasNoDeniedKeys, buildVaultPlaintext, decryptVault, encryptVault } from '../../src/main/sync/vault.js';
import { createTestDb } from './helpers.js';

describe('vault allowlist', () => {
  it('excludes browser/session data and local-only last_url fields', () => {
    const { db, deviceId } = createTestDb();
    const workspace = (db.prepare('SELECT id FROM workspaces LIMIT 1').get() as { id: string }).id;
    const service = createServiceInstance(db, deviceId, {
      recipeId: 'gmail',
      workspaceId: workspace,
      displayName: 'Gmail',
      color: '#ef4444'
    });
    setServiceLastUrl(db, deviceId, service.id, 'https://mail.google.com/mail/u/0/#inbox');

    const plaintext = buildVaultPlaintext(db);
    expect(() => assertVaultHasNoDeniedKeys(plaintext)).not.toThrow();
    const serialized = JSON.stringify(plaintext);
    expect(serialized).toContain('partition_key');
    expect(serialized).not.toContain('last_url');
  });

  it('does not false-positive on legitimate values containing denied words', () => {
    const { db, deviceId } = createTestDb();
    const workspace = (db.prepare('SELECT id FROM workspaces LIMIT 1').get() as { id: string }).id;
    const service = createServiceInstance(db, deviceId, { recipeId: 'gmail', workspaceId: workspace, displayName: 'Gmail' });
    // A display name containing "token"/"cookie" is data, not a secret key — must not throw.
    updateServiceInstance(db, deviceId, service.id, { display_name: 'Token & Cookie Tracker' });

    expect(() => assertVaultHasNoDeniedKeys(buildVaultPlaintext(db))).not.toThrow();
  });

  it('round-trips through encryption with the v2 header', async () => {
    const { db } = createTestDb();
    const rootKey = await generateRootKey();
    const bytes = await encryptVault(db, rootKey);
    const restored = await decryptVault(bytes, rootKey);
    expect(restored.records.length).toBe(buildVaultPlaintext(db).records.length);
  });
});
