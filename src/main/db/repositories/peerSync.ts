import type Database from 'better-sqlite3';
import type { PeerSyncPeer } from '../../../shared/types.js';
import { toBool } from './json.js';

interface PeerRow {
  id: string;
  label: string;
  endpoint: string;
  enabled: number;
  last_seen_at: number | null;
  created_at: number;
  updated_at: number;
}

function mapPeer(row: PeerRow): PeerSyncPeer {
  return { ...row, enabled: toBool(row.enabled) };
}

export function listPeerSyncPeers(db: Database.Database): PeerSyncPeer[] {
  return (
    db.prepare('SELECT * FROM peer_sync_peers ORDER BY enabled DESC, label ASC').all() as PeerRow[]
  ).map(mapPeer);
}

export function getPeerSyncPeer(db: Database.Database, id: string): PeerSyncPeer | null {
  const row = db.prepare('SELECT * FROM peer_sync_peers WHERE id = ?').get(id) as
    | PeerRow
    | undefined;
  return row ? mapPeer(row) : null;
}

export function upsertPeerSyncPeer(
  db: Database.Database,
  input: Partial<PeerSyncPeer> & Pick<PeerSyncPeer, 'label' | 'endpoint'>
): PeerSyncPeer {
  const now = Date.now();
  const id = input.id ?? crypto.randomUUID();
  db.prepare(
    `INSERT INTO peer_sync_peers
      (id, label, endpoint, enabled, last_seen_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       label = excluded.label,
       endpoint = excluded.endpoint,
       enabled = excluded.enabled,
       updated_at = excluded.updated_at`
  ).run(
    id,
    input.label,
    input.endpoint,
    input.enabled === false ? 0 : 1,
    input.last_seen_at ?? null,
    input.created_at ?? now,
    now
  );
  const saved = getPeerSyncPeer(db, id);
  if (!saved) throw new Error('Failed to save peer');
  return saved;
}

export function deletePeerSyncPeer(db: Database.Database, id: string): void {
  db.prepare('DELETE FROM peer_sync_peers WHERE id = ?').run(id);
}

export function markPeerSeen(db: Database.Database, id: string): void {
  db.prepare('UPDATE peer_sync_peers SET last_seen_at = ?, updated_at = ? WHERE id = ?').run(
    Date.now(),
    Date.now(),
    id
  );
}
