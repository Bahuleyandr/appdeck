import type Database from 'better-sqlite3';
import type {
  DeclarativeUnreadSpec,
  RecipePackValidation,
  RecipeRegistryEntry,
  ServiceCategory
} from '../../../shared/types.js';
import { generateSeedRegistryEntries } from '../../recipes/registrySeed.js';
import { parseJson, stringifyJson, toBool } from './json.js';

interface RecipeRegistryRow {
  id: string;
  name: string;
  category: ServiceCategory;
  start_url: string;
  allowed_domains: string;
  aliases: string;
  icon: string | null;
  icon_path: string | null;
  default_user_agent: string | null;
  unread_spec: string | null;
  mobile_mode: number;
  source: 'seed' | 'community' | 'user';
  created_at: number;
  updated_at: number;
}

function mapEntry(row: RecipeRegistryRow): RecipeRegistryEntry {
  return {
    ...row,
    allowed_domains: parseJson<string[]>(row.allowed_domains, []),
    aliases: parseJson<string[]>(row.aliases, []),
    unread_spec: parseJson<DeclarativeUnreadSpec | null>(row.unread_spec, null),
    mobile_mode: toBool(row.mobile_mode)
  };
}

export function seedRecipeRegistry(db: Database.Database): void {
  const count = (
    db.prepare('SELECT COUNT(*) AS count FROM recipe_registry_entries').get() as { count: number }
  ).count;
  if (count >= 1500) {
    return;
  }
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO recipe_registry_entries
      (id, name, category, start_url, allowed_domains, aliases, icon, icon_path, default_user_agent,
       unread_spec, mobile_mode, source, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  db.transaction(() => {
    for (const entry of generateSeedRegistryEntries()) {
      stmt.run(
        entry.id,
        entry.name,
        entry.category,
        entry.start_url,
        stringifyJson(entry.allowed_domains),
        stringifyJson(entry.aliases),
        entry.icon,
        entry.icon_path,
        entry.default_user_agent,
        entry.unread_spec ? stringifyJson(entry.unread_spec) : null,
        entry.mobile_mode ? 1 : 0,
        entry.source,
        entry.created_at,
        entry.updated_at
      );
    }
  })();
}

export function listRecipeRegistryEntries(
  db: Database.Database,
  query = '',
  limit = 300
): RecipeRegistryEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return (
      db
        .prepare('SELECT * FROM recipe_registry_entries ORDER BY name ASC LIMIT ?')
        .all(limit) as RecipeRegistryRow[]
    ).map(mapEntry);
  }
  const like = `%${q}%`;
  return (
    db
      .prepare(
        `SELECT * FROM recipe_registry_entries
         WHERE lower(name) LIKE ? OR lower(aliases) LIKE ? OR lower(start_url) LIKE ?
         ORDER BY
           CASE WHEN lower(name) = ? THEN 0 WHEN lower(name) LIKE ? THEN 1 ELSE 2 END,
           name ASC
         LIMIT ?`
      )
      .all(like, like, like, q, `${q}%`, limit) as RecipeRegistryRow[]
  ).map(mapEntry);
}

export function getRecipeRegistryEntry(
  db: Database.Database,
  id: string
): RecipeRegistryEntry | null {
  const row = db.prepare('SELECT * FROM recipe_registry_entries WHERE id = ?').get(id) as
    | RecipeRegistryRow
    | undefined;
  return row ? mapEntry(row) : null;
}

export function recipeRegistryStats(db: Database.Database): {
  total: number;
  seed: number;
  community: number;
  user: number;
} {
  const rows = db
    .prepare('SELECT source, COUNT(*) AS count FROM recipe_registry_entries GROUP BY source')
    .all() as Array<{ source: 'seed' | 'community' | 'user'; count: number }>;
  const stats = { total: 0, seed: 0, community: 0, user: 0 };
  for (const row of rows) {
    stats[row.source] = row.count;
    stats.total += row.count;
  }
  return stats;
}

export function importRecipeRegistryPack(
  db: Database.Database,
  raw: string
): { imported: number; skipped: number } {
  const entries = parsePackEntries(raw);
  let imported = 0;
  let skipped = 0;
  const stmt = db.prepare(
    `INSERT OR REPLACE INTO recipe_registry_entries
      (id, name, category, start_url, allowed_domains, aliases, icon, icon_path, default_user_agent,
       unread_spec, mobile_mode, source, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'community', ?, ?)`
  );
  const now = Date.now();
  db.transaction(() => {
    for (const item of entries as Array<Record<string, unknown>>) {
      const name = stringField(item.name);
      const startUrl = stringField(item.start_url ?? item.startUrl ?? item.url);
      const category = categoryField(item.category);
      const domains = arrayField(item.allowed_domains ?? item.allowedDomains);
      if (!name || !startUrl || !category) {
        skipped += 1;
        continue;
      }
      const id = stringField(item.id) || `community-${slug(name)}`;
      const allowedDomains = domains.length ? domains : domainsFor(startUrl);
      stmt.run(
        id,
        name,
        category,
        startUrl,
        stringifyJson(allowedDomains),
        stringifyJson(arrayField(item.aliases)),
        stringField(item.icon) || null,
        stringField(item.icon_path ?? item.iconPath) || null,
        stringField(item.default_user_agent ?? item.defaultUserAgent) || null,
        (item.unread_spec ?? item.unreadSpec)
          ? stringifyJson(item.unread_spec ?? item.unreadSpec)
          : null,
        item.mobile_mode === true || item.mobileMode === true ? 1 : 0,
        now,
        now
      );
      imported += 1;
    }
  })();
  return { imported, skipped };
}

