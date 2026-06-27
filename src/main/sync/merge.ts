import type Database from 'better-sqlite3';
import { TOMBSTONE_TTL_MS } from '../../shared/constants.js';
import type { SyncRecord, SyncResult, VaultPlaintext } from '../../shared/types.js';
import { stringifyJson } from '../db/repositories/json.js';

interface ExistingMeta {
  updated_at: number;
  origin_device: string;
  rev: number;
  deleted_at: number | null;
}

const tableByType = {
  workspace: 'workspaces',
  profile: 'profiles',
  customRecipe: 'custom_recipes',
  serviceInstance: 'service_instances',
  workspaceService: 'workspace_services',
  layout: 'layouts'
} as const;

export function mergeVaultPlaintext(db: Database.Database, incoming: VaultPlaintext): SyncResult {
  let applied = 0;
  let conflicts = 0;
  db.transaction(() => {
    for (const record of incoming.records) {
      const result = mergeRecord(db, record);
      applied += result.applied;
      conflicts += result.conflicts;
    }
    purgeOldTombstones(db);
  })();
  return { applied, conflicts };
}

// Pure last-write-wins per object. `rev` is incremented independently on each device, so it
// is NOT a reliable conflict signal (the previous rev-comparison spawned spurious "(conflict)"
// copies on ordinary sequential edits). Real conflict detection needs a per-record synced
// baseline / version vector — deferred. LWW is the documented v1 behavior.
function mergeRecord(db: Database.Database, record: SyncRecord): SyncResult {
  const existing = getExistingMeta(db, record);
  if (!existing) {
    upsertRecord(db, record);
    return { applied: 1, conflicts: 0 };
  }
  const incomingWins =
    record.updatedAt > existing.updated_at ||
    (record.updatedAt === existing.updated_at &&
      record.originDevice.localeCompare(existing.origin_device) > 0);
  if (incomingWins) {
    upsertRecord(db, record);
    return { applied: 1, conflicts: 0 };
  }
  return { applied: 0, conflicts: 0 };
}

function getExistingMeta(db: Database.Database, record: SyncRecord): ExistingMeta | null {
  if (record.type === 'workspaceService') {
    const row = db
      .prepare(
        'SELECT updated_at, origin_device, rev, deleted_at FROM workspace_services WHERE workspace_id = ? AND service_instance_id = ?'
      )
      .get(record.data.workspace_id, record.data.service_instance_id) as ExistingMeta | undefined;
    return row ?? null;
  }
  const table = tableByType[record.type];
  const idColumn = record.type === 'layout' ? 'workspace_id' : 'id';
  const row = db
    .prepare(
      `SELECT updated_at, origin_device, rev, deleted_at FROM ${table} WHERE ${idColumn} = ?`
    )
    .get(record.id) as ExistingMeta | undefined;
  return row ?? null;
}

