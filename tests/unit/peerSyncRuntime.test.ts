import { createCipheriv, randomBytes, scryptSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  createServiceInstance,
  listServiceInstances
} from '../../src/main/db/repositories/serviceInstances.js';
import { listWorkspaces } from '../../src/main/db/repositories/workspaces.js';
import {
  exportEncryptedPeerVault,
  importEncryptedPeerVault,
  PeerSyncRuntime,
  type PeerVaultEnvelope
} from '../../src/main/services/peerSyncRuntime.js';
import { createTestDb } from './helpers.js';

// Encrypt an arbitrary payload with the peer envelope scheme, so tests can feed the importer
// well-encrypted but structurally invalid plaintext.
function makeEnvelope(payload: unknown, secret: string): PeerVaultEnvelope {
  const salt = randomBytes(16);
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', scryptSync(secret, salt, 32), nonce);
  const ciphertext = Buffer.concat([
    cipher.update(Buffer.from(JSON.stringify(payload), 'utf8')),
    cipher.final()
  ]);
  return {
    version: 1,
    kdf: 'scrypt',
    salt: salt.toString('base64'),
    nonce: nonce.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    ciphertext: ciphertext.toString('base64'),
    createdAt: Date.now()
  };
}

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

  it('rejects peer payloads that fail vault schema validation', () => {
    const { db } = createTestDb();

    // Structurally incomplete record (used to pass the old shallow shape check).
    const incomplete = { schemaVersion: 1, records: [{ type: 'workspace', id: 'w1' }] };
    expect(() => importEncryptedPeerVault(db, makeEnvelope(incomplete, 'secret'), 'secret')).toThrow();

    // Unknown record type.
    const unknownType = {
      schemaVersion: 1,
      records: [
        {
          type: 'evil',
          id: 'x',
          rev: 1,
          updatedAt: 1,
          deletedAt: null,
          originDevice: 'device',
          data: {}
        }
      ]
    };
    expect(() =>
      importEncryptedPeerVault(db, makeEnvelope(unknownType, 'secret'), 'secret')
    ).toThrow();
  });

  it('requires the shared secret as a bearer token before serving the vault', async () => {
    const { db } = createTestDb();
    const runtime = new PeerSyncRuntime(db);
    await runtime.startServer('127.0.0.1', 0);
    try {
      const endpoint = runtime.localEndpoint();
      if (!endpoint) throw new Error('expected a local endpoint');
      const parsed = new URL(endpoint);
      const secret = decodeURIComponent(parsed.hash.replace(/^#/, ''));
      const base = `http://127.0.0.1:${parsed.port}/api/peer/vault`;

      expect((await fetch(base)).status).toBe(401);
      expect((await fetch(base, { headers: { authorization: 'Bearer wrong' } })).status).toBe(401);

      const ok = await fetch(base, { headers: { authorization: `Bearer ${secret}` } });
      expect(ok.status).toBe(200);
      const body = (await ok.json()) as { kdf: string; ciphertext: string };
      expect(body.kdf).toBe('scrypt');
      expect(typeof body.ciphertext).toBe('string');
    } finally {
      runtime.dispose();
    }
  });
});
