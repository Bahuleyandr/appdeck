import { safeStorage } from 'electron';
import type Database from 'better-sqlite3';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { watch, type FSWatcher } from 'chokidar';
import type { SyncResult } from '../../shared/types.js';
import { getMeta, setMeta } from '../db/repositories/meta.js';
import { generateRootKey, recoveryPhraseToRootKey, rootKeyToRecoveryPhrase, unwrapRootKey, wrapRootKey, type WrappedRootKey } from './crypto.js';
import { mergeVaultPlaintext } from './merge.js';
import { localVaultHash, readVaultFile, vaultContentHash, vaultPathForFolder, writeVaultFile } from './vault.js';

const SELF_WRITE_SUPPRESS_MS = 2000;
const WATCH_DEBOUNCE_MS = 500;
const LOCAL_CHANGE_DEBOUNCE_MS = 1500;

export class FileSyncService {
  private watcher: FSWatcher | null = null;
  private rootKey: Uint8Array | null = null;
  private watchDebounce: NodeJS.Timeout | null = null;
  private localDebounce: NodeJS.Timeout | null = null;
  /** Content hash (plaintext, not ciphertext) of the vault state we last wrote or converged on. */
  private lastContentHash: string | null = null;
  /** Ignore watcher events until this time — they are echoes of our own write. */
  private suppressWatcherUntil = 0;

  constructor(private readonly db: Database.Database) {}

  /** Resume watching on startup if sync is configured and the key is recoverable without a passphrase. */
  init(): void {
    const folder = getMeta(this.db, 'sync_folder');
    if (!folder) {
      return;
    }
    try {
      const safe = getMeta(this.db, 'sync_root_safe');
      if (safe && safeStorage.isEncryptionAvailable()) {
        this.rootKey = Uint8Array.from(Buffer.from(safeStorage.decryptString(Buffer.from(safe, 'base64')), 'base64'));
        this.watch(folder);
      }
    } catch {
      // No usable key yet — stays dormant until the user enters a passphrase.
    }
  }

  status(): { configured: boolean; folderPath?: string; lastSyncAt?: number; pendingConflicts: number } {
    const folderPath = getMeta(this.db, 'sync_folder') ?? undefined;
    const lastSyncAtRaw = getMeta(this.db, 'sync_last_at');
    return {
      configured: Boolean(folderPath),
      folderPath,
      lastSyncAt: lastSyncAtRaw ? Number(lastSyncAtRaw) : undefined,
      pendingConflicts: 0
    };
  }

  async configure(folderPath: string, passphrase: string): Promise<{ recoveryPhrase: string }> {
    await mkdir(folderPath, { recursive: true });
    const rootKey = await generateRootKey();
    const wrapped = await wrapRootKey(rootKey, passphrase);
    this.storeRootKey(rootKey, wrapped, folderPath);
    await this.writeVault(vaultPathForFolder(folderPath), rootKey);
    this.watch(folderPath);
    return { recoveryPhrase: rootKeyToRecoveryPhrase(rootKey) };
  }

  async join(folderPath: string, recoveryPhrase: string, passphrase: string): Promise<{ ok: true }> {
    await mkdir(folderPath, { recursive: true });
    const rootKey = recoveryPhraseToRootKey(recoveryPhrase);
    const wrapped = await wrapRootKey(rootKey, passphrase);
    this.storeRootKey(rootKey, wrapped, folderPath);
    const target = vaultPathForFolder(folderPath);
    if (existsSync(target)) {
      mergeVaultPlaintext(this.db, await readVaultFile(target, rootKey));
    }
    await this.writeVault(target, rootKey);
    this.watch(folderPath);
    return { ok: true };
  }

  async exportVault(targetPath: string, passphrase: string): Promise<void> {
    // Manual export to an arbitrary path — does not touch the live sync state.
    await writeVaultFile(this.db, await this.requireRootKey(passphrase), targetPath);
  }

  async importVault(sourcePath: string, passphrase: string): Promise<SyncResult> {
    const plaintext = await readVaultFile(sourcePath, await this.requireRootKey(passphrase));
    const result = mergeVaultPlaintext(this.db, plaintext);
    setMeta(this.db, 'sync_last_at', String(Date.now()));
    return result;
  }

