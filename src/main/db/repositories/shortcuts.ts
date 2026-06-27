import type Database from 'better-sqlite3';
import type { ShortcutBinding } from '../../../shared/types.js';
import { toBool } from './json.js';

interface ShortcutRow extends Omit<ShortcutBinding, 'enabled'> {
  enabled: number;
}

function mapShortcut(row: ShortcutRow): ShortcutBinding {
  return { ...row, enabled: toBool(row.enabled) };
}

export function listShortcuts(db: Database.Database): ShortcutBinding[] {
  return (
    db
      .prepare('SELECT * FROM shortcut_bindings ORDER BY scope ASC, command ASC')
      .all() as ShortcutRow[]
  ).map(mapShortcut);
}

export function upsertShortcut(
  db: Database.Database,
  input: Partial<ShortcutBinding> & Pick<ShortcutBinding, 'command' | 'accelerator'>
): ShortcutBinding {
  const now = Date.now();
  const id = input.id ?? crypto.randomUUID();
  db.prepare(
    `INSERT INTO shortcut_bindings (id, command, accelerator, scope, target_id, enabled, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       command = excluded.command, accelerator = excluded.accelerator, scope = excluded.scope,
       target_id = excluded.target_id, enabled = excluded.enabled, updated_at = excluded.updated_at`
  ).run(
    id,
    input.command,
    input.accelerator,
    input.scope ?? 'global',
    input.target_id ?? null,
    input.enabled === false ? 0 : 1,
    input.created_at ?? now,
    now
  );
  const row = db.prepare('SELECT * FROM shortcut_bindings WHERE id = ?').get(id) as
    | ShortcutRow
    | undefined;
  if (!row) throw new Error('Failed to save shortcut');
  return mapShortcut(row);
}

export function deleteShortcut(db: Database.Database, id: string): void {
  db.prepare('DELETE FROM shortcut_bindings WHERE id = ?').run(id);
}
