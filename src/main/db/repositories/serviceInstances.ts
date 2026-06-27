import type Database from 'better-sqlite3';
import type { ServiceInstance, ServiceProxy, SleepPolicy } from '../../../shared/types.js';
import { SERVICE_PARTITION_PREFIX } from '../../../shared/constants.js';
import { parseJson, stringifyJson, toBool } from './json.js';

interface ServiceInstanceRow {
  id: string;
  recipe_id: string;
  profile_id: string | null;
  display_name: string;
  partition_key: string;
  color: string | null;
  icon_path: string | null;
  pinned: number;
  muted: number;
  disabled: number;
  sleep_policy: string;
  custom_css: string | null;
  custom_js: string | null;
  proxy: string | null;
  user_agent: string | null;
  last_url: string | null;
  zoom_factor: number | null;
  spellcheck: number;
  updated_at: number;
  deleted_at: number | null;
  rev: number;
  origin_device: string;
}

function mapServiceInstance(row: ServiceInstanceRow): ServiceInstance {
  return {
    ...row,
    pinned: toBool(row.pinned),
    muted: toBool(row.muted),
    disabled: toBool(row.disabled),
    sleep_policy: parseJson<SleepPolicy>(row.sleep_policy, {}),
    proxy: parseJson<ServiceProxy | null>(row.proxy, null),
    spellcheck: toBool(row.spellcheck)
  };
}

export function listServiceInstances(
  db: Database.Database,
  workspaceId?: string,
  includeDeleted = false
): ServiceInstance[] {
  if (workspaceId) {
    const rows = db
      .prepare(
        `SELECT si.*
         FROM service_instances si
         INNER JOIN workspace_services ws ON ws.service_instance_id = si.id
         WHERE ws.workspace_id = ?
           ${includeDeleted ? '' : 'AND si.deleted_at IS NULL AND ws.deleted_at IS NULL'}
         ORDER BY ws.position ASC, si.display_name ASC`
      )
      .all(workspaceId) as ServiceInstanceRow[];
    return rows.map(mapServiceInstance);
  }
  const rows = db
    .prepare(
      `SELECT * FROM service_instances ${includeDeleted ? '' : 'WHERE deleted_at IS NULL'} ORDER BY display_name ASC`
    )
    .all() as ServiceInstanceRow[];
  return rows.map(mapServiceInstance);
}

export function getServiceInstance(db: Database.Database, id: string): ServiceInstance | null {
  const row = db.prepare('SELECT * FROM service_instances WHERE id = ?').get(id) as
    | ServiceInstanceRow
    | undefined;
  return row ? mapServiceInstance(row) : null;
}

export function createServiceInstance(
  db: Database.Database,
  deviceId: string,
  input: {
    recipeId: string;
    workspaceId: string;
    displayName: string;
    profileId?: string | null;
    color?: string | null;
  }
): ServiceInstance {
  const id = crypto.randomUUID();
  const now = Date.now();
  const partitionKey = `${SERVICE_PARTITION_PREFIX}${id}`;
  const positionRow = db
    .prepare(
      'SELECT COALESCE(MAX(position), -1) + 1 AS position FROM workspace_services WHERE workspace_id = ?'
    )
    .get(input.workspaceId) as { position: number };
  db.transaction(() => {
    db.prepare(
      `INSERT INTO service_instances
        (id, recipe_id, profile_id, display_name, partition_key, color, icon_path, pinned, muted, disabled, sleep_policy,
         custom_css, custom_js, proxy, user_agent, last_url, zoom_factor, spellcheck, updated_at, deleted_at, rev, origin_device)
       VALUES (?, ?, ?, ?, ?, ?, NULL, 0, 0, 0, '{}', NULL, NULL, NULL, NULL, NULL, NULL, 1, ?, NULL, 1, ?)`
    ).run(
      id,
      input.recipeId,
      input.profileId ?? null,
      input.displayName,
      partitionKey,
      input.color ?? null,
      now,
      deviceId
    );
    db.prepare(
      `INSERT INTO workspace_services
        (workspace_id, service_instance_id, position, group_name, updated_at, deleted_at, rev, origin_device)
       VALUES (?, ?, ?, NULL, ?, NULL, 1, ?)`
    ).run(input.workspaceId, id, positionRow.position, now, deviceId);
  })();
  const created = getServiceInstance(db, id);
  if (!created) throw new Error('Failed to create service instance');
  return created;
}

export function updateServiceInstance(
  db: Database.Database,
  deviceId: string,
  id: string,
  patch: Partial<
    Omit<
      ServiceInstance,
      'id' | 'recipe_id' | 'partition_key' | 'updated_at' | 'deleted_at' | 'rev' | 'origin_device'
    >
  >
): ServiceInstance {
  const current = getServiceInstance(db, id);
  if (!current) throw new Error(`Service instance not found: ${id}`);
  const next = { ...current, ...patch };
  db.prepare(
    `UPDATE service_instances
     SET profile_id = ?, display_name = ?, color = ?, icon_path = ?, pinned = ?, muted = ?, disabled = ?, sleep_policy = ?,
         custom_css = ?, custom_js = ?, proxy = ?, user_agent = ?, last_url = ?, zoom_factor = ?, spellcheck = ?,
         updated_at = ?, rev = rev + 1, origin_device = ?
     WHERE id = ?`
  ).run(
    next.profile_id,
    next.display_name,
    next.color,
    next.icon_path,
    next.pinned ? 1 : 0,
    next.muted ? 1 : 0,
    next.disabled ? 1 : 0,
    stringifyJson(next.sleep_policy),
    next.custom_css,
    next.custom_js,
    next.proxy ? stringifyJson(next.proxy) : null,
    next.user_agent,
    next.last_url,
    next.zoom_factor,
    next.spellcheck ? 1 : 0,
    Date.now(),
    deviceId,
    id
  );
  const updated = getServiceInstance(db, id);
  if (!updated) throw new Error('Failed to update service instance');
  return updated;
}

export function tombstoneServiceInstance(
  db: Database.Database,
  deviceId: string,
  id: string
): void {
  const now = Date.now();
  db.transaction(() => {
    db.prepare(
      'UPDATE service_instances SET deleted_at = ?, updated_at = ?, rev = rev + 1, origin_device = ? WHERE id = ?'
    ).run(now, now, deviceId, id);
    db.prepare(
      'UPDATE workspace_services SET deleted_at = ?, updated_at = ?, rev = rev + 1, origin_device = ? WHERE service_instance_id = ?'
    ).run(now, now, deviceId, id);
  })();
}

export function setServiceLastUrl(db: Database.Database, id: string, lastUrl: string): void {
  db.prepare('UPDATE service_instances SET last_url = ? WHERE id = ?').run(lastUrl, id);
}