export function upsertRecipeRegistryEntry(
  db: Database.Database,
  input: Pick<RecipeRegistryEntry, 'name' | 'category' | 'start_url'> &
    Partial<
      Pick<
        RecipeRegistryEntry,
        | 'id'
        | 'allowed_domains'
        | 'aliases'
        | 'icon'
        | 'icon_path'
        | 'default_user_agent'
        | 'unread_spec'
        | 'mobile_mode'
        | 'source'
      >
    >
): RecipeRegistryEntry {
  const now = Date.now();
  const id = input.id ?? `${input.source ?? 'user'}-${slug(input.name)}`;
  db.prepare(
    `INSERT INTO recipe_registry_entries
      (id, name, category, start_url, allowed_domains, aliases, icon, icon_path, default_user_agent,
       unread_spec, mobile_mode, source, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       category = excluded.category,
       start_url = excluded.start_url,
       allowed_domains = excluded.allowed_domains,
       aliases = excluded.aliases,
       icon = excluded.icon,
       icon_path = excluded.icon_path,
       default_user_agent = excluded.default_user_agent,
       unread_spec = excluded.unread_spec,
       mobile_mode = excluded.mobile_mode,
       source = excluded.source,
       updated_at = excluded.updated_at`
  ).run(
    id,
    input.name,
    input.category,
    input.start_url,
    stringifyJson(input.allowed_domains ?? domainsFor(input.start_url)),
    stringifyJson(input.aliases ?? []),
    input.icon ?? null,
    input.icon_path ?? null,
    input.default_user_agent ?? null,
    input.unread_spec ? stringifyJson(input.unread_spec) : null,
    input.mobile_mode ? 1 : 0,
    input.source ?? 'user',
    now,
    now
  );
  const saved = getRecipeRegistryEntry(db, id);
  if (!saved) throw new Error('Failed to save recipe');
  return saved;
}

export function validateRecipeRegistryPack(raw: string): RecipePackValidation {
  let entries: unknown[];
  try {
    entries = parsePackEntries(raw);
  } catch (error) {
    return {
      valid: false,
      imported: 0,
      skipped: 0,
      issues: [error instanceof Error ? error.message : String(error)],
      entries: []
    };
  }
  const issues: string[] = [];
  const preview: RecipePackValidation['entries'] = [];
  let skipped = 0;
  for (const [index, item] of (entries as Array<Record<string, unknown>>).entries()) {
    const name = stringField(item.name);
    const startUrl = stringField(item.start_url ?? item.startUrl ?? item.url);
    const category = categoryField(item.category);
    if (!name) issues.push(`Entry ${index + 1}: missing name`);
    if (!startUrl) issues.push(`Entry ${index + 1}: missing URL`);
    if (startUrl && !isUrl(startUrl)) issues.push(`Entry ${index + 1}: URL is invalid`);
    if (!category) issues.push(`Entry ${index + 1}: category is invalid`);
    if (!name || !startUrl || !category || !isUrl(startUrl)) {
      skipped += 1;
      continue;
    }
    preview.push({
      id: stringField(item.id) || `community-${slug(name)}`,
      name,
      category,
      start_url: startUrl,
      source: 'community'
    });
  }
  return {
    valid: issues.length === 0 && preview.length > 0,
    imported: preview.length,
    skipped,
    issues,
    entries: preview.slice(0, 100)
  };
}

function parsePackEntries(raw: string): unknown[] {
  const parsed = JSON.parse(raw) as unknown;
  return Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as { entries?: unknown }).entries)
      ? (parsed as { entries: unknown[] }).entries
      : [];
}

function stringField(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function arrayField(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
}

function categoryField(value: unknown): ServiceCategory | null {
  const normalized = stringField(value);
  return ['Chat', 'Email', 'Social', 'Dev', 'AI', 'Productivity', 'Media', 'Other'].includes(
    normalized
  )
    ? (normalized as ServiceCategory)
    : null;
}

function domainsFor(url: string): string[] {
  try {
    const host = new URL(url).hostname;
    return [host, host.replace(/^www\./, '')];
  } catch {
    return [];
  }
}

function isUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
