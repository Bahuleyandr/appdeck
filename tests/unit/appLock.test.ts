import { describe, expect, it, vi } from 'vitest';

// AppLockService imports `safeStorage` from electron, which is unavailable outside the Electron
// runtime. The probe is optional, so stub it as unavailable.
vi.mock('electron', () => ({ safeStorage: { isEncryptionAvailable: () => false } }));

const { AppLockService } = await import('../../src/main/services/appLock.js');
const { createTestDb } = await import('./helpers.js');

describe('app lock (Argon2id)', () => {
  it('accepts the correct passphrase and rejects a wrong one', async () => {
    const { db } = createTestDb();
    const lock = new AppLockService(db, () => undefined);

    expect(lock.status().configured).toBe(false);
    await lock.setup('correct horse battery');
    expect(lock.status().configured).toBe(true);

    expect((await lock.unlock('correct horse battery')).ok).toBe(true);
    expect((await lock.unlock('wrong')).ok).toBe(false);
  });
});
