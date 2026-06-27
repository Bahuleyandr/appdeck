import type Database from 'better-sqlite3';
import type {
  BrowserImportItem,
  BrowserImportPreview,
  RecipeCatalogItem
} from '../../shared/types.js';
import { createCustomRecipe } from '../db/repositories/customRecipes.js';
import { createServiceInstance } from '../db/repositories/serviceInstances.js';
import { listWorkspaces } from '../db/repositories/workspaces.js';
import type { RecipeLoader } from '../recipes/loader.js';

export function previewBrowserImport(
  raw: string,
  recipeLoader: RecipeLoader
): BrowserImportPreview {
  const source = detectSource(raw);
  const bookmarks = parseBookmarks(raw);
  const catalog = recipeLoader.catalog();
  const items = bookmarks.map<BrowserImportItem>((bookmark) => {
    const match = matchRecipe(catalog, bookmark.url);
    const importable = isUrl(bookmark.url);
    return {
      title: bookmark.title || bookmark.url,
      url: bookmark.url,
      folder: bookmark.folder,
      importable,
      reason: importable ? null : 'Bookmark URL is invalid',
      recipeId: match?.id ?? null,
      willCreateCustomRecipe: importable && !match
    };
  });
  return {
    source,
    total: items.length,
    importable: items.filter((item) => item.importable).length,
    skipped: items.filter((item) => !item.importable).length,
    items: items.slice(0, 500)
  };
}

export function runBrowserImport(
  db: Database.Database,
  deviceId: string,
  recipeLoader: RecipeLoader,
  raw: string,
  workspaceId?: string | null
): { created: number; skipped: number; source: BrowserImportPreview['source'] } {
  const preview = previewBrowserImport(raw, recipeLoader);
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
    if (item.recipeId) {
      createServiceInstance(db, deviceId, {
        recipeId: item.recipeId,
        workspaceId: targetWorkspace,
        displayName: item.title
      });
      created += 1;
      continue;
    }
    const host = hostOf(item.url);
    if (!host) {
      skipped += 1;
      continue;
    }
    const recipe = createCustomRecipe(db, deviceId, {
      name: item.title,
      category: 'Other',
      start_url: item.url,
      allowed_domains: [host, host.replace(/^www\./, '')]
    });
    createServiceInstance(db, deviceId, {
      recipeId: recipe.id,
      workspaceId: targetWorkspace,
      displayName: item.title
    });
    created += 1;
  }
  return { created, skipped, source: preview.source };
}

function parseBookmarks(raw: string): Array<{ title: string; url: string; folder: string | null }> {
  const trimmed = raw.trim();
  if (trimmed.startsWith('<') || /<A\s+HREF=/i.test(trimmed)) {
    return parseBookmarkHtml(trimmed);
  }
  try {
    return parseBookmarkJson(JSON.parse(trimmed) as unknown);
  } catch {
    return [];
  }
}

function parseBookmarkHtml(
  raw: string
): Array<{ title: string; url: string; folder: string | null }> {
  const items: Array<{ title: string; url: string; folder: string | null }> = [];
  const folderMatches = [...raw.matchAll(/<H3[^>]*>(.*?)<\/H3>/gis)].map((match) =>
    decodeHtml(match[1] ?? '')
  );
  const fallbackFolder = folderMatches[0] ?? null;
  const anchorRegex = /<A\s+[^>]*HREF=["']([^"']+)["'][^>]*>(.*?)<\/A>/gis;
  for (const match of raw.matchAll(anchorRegex)) {
    const url = decodeHtml(match[1] ?? '');
    const title = decodeHtml(stripTags(match[2] ?? '')) || url;
    items.push({
      url,
      title,
      folder: fallbackFolder
    });
  }
  return items;
}

function parseBookmarkJson(
  value: unknown,
  folder: string | null = null
): Array<{ title: string; url: string; folder: string | null }> {
  const results: Array<{ title: string; url: string; folder: string | null }> = [];
  const visit = (node: unknown, currentFolder: string | null): void => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach((child) => visit(child, currentFolder));
      return;
    }
    const record = node as Record<string, unknown>;
    const nextFolder = typeof record.name === 'string' && !record.url ? record.name : currentFolder;
    if (typeof record.url === 'string') {
      results.push({
        title: typeof record.name === 'string' ? record.name : record.url,
        url: record.url,
        folder: currentFolder
      });
    }
    for (const value of Object.values(record)) {
      visit(value, nextFolder);
    }
  };
  visit(value, folder);
  return dedupe(results);
}

function matchRecipe(catalog: RecipeCatalogItem[], url: string): RecipeCatalogItem | null {
  const host = hostOf(url);
  if (!host) return null;
  return (
    catalog.find((recipe) =>
      recipe.allowedDomains.some((domain) => host === domain || host.endsWith(`.${domain}`))
    ) ?? null
  );
}

function detectSource(raw: string): BrowserImportPreview['source'] {
  const lower = raw.slice(0, 2000).toLowerCase();
  if (lower.includes('chrome') || lower.includes('bookmark_bar')) return 'chrome';
  if (lower.includes('edge')) return 'edge';
  if (lower.includes('firefox') || lower.includes('places')) return 'firefox';
  if (lower.includes('<a ') || lower.includes('<dt>')) return 'bookmarks';
  return 'unknown';
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function isUrl(url: string): boolean {
  return Boolean(hostOf(url));
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, '');
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function dedupe<T extends { url: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });
}
