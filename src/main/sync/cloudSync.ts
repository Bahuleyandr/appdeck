import { safeStorage } from 'electron';
import type Database from 'better-sqlite3';
import type { SyncResult } from '../../shared/types.js';
import { getMeta, setMeta } from '../db/repositories/meta.js';
import { deriveAuthHash, generateRootKey, newAuthSalt, unwrapRootKey, wrapRootKey, type WrappedRootKey } from './crypto.js';
import { mergeVaultPlaintext } from './merge.js';
import { decryptVault, encryptVault } from './vault.js';

const CLOUD_DEBOUNCE_MS = 2000;

interface AuthParams {
  authSalt: string;
  wrappedKey: string;
}

/**
 * Optional account-based E2EE cloud sync (alongside file sync). The server stores only ciphertext +
 * an auth hash + a passphrase-wrapped key — it cannot decrypt anything. See server/README.md.
 */
export class CloudSyncService {
  private rootKey: Uint8Array | null = null;
  private token: string | null = null;
  private debounce: NodeJS.Timeout | null = null;

  constructor(private readonly db: Database.Database) {}

  status(): { configured: boolean; email?: string } {
    const email = getMeta(this.db, 'cloud_email') ?? undefined;
    return { configured: Boolean(getMeta(this.db, 'cloud_url') && getMeta(this.db, 'cloud_token_safe')), email };
  }

  async signup(serverUrl: string, email: string, password: string): Promise<void> {
    const url = normalizeUrl(serverUrl);
    const rootKey = await generateRootKey();
    const authSalt = await newAuthSalt();
    const authHash = await deriveAuthHash(password, authSalt);
    const wrappedKey = JSON.stringify(await wrapRootKey(rootKey, password));
    const res = await fetch(`${url}/api/signup`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, authSalt, authHash, wrappedKey })
    });
    if (res.status === 409) throw new Error('That email is already registered.');
    if (!res.ok) throw new Error(`Signup failed (${res.status})`);
    const { token } = (await res.json()) as { token: string };
    this.persistSession(url, email, token, rootKey);
    await this.syncNow();
  }

  async login(serverUrl: string, email: string, password: string): Promise<void> {
    const url = normalizeUrl(serverUrl);
    const paramsRes = await fetch(`${url}/api/auth-params?email=${encodeURIComponent(email)}`);
    if (paramsRes.status === 404) throw new Error('No account for that email.');
    if (!paramsRes.ok) throw new Error(`Login failed (${paramsRes.status})`);
    const params = (await paramsRes.json()) as AuthParams;
    const authHash = await deriveAuthHash(password, params.authSalt);
    const loginRes = await fetch(`${url}/api/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, authHash })
    });
    if (loginRes.status === 401) throw new Error('Wrong email or password.');
    if (!loginRes.ok) throw new Error(`Login failed (${loginRes.status})`);
    const { token } = (await loginRes.json()) as { token: string };
    const rootKey = await unwrapRootKey(JSON.parse(params.wrappedKey) as WrappedRootKey, password);
    this.persistSession(url, email, token, rootKey);
    await this.syncNow();
  }

  logout(): void {
    this.rootKey = null;
    this.token = null;
    setMeta(this.db, 'cloud_token_safe', '');
    setMeta(this.db, 'cloud_root_safe', '');
  }

  async syncNow(): Promise<SyncResult> {
    const url = getMeta(this.db, 'cloud_url');
    const token = this.requireToken();
    const rootKey = this.requireRootKey();
    if (!url || !token || !rootKey) {
      return { applied: 0, conflicts: 0 };
    }
    const remote = await this.fetchVault(url, token);
    let result: SyncResult = { applied: 0, conflicts: 0 };
    let baseRevision = Math.max(remote.revision, Number(getMeta(this.db, 'cloud_revision') ?? 0));
    if (remote.ciphertext) {
      result = mergeVaultPlaintext(this.db, await decryptVault(Buffer.from(remote.ciphertext, 'base64'), rootKey));
    }
    const ciphertext = (await encryptVault(this.db, rootKey)).toString('base64');
    let put = await this.putVault(url, token, ciphertext, baseRevision + 1);
    if (put.status === 409) {
      // Someone else pushed; pull+merge+retry once.
      const latest = await this.fetchVault(url, token);
      if (latest.ciphertext) {
        mergeVaultPlaintext(this.db, await decryptVault(Buffer.from(latest.ciphertext, 'base64'), rootKey));
      }
      baseRevision = latest.revision;
      const merged = (await encryptVault(this.db, rootKey)).toString('base64');
      put = await this.putVault(url, token, merged, baseRevision + 1);
    }
    if (put.status === 401) {
      throw new Error('Session expired — log in again.');
    }
    if (put.revision) {
      setMeta(this.db, 'cloud_revision', String(put.revision));
    }
    return result;
  }

  scheduleSync(): void {
    if (!this.status().configured) {
      return;
    }
    if (this.debounce) clearTimeout(this.debounce);
    this.debounce = setTimeout(() => void this.syncNow().catch(() => undefined), CLOUD_DEBOUNCE_MS);
    this.debounce.unref();
  }

  dispose(): void {
    if (this.debounce) clearTimeout(this.debounce);
  }

  private async fetchVault(url: string, token: string): Promise<{ ciphertext: string | null; revision: number }> {
    const res = await fetch(`${url}/api/vault`, { headers: { authorization: `Bearer ${token}` } });
    if (res.status === 401) throw new Error('Session expired — log in again.');
    if (!res.ok) throw new Error(`Sync failed (${res.status})`);
    return (await res.json()) as { ciphertext: string | null; revision: number };
  }

  private async putVault(url: string, token: string, ciphertext: string, revision: number): Promise<{ status: number; revision?: number }> {
    const res = await fetch(`${url}/api/vault`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ ciphertext, revision })
    });
    const body = (await res.json().catch(() => ({}))) as { revision?: number };
    return { status: res.status, revision: body.revision };
  }

  private persistSession(url: string, email: string, token: string, rootKey: Uint8Array): void {
    this.token = token;
    this.rootKey = rootKey;
    setMeta(this.db, 'cloud_url', url);
    setMeta(this.db, 'cloud_email', email);
    setMeta(this.db, 'cloud_token_safe', protect(token));
    setMeta(this.db, 'cloud_root_safe', protect(Buffer.from(rootKey).toString('base64')));
  }

  private requireToken(): string | null {
    if (this.token) return this.token;
    this.token = unprotect(getMeta(this.db, 'cloud_token_safe'));
    return this.token;
  }

  private requireRootKey(): Uint8Array | null {
    if (this.rootKey) return this.rootKey;
    const raw = unprotect(getMeta(this.db, 'cloud_root_safe'));
    this.rootKey = raw ? Uint8Array.from(Buffer.from(raw, 'base64')) : null;
    return this.rootKey;
  }
}

function normalizeUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

function protect(value: string): string {
  if (safeStorage.isEncryptionAvailable()) {
    return `safe:${safeStorage.encryptString(value).toString('base64')}`;
  }
  return `plain:${Buffer.from(value).toString('base64')}`;
}

function unprotect(stored: string | null): string | null {
  if (!stored) return null;
  if (stored.startsWith('safe:')) {
    return safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(Buffer.from(stored.slice(5), 'base64')) : null;
  }
  if (stored.startsWith('plain:')) {
    return Buffer.from(stored.slice(6), 'base64').toString('utf8');
  }
  return null;
}
