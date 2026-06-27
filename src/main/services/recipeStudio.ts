import type Database from 'better-sqlite3';
import type {
  RecipeRegistryEntry,
  RecipeStudioAnalysis,
  ServiceCategory
} from '../../shared/types.js';
import { upsertRecipeRegistryEntry } from '../db/repositories/recipeRegistry.js';

export function analyzeRecipeDraft(input: {
  name: string;
  url: string;
  category?: ServiceCategory;
}): RecipeStudioAnalysis {
  const issues: string[] = [];
  const suggestions: string[] = [];
  const host = hostOf(input.url);
  if (!host) issues.push('Start URL is invalid.');
  if (input.name.trim().length < 2) issues.push('Name is too short.');
  const aliases = aliasSuggestions(input.name, host);
  if (host) suggestions.push(`Allow ${host} and ${host.replace(/^www\./, '')}.`);
  suggestions.push('Add an unread title regex only after testing the service title behavior.');
  suggestions.push('Use mobile mode for chat apps with responsive mobile layouts.');
  return {
    valid: issues.length === 0,
    recipe: {
      id: `user-${slug(input.name)}`,
      name: input.name.trim(),
      category: input.category ?? inferCategory(input.name, input.url),
      start_url: input.url,
      allowed_domains: host ? [host, host.replace(/^www\./, '')] : [],
      aliases,
      source: 'user'
    },
    issues,
    suggestions
  };
}

export function createRecipeFromStudio(
  db: Database.Database,
  input: {
    name: string;
    url: string;
    category: ServiceCategory;
    aliases?: string[];
    mobileMode?: boolean;
  }
): RecipeRegistryEntry {
  const analysis = analyzeRecipeDraft({
    name: input.name,
    url: input.url,
    category: input.category
  });
  if (!analysis.valid) {
    throw new Error(analysis.issues.join('\n'));
  }
  return upsertRecipeRegistryEntry(db, {
    name: input.name.trim(),
    category: input.category,
    start_url: input.url,
    allowed_domains: analysis.recipe.allowed_domains ?? [],
    aliases: input.aliases ?? analysis.recipe.aliases ?? [],
    mobile_mode: input.mobileMode ?? false,
    source: 'user'
  });
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function inferCategory(name: string, url: string): ServiceCategory {
  const text = `${name} ${url}`.toLowerCase();
  if (/(mail|gmail|outlook|inbox)/.test(text)) return 'Email';
  if (/(chat|slack|discord|telegram|whatsapp|signal)/.test(text)) return 'Chat';
  if (/(github|gitlab|sentry|cloudflare|vercel|dev)/.test(text)) return 'Dev';
  if (/(ai|gpt|claude|gemini|ollama|perplexity)/.test(text)) return 'AI';
  if (/(youtube|spotify|netflix|media)/.test(text)) return 'Media';
  return 'Productivity';
}

function aliasSuggestions(name: string, host: string | null): string[] {
  const aliases = new Set<string>();
  aliases.add(name.toLowerCase());
  if (host) {
    aliases.add(host.replace(/^www\./, '').split('.')[0] ?? host);
  }
  return [...aliases].filter(Boolean);
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
