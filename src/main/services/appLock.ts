import { safeStorage } from 'electron';
import type Database from 'better-sqlite3';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { getMeta, setMeta } from '../db/repositories/meta.js';
import { deriveKek } from '../sync/crypto.js';

export class AppLockService {
  private locked = false;
  private idleTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly db: Database.Database,
    private readonly onLocked: () => void,
    private idleTimeoutMs = 10 * 60_000
  ) {}

  status(): { locked: boolean; configured: boolean } {
    return { locked: this.locked, configured: Boolean(getMeta(this.db, 'app_lock_hash')) };
  }

  async setup(passphrase: string): Promise<void> {
    const salt = randomBytes(16);
    const hash = await deriveKek(passphrase, salt);
    setMeta(this.db, 'app_lock_salt', Buffer.from(salt).toString('base64'));
    setMeta(this.db, 'app_lock_hash', Buffer.from(hash).toString('base64'));
    if (safeStorage.isEncryptionAvailable()) {
      setMeta(
        this.db,
        'app_lock_safe_storage_probe',
        safeStorage.encryptString('configured').toString('base64')
      );
    }
    this.locked = false;
    this.bumpIdleTimer();
  }

  async unlock(passphrase: string): Promise<{ ok: boolean }> {
    const saltB64 = getMeta(this.db, 'app_lock_salt');
    const expectedB64 = getMeta(this.db, 'app_lock_hash');
    if (!saltB64 || !expectedB64) {
      this.locked = false;
      return { ok: true };
    }
    const actual = await deriveKek(passphrase, Uint8Array.from(Buffer.from(saltB64, 'base64')));
    const ok = safeEqual(Buffer.from(actual), Buffer.from(expectedB64, 'base64'));
    if (ok) {
      this.locked = false;
      this.bumpIdleTimer();
    }
    return { ok };
  }

  lock(): void {
    if (!this.status().configured) {
      return;
    }
    this.locked = true;
    this.onLocked();
  }

  setIdleTimeoutMinutes(value: string | number | null | undefined): void {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    this.idleTimeoutMs = Number.isFinite(parsed) && parsed > 0 ? parsed * 60_000 : 10 * 60_000;
    this.bumpIdleTimer();
  }

  bumpIdleTimer(): void {
    if (!this.status().configured || this.locked) {
      return;
    }
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
    }
    this.idleTimer = setTimeout(() => this.lock(), this.idleTimeoutMs);
    this.idleTimer.unref();
  }
}

function safeEqual(a: Buffer, b: Buffer): boolean {
  return a.length === b.length && timingSafeEqual(a, b);
}
