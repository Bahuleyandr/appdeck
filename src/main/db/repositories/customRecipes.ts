import type Database from 'better-sqlite3';
import type { CustomRecipe, DeclarativeUnreadSpec, ServiceCategory } from '../../../shared/types.js';
import { parseJson, stringifyJson, toBool } from './json.js';

interface CustomRecipeRow {
  id: string;
  name: string;
  category: ServiceCategory;
  start_url: string;
  allowed_domains: string;
  icon_path: string | null;
  default_user_agent: string | null;
  unread_spec: string | null;
  mobile_mode: number;
  updated_at: number;
  deleted_at: number | null;
  rev: number;
  origin_device: string;
}

function mapCustomRecipe(row: CustomRecipeRow): CustomRecipe {
  return {
    ...row,
    allowed_domains: parseJson<string[]>(row.allowed_domains, []),
    unread_spec: parseJson<DeclarativeUnreadSpec | null>(row.unread_spec, null),
    mobile_mode: toBool(row.mobile_mode)
  };
}

export function listCustomRecipes(db: Database.Database, includeDeleted = false): CustomRecipe[] {
  const rows = db
    .prepare(`SELECT * FROM custom_recipes ${includeDeleted ? '' : 'WHERE deleted_at IS NULL'} ORDER BY name ASC`)
    .all() as CustomRecipeRow[];
  return rows.map(mapCustomRecipe);
}

export function getCustomRecipe(db: Database.Database, id: string): CustomRecipe | null {
  const row = db.prepare('SELECT * FROM custom_recipes WHERE id = ?').get(id) as CustomRecipeRow | undefined;
  return row ? mapCustomRecipe(row) : null;
}

export function createCustomRecipe(
  db: Database.Database,
  deviceId: string,
  input: {
    name: string;
    category: ServiceCategory;
    start_url: string;
    allowed_domains: string[];
    icon_path?: string | null;
    default_user_agent?: string | null;
    unread_spec?: DeclarativeUnreadSpec | null;
    mobile_mode?: boolean;
  }
): CustomRecipe {
  const id = crypto.randomUUID();
  const now = Date.now();
  db.prepare(
    `INSERT INTO custom_recipes
      (id, name, category, start_url, allowed_domains, icon_path, default_user_agent, unread_spec,
       mobile_mode, updated_at, deleted_at, rev, origin_device)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 1, ?)`
  ).run(
    id,
    input.name,
    input.category,
    input.start_url,
    stringifyJson(input.allowed_domains),
    input.icon_path ?? null,
    input.default_user_agent ?? null,
    input.unread_spec ? stringifyJson(input.unread_spec) : null,
    input.mobile_mode ? 1 : 0,
    now,
    deviceId
  );
  const created = getCustomRecipe(db, id);
  if (!created) throw new Error('Failed to create custom recipe');
  return created;
}