  async syncNow(): Promise<SyncResult> {
    const folder = getMeta(this.db, 'sync_folder');
    if (!folder) {
      return { applied: 0, conflicts: 0 };
    }
    const rootKey = await this.requireRootKey();
    const target = vaultPathForFolder(folder);
    let result: SyncResult = { applied: 0, conflicts: 0 };

    if (existsSync(target)) {
      const remote = await readVaultFile(target, rootKey);
      const remoteHash = vaultContentHash(remote);
      if (remoteHash === localVaultHash(this.db)) {
        // Already converged — nothing to merge, nothing to write. Breaks the echo loop.
        this.lastContentHash = remoteHash;
        setMeta(this.db, 'sync_last_at', String(Date.now()));
        return result;
      }
      result = mergeVaultPlaintext(this.db, remote);
      if (localVaultHash(this.db) === remoteHash) {
        // Merge produced exactly the remote state (remote was strictly newer) — don't write back.
        this.lastContentHash = remoteHash;
        setMeta(this.db, 'sync_last_at', String(Date.now()));
        return result;
      }
    }

    await this.writeVault(target, rootKey);
    setMeta(this.db, 'sync_last_at', String(Date.now()));
    return result;
  }

  /** Debounced push triggered by local data changes. */
  scheduleSync(): void {
    if (!getMeta(this.db, 'sync_folder')) {
      return;
    }
    if (this.localDebounce) {
      clearTimeout(this.localDebounce);
    }
    this.localDebounce = setTimeout(() => {
      void this.syncNow().catch(() => undefined);
    }, LOCAL_CHANGE_DEBOUNCE_MS);
    this.localDebounce.unref();
  }

  watch(folderPath: string): void {
    void this.watcher?.close();
    const target = vaultPathForFolder(folderPath);
    this.watcher = watch(target, { ignoreInitial: true });
    this.watcher.on('change', () => {
      if (Date.now() < this.suppressWatcherUntil) {
        return; // Echo of our own write.
      }
      if (this.watchDebounce) {
        clearTimeout(this.watchDebounce);
      }
      this.watchDebounce = setTimeout(() => {
        void this.syncNow().catch(() => undefined);
      }, WATCH_DEBOUNCE_MS);
      this.watchDebounce.unref();
    });
  }

  dispose(): void {
    if (this.watchDebounce) {
      clearTimeout(this.watchDebounce);
    }
    if (this.localDebounce) {
      clearTimeout(this.localDebounce);
    }
    void this.watcher?.close();
    this.watcher = null;
  }

  private async writeVault(target: string, rootKey: Uint8Array): Promise<void> {
    this.suppressWatcherUntil = Date.now() + SELF_WRITE_SUPPRESS_MS;
    await writeVaultFile(this.db, rootKey, target);
    this.lastContentHash = localVaultHash(this.db);
  }

  private storeRootKey(rootKey: Uint8Array, wrapped: WrappedRootKey, folderPath: string): void {
    this.rootKey = rootKey;
    setMeta(this.db, 'sync_folder', folderPath);
    setMeta(this.db, 'sync_wrapped_key', JSON.stringify(wrapped));
    if (safeStorage.isEncryptionAvailable()) {
      setMeta(this.db, 'sync_root_safe', safeStorage.encryptString(Buffer.from(rootKey).toString('base64')).toString('base64'));
    }
  }

  private async requireRootKey(passphrase?: string): Promise<Uint8Array> {
    if (this.rootKey) {
      return this.rootKey;
    }
    const safe = getMeta(this.db, 'sync_root_safe');
    if (safe && safeStorage.isEncryptionAvailable()) {
      const decrypted = safeStorage.decryptString(Buffer.from(safe, 'base64'));
      this.rootKey = Uint8Array.from(Buffer.from(decrypted, 'base64'));
      return this.rootKey;
    }
    if (!passphrase) {
      throw new Error('Sync passphrase required');
    }
    const wrappedRaw = getMeta(this.db, 'sync_wrapped_key');
    if (!wrappedRaw) {
      throw new Error('Sync is not configured');
    }
    this.rootKey = await unwrapRootKey(JSON.parse(wrappedRaw) as WrappedRootKey, passphrase);
    return this.rootKey;
  }
}
