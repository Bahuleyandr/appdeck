import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: () => false,
    encryptString: vi.fn(),
    decryptString: vi.fn()
  }
}));

import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServiceInstance } from '../../src/main/db/repositories/serviceInstances.js';
import { getMeta, setMeta } from '../../src/main/db/repositories/meta.js';
import { listWorkspaces } from '../../src/main/db/repositories/workspaces.js';
import { generateRootKey } from '../../src/main/sync/crypto.js';
import { CloudSyncService } from '../../src/main/sync/cloudSync.js';
import { FileSyncService } from '../../src/main/sync/fileSync.js';
import { createTestDb } from './helpers.js';

function plainProtect(value: string): string {
  return `plain:${Buffer.from(value).toString('base64')}`;
}

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body)
  } as Response;
}

async function cloudService(): Promise<{
  context: ReturnType<typeof createTestDb>;
  service: CloudSyncService;
}> {
  const context = createTestDb();
  const rootKey = await generateRootKey();
  setMeta(context.db, 'cloud_url', 'https://sync.test');
  setMeta(context.db, 'cloud_email', 'a@example.com');
  setMeta(context.db, 'cloud_token_safe', plainProtect('token-1'));
  setMeta(context.db, 'cloud_root_safe', plainProtect(Buffer.from(rootKey).toString('base64')));
  return { context, service: new CloudSyncService(context.db) };
}

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe('cloud sync robustness', () => {
  it('does not push a new revision when nothing changed since the last sync', async () => {
    const { context, service } = await cloudService();
    const workspace = listWorkspaces(context.db)[0];
    if (!workspace) throw new Error('Expected default workspace');
    createServiceInstance(context.db, context.deviceId, {
      recipeId: 'whatsapp',
      workspaceId: workspace.id,
      displayName: 'Cloudy'
    });

    let stored: { ciphertext: string | null; revision: number } = {
      ciphertext: null,
      revision: 0
    };
    const putCalls: number[] = [];
    globalThis.fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/api/vault') && (!init || !init.method || init.method === 'GET')) {
        return Promise.resolve(jsonResponse(stored));
      }
      if (url.endsWith('/api/vault') && init?.method === 'PUT') {
        const body = JSON.parse(String(init.body)) as { ciphertext: string; revision: number };
        stored = { ciphertext: body.ciphertext, revision: body.revision };
        putCalls.push(body.revision);
        return Promise.resolve(jsonResponse({ revision: body.revision }));
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    await service.syncNow();
    expect(putCalls).toEqual([1]);

    // Nothing changed locally; the remote already matches. No revision churn allowed.
    await service.syncNow();
    expect(putCalls).toEqual([1]);
    expect(getMeta(context.db, 'cloud_revision')).toBe('1');
  });

  it('coalesces concurrent syncNow calls into one flight', async () => {
    const { service } = await cloudService();
    let release: (value: Response) => void = () => {};
    globalThis.fetch = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          release = resolve;
        })
    );

    const first = service.syncNow();
    const second = service.syncNow();
    expect(second).toBe(first);

    release(jsonResponse({ ciphertext: null, revision: 0 }));
    // Subsequent fetches (the PUT) resolve immediately once the shared flight continues.
    globalThis.fetch = vi.fn(() => Promise.resolve(jsonResponse({ revision: 1 })));
    await first;
  });

  it('records the last sync error in status and clears it on success', async () => {
    const { service } = await cloudService();
    globalThis.fetch = vi.fn(() => Promise.reject(new Error('offline')));

    await expect(service.syncNow()).rejects.toThrow('offline');
    expect(service.status().lastError).toContain('offline');

    globalThis.fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === 'PUT') {
        return Promise.resolve(jsonResponse({ revision: 1 }));
      }
      if (url.endsWith('/api/vault')) {
        return Promise.resolve(jsonResponse({ ciphertext: null, revision: 0 }));
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    await service.syncNow();
    expect(service.status().lastError).toBeUndefined();
    expect(service.status().lastSyncAt).toBeTypeOf('number');
  });
});

describe('file sync robustness', () => {
  it('coalesces concurrent syncNow calls into one flight', async () => {
    const context = createTestDb();
    const folder = mkdtempSync(join(tmpdir(), 'appdeck-sync-'));
    const service = new FileSyncService(context.db);
    await service.configure(folder, 'passphrase-1');

    const first = service.syncNow();
    const second = service.syncNow();
    expect(second).toBe(first);
    await first;
    service.dispose();
  });

  it('surfaces sync failures in status and clears them after a good sync', async () => {
    const context = createTestDb();
    const folder = mkdtempSync(join(tmpdir(), 'appdeck-sync-'));
    const service = new FileSyncService(context.db);
    await service.configure(folder, 'passphrase-1');

    // Point the sync folder at an unusable path: the vault write must fail.
    setMeta(context.db, 'sync_folder', join(folder, 'missing-subdir', 'deeper'));
    await expect(service.syncNow()).rejects.toThrow();
    expect(service.status().lastError).toBeTruthy();

    setMeta(context.db, 'sync_folder', folder);
    await service.syncNow();
    expect(service.status().lastError).toBeUndefined();
    service.dispose();
  });
});
