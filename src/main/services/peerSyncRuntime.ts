import type Database from 'better-sqlite3';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { hostname } from 'node:os';
import type {
  PeerSyncPeer,
  PeerSyncRunResult,
  SyncResult,
  VaultPlaintext
} from '../../shared/types.js';
import { getMeta, setMeta } from '../db/repositories/meta.js';
import { markPeerSeen } from '../db/repositories/peerSync.js';
import { mergeVaultPlaintext } from '../sync/merge.js';
import { buildVaultPlaintext } from '../sync/vault.js';

export interface PeerVaultEnvelope {
  version: 1;
  kdf: 'scrypt';
  salt: string;
  nonce: string;
  tag: string;
  ciphertext: string;
  createdAt: number;
}

export function exportEncryptedPeerVault(db: Database.Database, secret: string): PeerVaultEnvelope {
  const salt = randomBytes(16);
  const nonce = randomBytes(12);
  const key = derivePeerKey(secret, salt);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  const plaintext = Buffer.from(JSON.stringify(buildVaultPlaintext(db)), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
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

export function importEncryptedPeerVault(
  db: Database.Database,
  envelope: PeerVaultEnvelope,
  secret: string
): SyncResult {
  if (envelope.version !== 1 || envelope.kdf !== 'scrypt') {
    throw new Error('Unsupported peer sync envelope');
  }
  const key = derivePeerKey(secret, Buffer.from(envelope.salt, 'base64'));
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.nonce, 'base64'));
  decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, 'base64')),
    decipher.final()
  ]);
  return mergeVaultPlaintext(db, parsePeerVaultPlaintext(plaintext.toString('utf8')));
}

export class PeerSyncRuntime {
  private server: Server | null = null;
  private localPort: number | null = null;

  constructor(
    private readonly db: Database.Database,
    private readonly fetcher: typeof fetch = fetch
  ) {}

  async startServer(host = '0.0.0.0', port = 0): Promise<void> {
    if (this.server) return;
    this.server = createServer((request, response) => {
      if (request.method !== 'GET' || request.url !== '/api/peer/vault') {
        response.writeHead(404, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ error: 'not_found' }));
        return;
      }
      const envelope = exportEncryptedPeerVault(this.db, ensurePeerSecret(this.db));
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify(envelope));
    });
    await new Promise<void>((resolve, reject) => {
      this.server?.once('error', reject);
      this.server?.listen(port, host, () => resolve());
    });
    const address = this.server.address();
    this.localPort = typeof address === 'object' && address ? address.port : null;
  }

  dispose(): void {
    this.server?.close();
    this.server = null;
    this.localPort = null;
  }

  localEndpoint(): string | null {
    if (!this.localPort) return null;
    return `http://${hostname()}:${this.localPort}#${encodeURIComponent(ensurePeerSecret(this.db))}`;
  }

  async sync(peer: PeerSyncPeer): Promise<PeerSyncRunResult> {
    if (!peer.enabled) {
      return { peerId: peer.id, status: 'skipped', applied: 0, conflicts: 0 };
    }
    const endpoint = parsePeerEndpoint(peer.endpoint);
    if (!endpoint.secret) {
      return {
        peerId: peer.id,
        status: 'failed',
        applied: 0,
        conflicts: 0,
        error: 'Peer endpoint is missing a #secret fragment.'
      };
    }
    try {
      const response = await this.fetcher(`${endpoint.url}/api/peer/vault`, {
        headers: { accept: 'application/json' }
      });
      if (!response.ok) {
        throw new Error(`Peer returned HTTP ${response.status}`);
      }
      const envelope = (await response.json()) as PeerVaultEnvelope;
      const result = importEncryptedPeerVault(this.db, envelope, endpoint.secret);
      markPeerSeen(this.db, peer.id);
      return { peerId: peer.id, status: 'synced', ...result };
    } catch (error) {
      return {
        peerId: peer.id,
        status: 'failed',
        applied: 0,
        conflicts: 0,
        error: error instanceof Error ? error.message : 'Unknown peer sync error'
      };
    }
  }
}

function parsePeerEndpoint(endpoint: string): { url: string; secret: string } {
  const parsed = new URL(endpoint);
  const secret = decodeURIComponent(parsed.hash.replace(/^#/, ''));
  parsed.hash = '';
  return { url: parsed.toString().replace(/\/+$/, ''), secret };
}

function derivePeerKey(secret: string, salt: Buffer): Buffer {
  return scryptSync(secret, salt, 32);
}

function parsePeerVaultPlaintext(raw: string): VaultPlaintext {
  const parsed: unknown = JSON.parse(raw);
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    typeof (parsed as { schemaVersion?: unknown }).schemaVersion !== 'number' ||
    !Array.isArray((parsed as { records?: unknown }).records)
  ) {
    throw new Error('Invalid peer vault payload');
  }
  return parsed as VaultPlaintext;
}

function ensurePeerSecret(db: Database.Database): string {
  const existing = getMeta(db, 'peer_sync_secret');
  if (existing) return existing;
  const secret = randomBytes(32).toString('base64url');
  setMeta(db, 'peer_sync_secret', secret);
  return secret;
}
