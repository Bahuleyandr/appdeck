import type Database from 'better-sqlite3';
import type { FerdiumImportResult } from '../../shared/types.js';
import { createCustomRecipe } from '../db/repositories/customRecipes.js';
import { createServiceInstance } from '../db/repositories/serviceInstances.js';
import { listWorkspaces } from '../db/repositories/workspaces.js';
import type { RecipeLoader } from '../recipes/loader.js';

export interface FerdiumService {
  recipeId: string;
  name: string;
  url?: string;
}

// Ferdium / Franz / Ferdi exports vary in shape — accept the common ones: a bare array, or an
// object with a `services` array (optionally nested under `data`).
export function parseFerdiumServices(raw: string): FerdiumService[] {
  const json = JSON.parse(raw) as unknown;
  const container = json as { services?: unknown; data?: { services?: unknown } };
  const nested = container.data?.services;
  const services = Array.isArray(json)
    ? json
    : Array.isArray(container.services)
      ? container.services
      : Array.isArray(nested)
        ? nested
        : [];
  return (services as Array<Record<string, unknown>>)
    .map((service) => {
      const settings = (service.settings ?? {}) as Record<string, unknown>;
      const url = (service.customUrl ?? settings.customUrl ?? service.url) as string | undefined;
      return {
        recipeId: String(service.recipeId ?? service.recipe ?? ''),
        name: String(service.name ?? service.recipeId ?? 'Service'),
        url: typeof url === 'string' ? url : undefined
      };
    })
    .filter((service) => service.recipeId || service.url);
}

export function importFerdium(
  db: Database.Database,
  deviceId: string,
  recipeLoader: RecipeLoader,
  raw: string,
  workspaceId?: string
): FerdiumImportResult {
  const targetWorkspace = workspaceId ?? listWorkspaces(db)[0]?.id;
  if (!targetWorkspace) {
    throw new Error('No workspace to import into');
  }
  let created = 0;
  let skipped = 0;
  for (const service of parseFerdiumServices(raw)) {
    const builtin = recipeLoader.getBuiltinRecipe(service.recipeId);
    if (builtin) {
      createServiceInstance(db, deviceId, { recipeId: builtin.id, workspaceId: targetWorkspace, displayName: service.name });
      created += 1;
      continue;
    }
    const host = service.url ? hostOf(service.url) : null;
    if (service.url && host) {
      const recipe = createCustomRecipe(db, deviceId, {
        name: service.name,
        category: 'Other',
        start_url: service.url,
        allowed_domains: [host]
      });
      createServiceInstance(db, deviceId, { recipeId: recipe.id, workspaceId: targetWorkspace, displayName: service.name });
      created += 1;
      continue;
    }
    skipped += 1;
  }
  return { created, skipped };
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}
