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

export async function analyzeRecipeDraftLive(
  input: {
    name: string;
    url: string;
    category?: ServiceCategory;
  },
  fetcher: typeof fetch = fetch
): Promise<RecipeStudioAnalysis> {
  const analysis = analyzeRecipeDraft(input);
  if (!analysis.valid) return analysis;
  try {
    const response = await fetcher(input.url, {
      headers: {
        'user-agent': 'AppDeck Recipe Studio'
      }
    });
    const contentType = response.headers.get('content-type') ?? '';
    if (!response.ok || !contentType.includes('text/html')) {
      analysis.suggestions.push(`Live test returned HTTP ${response.status}.`);
      return analysis;
    }
    const html = await response.text();
    const pageTitle = tagContent(html, 'title');
    const icon = absolutizeUrl(
      attrFromFirstTag(html, 'link', 'href', (tag) => /\b(?:icon|apple-touch-icon)\b/i.test(tag)),
      input.url
    );
    const manifest = absolutizeUrl(
      attrFromFirstTag(html, 'link', 'href', (tag) => /\bmanifest\b/i.test(tag)),
      input.url
    );
    const domains = new Set(analysis.recipe.allowed_domains ?? []);
    for (const href of linkHrefs(html)) {
      const host = hostOf(absolutizeUrl(href, input.url) ?? '');
      if (host && /(login|auth|account|sso|oauth|id\.)/i.test(href)) {
        domains.add(host);
      }
    }
    if (manifest) {
      const manifestHost = hostOf(manifest);
      if (manifestHost) domains.add(manifestHost);
    }
    const unreadSelector = detectUnreadSelector(html);
    analysis.recipe = {
      ...analysis.recipe,
      name: pageTitle || analysis.recipe.name,
      icon: icon ?? analysis.recipe.icon,
      allowed_domains: [...domains],
      mobile_mode: /<meta[^>]+name=["']viewport["']/i.test(html),
      unread_spec: unreadSelector ? { selector: unreadSelector } : analysis.recipe.unread_spec
    };
    if (manifest) analysis.suggestions.push(`Manifest detected at ${manifest}.`);
    if (/Notification\.requestPermission|new Notification|serviceWorker\.register/i.test(html)) {
      analysis.suggestions.push('Page appears to use notifications or service workers.');
    }
    if (unreadSelector) {
      analysis.suggestions.push(`Unread selector candidate: ${unreadSelector}.`);
    }
    analysis.suggestions.push('Live page fetched successfully.');
    return analysis;
  } catch (error) {
    analysis.suggestions.push(
      `Live detection failed: ${error instanceof Error ? error.message : 'unknown error'}.`
    );
    return analysis;
  }
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

function tagContent(html: string, tagName: string): string | null {
  const match = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, 'i').exec(html);
  return match?.[1]?.replace(/\s+/g, ' ').trim() || null;
}

function attrFromFirstTag(
  html: string,
  tagName: string,
  attr: string,
  predicate: (tag: string) => boolean
): string | null {
  const tags = html.match(new RegExp(`<${tagName}\\b[^>]*>`, 'gi')) ?? [];
  for (const tag of tags) {
    if (!predicate(tag)) continue;
    const value = attrValue(tag, attr);
    if (value) return value;
  }
  return null;
}

function linkHrefs(html: string): string[] {
  return (html.match(/<a\b[^>]*>/gi) ?? []).map((tag) => attrValue(tag, 'href')).filter(Boolean);
}

function attrValue(tag: string, attr: string): string {
  const match = new RegExp(`${attr}\\s*=\\s*["']([^"']+)["']`, 'i').exec(tag);
  return match?.[1]?.trim() ?? '';
}

function absolutizeUrl(value: string | null, base: string): string | null {
  if (!value) return null;
  try {
    return new URL(value, base).toString();
  } catch {
    return null;
  }
}

function detectUnreadSelector(html: string): string | null {
  const classAttrMatch = /\bclass=["']([^"']*(?:unread|badge|count)[^"']*)["']/i.exec(html);
  const classToken = classAttrMatch?.[1]
    ?.split(/\s+/)
    .find((token) => /unread|badge|count/i.test(token));
  if (classToken) return `.${classToken}`;
  const idMatch = /\bid=["']([^"']*(?:unread|badge|count)[^"']*)["']/i.exec(html);
  return idMatch?.[1] ? `#${idMatch[1]}` : null;
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
