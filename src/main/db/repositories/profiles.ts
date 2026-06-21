import type Database from 'better-sqlite3';
import type { Profile } from '../../../shared/types.js';

type ProfileRow = Profile;

export function listProfiles(db: Database.Database, includeDeleted = false): Profile[] {
  return db
    .prepare(`SELECT * FROM profiles ${includeDeleted ? '' : 'WHERE deleted_at IS NULL'} ORDER BY label ASC`)
    .all() as Profile[];
}

export function getProfile(db: Database.Database, id: string): Profile | null {
  return (db.prepare('SELECT * FROM profiles WHERE id = ?').get(id) as ProfileRow | undefined) ?? null;
}

export function createProfile(
  db: Database.Database,
  deviceId: string,
  input: { label: string; color?: string | null; note?: string | null }
): Profile {
  const id = crypto.randomUUID();
  const now = Date.now();
  db.prepare(
    `INSERT INTO profiles (id, label, color, note, updated_at, deleted_at, rev, origin_device)
     VALUES (?, ?, ?, ?, ?, NULL, 1, ?)`
  ).run(id, input.label, input.color ?? null, input.note ?? null, now, deviceId);
  const created = getProfile(db, id);
  if (!created) throw new Error('Failed to create profile');
  return created;
}

export function updateProfile(
  db: Database.Database,
  deviceId: string,
  id: string,
  patch: Partial<Pick<Profile, 'label' | 'color' | 'note'>>
): Profile {
  const current = getProfile(db, id);
  if (!current) throw new Error(`Profile not found: ${id}`);
  const next = { ...current, ...patch };
  db.prepare(
    'UPDATE profiles SET label = ?, color = ?, note = ?, updated_at = ?, rev = rev + 1, origin_device = ? WHERE id = ?'
  ).run(next.label, next.color, next.note, Date.now(), deviceId, id);
  const updated = getProfile(db, id);
  if (!updated) throw new Error('Failed to update profile');
  return updated;
}

export function tombstoneProfile(db: Database.Database, deviceId: string, id: string): void {
  const now = Date.now();
  db.prepare('UPDATE profiles SET deleted_at = ?, updated_at = ?, rev = rev + 1, origin_device = ? WHERE id = ?').run(
    now,
    now,
    deviceId,
    id
  );
}
