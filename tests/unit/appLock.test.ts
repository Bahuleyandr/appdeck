import { describe, expect, it, vi } from 'vitest';

// AppLockService imports `safeStorage` from electron, which is unavailable outside the Electron
// runtime. The probe is optional, so stub it as unavailable.
vi.mock('electron', () => ({ safeStorage: { isEncryptionAvailable: () => false } }));

const { AppLockService } = await import('../../src/main/services/appLock.js');
const { createTestDb } = await import('./helpers.js');
const { sodiumReady, deriveKek } = await import('../../src/main/sync/crypto.js');
const { getMeta, setMeta } = await import('../../src/main/db/repositories/meta.js');

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

  it('persists the KDF cost params so a default change cannot lock the user out', async () => {
    const sodium = await sodiumReady();
    const { db } = createTestDb();
    await new AppLockService(db, () => undefined).setup('passphrase-1234');

    expect(getMeta(db, 'app_lock_opslimit')).toBe(String(sodium.crypto_pwhash_OPSLIMIT_MODERATE));
    expect(getMeta(db, 'app_lock_memlimit')).toBe(String(sodium.crypto_pwhash_MEMLIMIT_MODERATE));
  });

  it('still unlocks a legacy lock stored without KDF params', async () => {
    const sodium = await sodiumReady();
    const { db } = createTestDb();
    // Pre-params locks were derived with deriveKek's old defaults: MODERATE ops + INTERACTIVE mem.
    const salt = Buffer.from(sodium.randombytes_buf(16));
    const hash = await deriveKek(
      'legacy-pass',
      Uint8Array.from(salt),
      sodium.crypto_pwhash_OPSLIMIT_MODERATE,
      sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE
    );
    setMeta(db, 'app_lock_salt', salt.toString('base64'));
    setMeta(db, 'app_lock_hash', Buffer.from(hash).toString('base64'));

    const lock = new AppLockService(db, () => undefined);
    expect((await lock.unlock('legacy-pass')).ok).toBe(true);
    expect((await lock.unlock('nope')).ok).toBe(false);
  });
});
