import type Database from 'better-sqlite3';
import type {
  MigrationPreview,
  MigrationPreviewItem,
  MigrationRunResult
} from '../../shared/types.js';
import { createCustomRecipe } from '../db/repositories/customRecipes.js';
import { createServiceInstance } from '../db/repositories/serviceInstances.js';
import { listWorkspaces } from '../db/repositories/workspaces.js';
import type { RecipeLoader } from '../recipes/loader.js';

interface ParsedService {
  recipeId: string | null;
  name: string;
  url: string | null;
}

export function previewMigration(raw: string, recipeLoader: RecipeLoader): MigrationPreview {
  const parsed = JSON.parse(raw) as unknown;
  const source = detectSource(parsed);
  const services = parseServices(parsed);
  const items = services.map<MigrationPreviewItem>((service) => {
    const builtin = service.recipeId ? recipeLoader.getBuiltinRecipe(service.recipeId) : null;
    const validUrl = service.url ? isUrl(service.url) : false;
    const importable = Boolean(builtin || validUrl);
    return {
      name: service.name,
      recipeId: builtin?.id ?? service.recipeId,
      url: service.url,
      importable,
      reason: importable ? null : 'No matching built-in recipe or valid URL',
      willCreateCustomRecipe: !builtin && validUrl
    };
  });
  return {
    source,
    total: items.length,
    importable: items.filter((item) => item.importable).length,
    skipped: items.filter((item) => !item.importable).length,
    items,
    rollbackExport: JSON.stringify({ source, items }, null, 2)
  };
}

export function runMigration(
  db: Database.Database,
  deviceId: string,
  recipeLoader: RecipeLoader,
  raw: string,
  workspaceId?: string | null
): MigrationRunResult {
  const preview = previewMigration(raw, recipeLoader);
  const targetWorkspace =
    workspaceId || listWorkspaces(db).find((workspace) => !workspace.disabled)?.id;
  if (!targetWorkspace) throw new Error('No workspace to import into');
  let created = 0;
  let skipped = 0;
  for (const item of preview.items) {
    if (!item.importable) {
      skipped += 1;
      continue;
    }
    const builtin = item.recipeId ? recipeLoader.getBuiltinRecipe(item.recipeId) : null;
    if (builtin) {
      createServiceInstance(db, deviceId, {
        recipeId: builtin.id,
        workspaceId: targetWorkspace,
        displayName: item.name
      });
      created += 1;
      continue;
    }
    if (item.url) {
      const host = hostOf(item.url);
      if (!host) {
        skipped += 1;
        continue;
      }
      const recipe = createCustomRecipe(db, deviceId, {
        name: item.name,
        category: 'Other',
        start_url: item.url,
        allowed_domains: [host, host.replace(/^www\./, '')]
      });
      createServiceInstance(db, deviceId, {
        recipeId: recipe.id,
        workspaceId: targetWorkspace,
        displayName: item.name
      });
      created += 1;
    }
  }
  return { created, skipped, source: preview.source, rollbackExport: preview.rollbackExport };
}

function parseServices(parsed: unknown): ParsedService[] {
  const candidates = collectServiceCandidates(parsed);
  return candidates
    .map((candidate) => {
      const settings = objectField(candidate.settings);
      const name = stringField(
        candidate.name ??
          candidate.title ??
          candidate.label ??
          candidate.displayName ??
          candidate.recipeId
      );
      const recipeId = stringField(
        candidate.recipeId ?? candidate.recipe ?? candidate.serviceId ?? candidate.id
      );
      const url = stringField(
        candidate.customUrl ??
          candidate.url ??
          candidate.startUrl ??
          candidate.homepage ??
          settings.customUrl ??
          settings.url
      );
      return {
        recipeId: recipeId || null,
        name: name || recipeId || url || 'Imported service',
        url: url || null
      };
    })
    .filter((service) => service.recipeId || service.url);
}

function collectServiceCandidates(value: unknown): Array<Record<string, unknown>> {
  const root = objectField(value);
  const directArrays = [
    value,
    root.services,
    root.apps,
    root.applications,
    root.items,
    objectField(root.data).services,
    objectField(root.data).apps
  ];
  const services = directArrays
    .filter(Array.isArray)
    .flatMap((items) => items as unknown[])
    .filter((item): item is Record<string, unknown> => item !== null && typeof item === 'object');

  const workspaces = [root.workspaces, objectField(root.data).workspaces]
    .filter(Array.isArray)
    .flatMap((items) => items as unknown[])
    .filter((item): item is Record<string, unknown> => item !== null && typeof item === 'object');
  for (const workspace of workspaces) {
    for (const key of ['services', 'apps', 'items']) {
      const items = workspace[key];
      if (Array.isArray(items)) {
        services.push(
          ...items.filter(
            (item): item is Record<string, unknown> => item !== null && typeof item === 'object'
          )
        );
      }
    }
  }

  const bookmarkUrls = collectBookmarkUrls(value);
  services.push(...bookmarkUrls.map((url) => ({ name: url.title, url: url.url })));
  return services;
}

function collectBookmarkUrls(value: unknown): Array<{ title: string; url: string }> {
  const urls: Array<{ title: string; url: string }> = [];
  const visit = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    const record = node as Record<string, unknown>;
    if (typeof record.url === 'string') {
      urls.push({ title: stringField(record.name ?? record.title) || record.url, url: record.url });
    }
    for (const child of Object.values(record)) {
      if (Array.isArray(child)) child.forEach(visit);
      else if (child && typeof child === 'object') visit(child);
    }
  };
  if (objectField(value).roots || objectField(value).bookmark_bar) visit(value);
  return urls;
}

function detectSource(parsed: unknown): MigrationPreview['source'] {
  const text = JSON.stringify(parsed).toLowerCase();
  if (text.includes('ferdium')) return 'ferdium';
  if (text.includes('franz')) return 'franz';
  if (text.includes('rambox')) return 'rambox';
  if (text.includes('webcatalog')) return 'webcatalog';
  if (text.includes('shift')) return 'shift';
  const root = objectField(parsed);
  if (root.roots || root.bookmark_bar) return 'bookmarks';
  return 'unknown';
}

function objectField(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringField(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function isUrl(url: string): boolean {
  return Boolean(hostOf(url));
}