function upsertRecord(db: Database.Database, record: SyncRecord): void {
  switch (record.type) {
    case 'workspace':
      db.prepare(
        `INSERT INTO workspaces
          (id, parent_id, name, icon, color, position, disabled, focus_rules, sleep_defaults, updated_at, deleted_at, rev, origin_device)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           parent_id = excluded.parent_id, name = excluded.name, icon = excluded.icon, color = excluded.color,
           position = excluded.position, disabled = excluded.disabled,
           focus_rules = excluded.focus_rules, sleep_defaults = excluded.sleep_defaults,
           updated_at = excluded.updated_at, deleted_at = excluded.deleted_at, rev = excluded.rev,
           origin_device = excluded.origin_device`
      ).run(
        record.data.id,
        record.data.parent_id ?? null,
        record.data.name,
        record.data.icon,
        record.data.color,
        record.data.position,
        record.data.disabled === true ? 1 : 0,
        stringifyJson(record.data.focus_rules),
        stringifyJson(record.data.sleep_defaults),
        record.updatedAt,
        record.deletedAt,
        record.rev,
        record.originDevice
      );
      break;
    case 'profile':
      db.prepare(
        `INSERT INTO profiles (id, label, color, note, updated_at, deleted_at, rev, origin_device)
         VALUES (?, ?, ?, NULL, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           label = excluded.label, color = excluded.color, updated_at = excluded.updated_at,
           deleted_at = excluded.deleted_at, rev = excluded.rev, origin_device = excluded.origin_device`
      ).run(
        record.data.id,
        record.data.label,
        record.data.color,
        record.updatedAt,
        record.deletedAt,
        record.rev,
        record.originDevice
      );
      break;
    case 'customRecipe':
      db.prepare(
        `INSERT INTO custom_recipes
          (id, name, category, start_url, allowed_domains, icon_path, default_user_agent, unread_spec,
           mobile_mode, updated_at, deleted_at, rev, origin_device)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name, category = excluded.category, start_url = excluded.start_url,
           allowed_domains = excluded.allowed_domains, icon_path = excluded.icon_path,
           default_user_agent = excluded.default_user_agent, unread_spec = excluded.unread_spec,
           mobile_mode = excluded.mobile_mode, updated_at = excluded.updated_at,
           deleted_at = excluded.deleted_at, rev = excluded.rev, origin_device = excluded.origin_device`
      ).run(
        record.data.id,
        record.data.name,
        record.data.category,
        record.data.start_url,
        stringifyJson(record.data.allowed_domains),
        record.data.icon_path,
        record.data.default_user_agent,
        record.data.unread_spec ? stringifyJson(record.data.unread_spec) : null,
        record.data.mobile_mode === true ? 1 : 0,
        record.updatedAt,
        record.deletedAt,
        record.rev,
        record.originDevice
      );
      break;
    case 'serviceInstance':
      db.prepare(
        `INSERT INTO service_instances
          (id, recipe_id, profile_id, display_name, partition_key, color, icon_path, pinned, muted, disabled, sleep_policy,
           custom_css, custom_js, proxy, user_agent, last_url, zoom_factor, spellcheck, updated_at, deleted_at, rev, origin_device)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           recipe_id = excluded.recipe_id, profile_id = excluded.profile_id, display_name = excluded.display_name,
           partition_key = excluded.partition_key, color = excluded.color, icon_path = excluded.icon_path,
           pinned = excluded.pinned, muted = excluded.muted, disabled = excluded.disabled,
           sleep_policy = excluded.sleep_policy, custom_css = excluded.custom_css,
           custom_js = excluded.custom_js, proxy = excluded.proxy, user_agent = excluded.user_agent,
           zoom_factor = excluded.zoom_factor, spellcheck = excluded.spellcheck,
           updated_at = excluded.updated_at, deleted_at = excluded.deleted_at, rev = excluded.rev,
           origin_device = excluded.origin_device`
      ).run(
        record.data.id,
        record.data.recipe_id,
        record.data.profile_id,
        record.data.display_name,
        record.data.partition_key,
        record.data.color,
        record.data.icon_path ?? null,
        record.data.pinned === true ? 1 : 0,
        record.data.muted === true ? 1 : 0,
        record.data.disabled === true ? 1 : 0,
        stringifyJson(record.data.sleep_policy),
        record.data.custom_css,
        record.data.custom_js,
        record.data.proxy ? stringifyJson(record.data.proxy) : null,
        record.data.user_agent,
        typeof record.data.zoom_factor === 'number' ? record.data.zoom_factor : null,
        record.data.spellcheck === false ? 0 : 1,
        record.updatedAt,
        record.deletedAt,
        record.rev,
        record.originDevice
      );
      break;
    case 'workspaceService':
      db.prepare(
        `INSERT INTO workspace_services
          (workspace_id, service_instance_id, position, group_name, updated_at, deleted_at, rev, origin_device)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(workspace_id, service_instance_id) DO UPDATE SET
           position = excluded.position, group_name = excluded.group_name, updated_at = excluded.updated_at,
           deleted_at = excluded.deleted_at, rev = excluded.rev, origin_device = excluded.origin_device`
      ).run(
        record.data.workspace_id,
        record.data.service_instance_id,
        record.data.position,
        record.data.group_name,
        record.updatedAt,
        record.deletedAt,
        record.rev,
        record.originDevice
      );
      break;
    case 'layout':
      db.prepare(
        `INSERT INTO layouts
          (workspace_id, mode, selected_service_ids, tile_sizing, updated_at, deleted_at, rev, origin_device)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(workspace_id) DO UPDATE SET
           mode = excluded.mode, selected_service_ids = excluded.selected_service_ids,
           tile_sizing = excluded.tile_sizing, updated_at = excluded.updated_at,
           deleted_at = excluded.deleted_at, rev = excluded.rev, origin_device = excluded.origin_device`
      ).run(
        record.data.workspace_id,
        record.data.mode,
        stringifyJson(record.data.selected_service_ids),
        stringifyJson(record.data.tile_sizing),
        record.updatedAt,
        record.deletedAt,
        record.rev,
        record.originDevice
      );
      break;
  }
}

function purgeOldTombstones(db: Database.Database): void {
  const cutoff = Date.now() - TOMBSTONE_TTL_MS;
  db.prepare('DELETE FROM workspaces WHERE deleted_at IS NOT NULL AND deleted_at < ?').run(cutoff);
  db.prepare('DELETE FROM profiles WHERE deleted_at IS NOT NULL AND deleted_at < ?').run(cutoff);
  db.prepare('DELETE FROM custom_recipes WHERE deleted_at IS NOT NULL AND deleted_at < ?').run(
    cutoff
  );
  db.prepare('DELETE FROM service_instances WHERE deleted_at IS NOT NULL AND deleted_at < ?').run(
    cutoff
  );
  db.prepare('DELETE FROM workspace_services WHERE deleted_at IS NOT NULL AND deleted_at < ?').run(
    cutoff
  );
  db.prepare('DELETE FROM layouts WHERE deleted_at IS NOT NULL AND deleted_at < ?').run(cutoff);
}
