import type Database from 'better-sqlite3';
import type { Recipe, RecipeCatalogItem, ResolvedRecipeForInstance } from './types.js';
import type { RecipeRegistryEntry, ServiceInstance } from '../../shared/types.js';
import { listCustomRecipes } from '../db/repositories/customRecipes.js';
import { getServiceInstance } from '../db/repositories/serviceInstances.js';
import {
  getRecipeRegistryEntry,
  listRecipeRegistryEntries
} from '../db/repositories/recipeRegistry.js';
import { builtinRecipes } from './builtin/index.js';

export class RecipeLoader {
  private readonly builtin = new Map<string, Recipe>(
    builtinRecipes.map((recipe) => [recipe.id, recipe])
  );

  constructor(private readonly db: Database.Database) {}

  getBuiltinRecipe(id: string): Recipe | null {
    return this.builtin.get(id) ?? null;
  }

  catalog(): RecipeCatalogItem[] {
    const builtin = [...this.builtin.values()].map<RecipeCatalogItem>((recipe) => ({
      id: recipe.id,
      name: recipe.name,
      category: recipe.category,
      startUrl: recipe.isLauncherOnly ? null : recipe.startUrl,
      allowedDomains: recipe.allowedDomains,
      defaultUserAgent: recipe.defaultUserAgent,
      isLauncherOnly: recipe.isLauncherOnly,
      launcherHint: recipe.launcherHint,
      source: 'builtin'
    }));
    const custom = listCustomRecipes(this.db).map<RecipeCatalogItem>((recipe) => ({
      id: recipe.id,
      name: recipe.name,
      category: recipe.category,
      startUrl: recipe.start_url,
      allowedDomains: recipe.allowed_domains,
      defaultUserAgent: recipe.default_user_agent ?? undefined,
      unreadSpec: recipe.unread_spec,
      source: 'custom'
    }));
    const existingNames = new Set([...builtin, ...custom].map((recipe) => normalizeName(recipe.name)));
    const existingUrls = new Set(
      [...builtin, ...custom]
        .map((recipe) => normalizeUrl(recipe.startUrl))
        .filter((url): url is string => Boolean(url))
    );
    const registry = compactRegistryCatalog(
      listRecipeRegistryEntries(this.db, '', 5000),
      existingNames,
      existingUrls
    ).map<RecipeCatalogItem>((recipe) => ({
      id: recipe.id,
      name: recipe.name,
      category: recipe.category,
      startUrl: recipe.start_url,
      allowedDomains: recipe.allowed_domains,
      aliases: recipe.aliases,
      icon: recipe.icon,
      iconPath: recipe.icon_path,
      defaultUserAgent: recipe.default_user_agent ?? undefined,
      unreadSpec: recipe.unread_spec,
      mobileMode: recipe.mobile_mode,
      source: 'registry'
    }));
    return [...builtin, ...custom, ...registry].sort((a, b) => a.name.localeCompare(b.name));
  }

  resolveForInstance(instanceOrId: ServiceInstance | string): ResolvedRecipeForInstance {
    const instance =
      typeof instanceOrId === 'string' ? getServiceInstance(this.db, instanceOrId) : instanceOrId;
    if (!instance) {
      throw new Error(`Service instance not found: ${instanceOrId}`);
    }
    const builtin = this.builtin.get(instance.recipe_id);
    if (builtin) {
      return {
        instanceId: instance.id,
        recipeId: builtin.id,
        startUrl: builtin.isLauncherOnly ? null : builtin.startUrl,
        allowedDomains: builtin.allowedDomains,
        defaultUserAgent: instance.user_agent ?? builtin.defaultUserAgent,
        builtinUnreadId: builtin.getUnread ? builtin.id : undefined,
        unreadSpec: builtin.unread,
        pollIntervalMs: builtin.pollIntervalMs ?? 4000,
        isLauncherOnly: Boolean(builtin.isLauncherOnly),
        mobileMode: false,
        customCss: instance.custom_css,
        customJs: instance.custom_js
      };
    }
    const custom = listCustomRecipes(this.db, true).find(
      (recipe) => recipe.id === instance.recipe_id && !recipe.deleted_at
    );
    if (!custom) {
      const registry = getRecipeRegistryEntry(this.db, instance.recipe_id);
      if (!registry) {
        throw new Error(`Recipe not found: ${instance.recipe_id}`);
      }
      return {
        instanceId: instance.id,
        recipeId: registry.id,
        startUrl: registry.start_url,
        allowedDomains: registry.allowed_domains,
        defaultUserAgent: instance.user_agent ?? registry.default_user_agent ?? undefined,
        unreadSpec: registry.unread_spec,
        pollIntervalMs: 4000,
        isLauncherOnly: false,
        mobileMode: registry.mobile_mode,
        customCss: instance.custom_css,
        customJs: instance.custom_js
      };
    }
    return {
      instanceId: instance.id,
      recipeId: custom.id,
      startUrl: custom.start_url,
      allowedDomains: custom.allowed_domains,
      defaultUserAgent: instance.user_agent ?? custom.default_user_agent ?? undefined,
      unreadSpec: custom.unread_spec,
      pollIntervalMs: 4000,
      isLauncherOnly: false,
      mobileMode: custom.mobile_mode,
      customCss: instance.custom_css,
      customJs: instance.custom_js
    };
  }
}

const SYNTHETIC_SEED_VARIANTS = new Set([
  'inbox',
  'admin',
  'dashboard',
  'console',
  'workspace',
  'personal',
  'business',
  'team',
  'support',
  'docs',
  'calendar',
  'tasks',
  'reports',
  'analytics',
  'mobile',
  'lite',
  'portal'
]);

function compactRegistryCatalog(
  entries: RecipeRegistryEntry[],
  existingNames: Set<string>,
  existingUrls: Set<string>
): RecipeRegistryEntry[] {
  const visible: RecipeRegistryEntry[] = [];
  const seenNames = new Set(existingNames);
  const seenSeedUrls = new Set(existingUrls);

  for (const entry of entries) {
    const nameKey = normalizeName(entry.name);
    const urlKey = normalizeUrl(entry.start_url);
    if (seenNames.has(nameKey)) continue;
    if (entry.source === 'seed' && isSyntheticSeedVariant(entry)) continue;
    if (entry.source === 'seed' && urlKey && seenSeedUrls.has(urlKey)) continue;

    visible.push(entry);
    seenNames.add(nameKey);
    if (entry.source === 'seed' && urlKey) {
      seenSeedUrls.add(urlKey);
    }
  }

  return visible;
}

function isSyntheticSeedVariant(entry: RecipeRegistryEntry): boolean {
  if (entry.source !== 'seed') return false;
  const name = normalizeName(entry.name);
  return entry.aliases.some((alias) => {
    const variant = normalizeName(alias);
    return SYNTHETIC_SEED_VARIANTS.has(variant) && name.endsWith(` ${variant}`);
  });
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizeUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname.replace(/\/+$/g, '')}`.toLowerCase();
  } catch {
    return value.trim().toLowerCase().replace(/\/+$/g, '');
  }
}
