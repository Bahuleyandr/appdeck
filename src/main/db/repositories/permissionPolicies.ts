import type Database from 'better-sqlite3';
import type { PermissionPolicy } from '../../../shared/types.js';

export function listPermissionPolicies(db: Database.Database): PermissionPolicy[] {
  return db
    .prepare('SELECT * FROM permission_policies ORDER BY permission ASC')
    .all() as PermissionPolicy[];
}

export function upsertPermissionPolicy(
  db: Database.Database,
  input: Partial<PermissionPolicy> & Pick<PermissionPolicy, 'permission' | 'decision'>
): PermissionPolicy {
  const id = input.id ?? crypto.randomUUID();
  const now = Date.now();
  const existing = db
    .prepare(
      "SELECT id FROM permission_policies WHERE COALESCE(service_instance_id, '') = COALESCE(?, '') AND permission = ?"
    )
    .get(input.service_instance_id ?? null, input.permission) as { id: string } | undefined;
  if (existing) {
    db.prepare('UPDATE permission_policies SET decision = ?, updated_at = ? WHERE id = ?').run(
      input.decision,
      now,
      existing.id
    );
  } else {
    db.prepare(
      'INSERT INTO permission_policies (id, service_instance_id, permission, decision, updated_at) VALUES (?, ?, ?, ?, ?)'
    ).run(id, input.service_instance_id ?? null, input.permission, input.decision, now);
  }
  const row = db
    .prepare(
      "SELECT * FROM permission_policies WHERE COALESCE(service_instance_id, '') = COALESCE(?, '') AND permission = ?"
    )
    .get(input.service_instance_id ?? null, input.permission) as PermissionPolicy | undefined;
  if (!row) throw new Error('Failed to save permission policy');
  return row;
}

export function deletePermissionPolicy(db: Database.Database, id: string): void {
  db.prepare('DELETE FROM permission_policies WHERE id = ?').run(id);
}

export function permissionDecision(
  db: Database.Database,
  serviceInstanceId: string,
  permission: string
): PermissionPolicy['decision'] {
  const scoped = db
    .prepare(
      'SELECT decision FROM permission_policies WHERE service_instance_id = ? AND permission = ?'
    )
    .get(serviceInstanceId, permission) as { decision: PermissionPolicy['decision'] } | undefined;
  if (scoped) return scoped.decision;
  const global = db
    .prepare(
      'SELECT decision FROM permission_policies WHERE service_instance_id IS NULL AND permission = ?'
    )
    .get(permission) as { decision: PermissionPolicy['decision'] } | undefined;
  return global?.decision ?? 'ask';
}
