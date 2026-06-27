import { describe, expect, it } from 'vitest';
import {
  createServiceInstance,
  setServiceLastUrl,
  updateServiceInstance
} from '../../src/main/db/repositories/serviceInstances.js';
import { generateRootKey } from '../../src/main/sync/crypto.js';
import {
  assertVaultHasNoDeniedKeys,
  buildVaultPlaintext,
  decryptVault,
  encryptVault
} from '../../src/main/sync/vault.js';
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
    setServiceLastUrl(db, service.id, 'https://mail.google.com/mail/u/0/#inbox');

    const plaintext = buildVaultPlaintext(db);
    expect(() => assertVaultHasNoDeniedKeys(plaintext)).not.toThrow();
    const serialized = JSON.stringify(plaintext);
    expect(serialized).toContain('partition_key');
    expect(serialized).not.toContain('last_url');
  });

  it('does not false-positive on legitimate values containing denied words', () => {
    const { db, deviceId } = createTestDb();
    const workspace = (db.prepare('SELECT id FROM workspaces LIMIT 1').get() as { id: string }).id;
    const service = createServiceInstance(db, deviceId, {
      recipeId: 'gmail',
      workspaceId: workspace,
      displayName: 'Gmail'
    });
    // A display name containing "token"/"cookie" is data, not a secret key — must not throw.
    updateServiceInstance(db, deviceId, service.id, { display_name: 'Token & Cookie Tracker' });

    expect(() => assertVaultHasNoDeniedKeys(buildVaultPlaintext(db))).not.toThrow();
  });

  it('syncs safe pro metadata but keeps local-only records out of the vault', () => {
    const { db, deviceId } = createTestDb();
    const workspace = (db.prepare('SELECT id FROM workspaces LIMIT 1').get() as { id: string }).id;
    const service = createServiceInstance(db, deviceId, {
      recipeId: 'github',
      workspaceId: workspace,
      displayName: 'GitHub'
    });
    updateServiceInstance(db, deviceId, service.id, {
      disabled: true,
      proxy: { mode: 'socks5', host: 'localhost', port: 9050 },
      zoom_factor: 1.15,
      spellcheck: false
    });
    db.prepare(
      `INSERT INTO permission_policies
        (id, service_instance_id, permission, decision, updated_at)
       VALUES ('policy-1', ?, 'camera', 'deny', ?)`
    ).run(service.id, Date.now());
    db.prepare(
      `INSERT INTO downloads
        (id, service_instance_id, url, filename, mime_type, total_bytes, received_bytes, state, path, started_at, completed_at)
       VALUES ('download-1', ?, 'https://example.com/a.zip', 'a.zip', NULL, NULL, 0, 'completed', 'C:\\tmp\\a.zip', ?, ?)`
    ).run(service.id, Date.now(), Date.now());

    const serialized = JSON.stringify(buildVaultPlaintext(db));
    expect(serialized).toContain('"zoom_factor":1.15');
    expect(serialized).toContain('"spellcheck":false');
    expect(serialized).toContain('"disabled":true');
    expect(serialized).not.toContain('permission_policies');
    expect(serialized).not.toContain('download-1');
  });

  it('round-trips through encryption with the v2 header', async () => {
    const { db } = createTestDb();
    const rootKey = await generateRootKey();
    const bytes = await encryptVault(db, rootKey);
    const restored = await decryptVault(bytes, rootKey);
    expect(restored.records.length).toBe(buildVaultPlaintext(db).records.length);
  });
});
