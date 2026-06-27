import type Database from 'better-sqlite3';
import type { LocalExtensionTemplate } from '../../shared/types.js';
import { getMeta, setMeta } from '../db/repositories/meta.js';

export function listLocalExtensionTemplates(): LocalExtensionTemplate[] {
  return [
    {
      id: 'dark-mode',
      name: 'Dark Mode Injector',
      description: 'Per-service CSS darkening hook for sites without a native dark theme.',
      category: 'appearance',
      enabledByDefault: false,
      capabilities: ['custom_css', 'per_service_toggle']
    },
    {
      id: 'reader-mode',
      name: 'Reader Mode',
      description: 'Clean reading surface for long docs, blogs, and knowledge-base pages.',
      category: 'reading',
      enabledByDefault: false,
      capabilities: ['page_action', 'content_simplification']
    },
    {
      id: 'request-blocker',
      name: 'Request Blocker',
      description: 'Local block rules for trackers, pixels, embeds, and noisy resources.',
      category: 'privacy',
      enabledByDefault: true,
      capabilities: ['privacy_firewall', 'tracker_stats']
    },
    {
      id: 'css-js-snippets',
      name: 'CSS and JS Snippets',
      description: 'Reusable snippets for app-specific tweaks without editing recipes.',
      category: 'developer',
      enabledByDefault: false,
      capabilities: ['custom_css', 'custom_js', 'recipe_studio']
    },
    {
      id: 'user-agent-switcher',
      name: 'User-Agent Switcher',
      description: 'Switch desktop/mobile user agents per service for responsive web apps.',
      category: 'workflow',
      enabledByDefault: false,
      capabilities: ['user_agent', 'mobile_mode']
    },
    {
      id: 'cookie-tools',
      name: 'Cookie Tools',
      description: 'Inspect and clear service storage without leaving AppDeck.',
      category: 'privacy',
      enabledByDefault: false,
      capabilities: ['clear_storage', 'permission_manager']
    }
  ];
}

export function applyLocalExtensionTemplate(
  db: Database.Database,
  templateId: string
): LocalExtensionTemplate {
  const template = listLocalExtensionTemplates().find((candidate) => candidate.id === templateId);
  if (!template) throw new Error('Extension template not found');
  setMeta(db, `extension_pack_${template.id}`, 'true');
  return template;
}

export function extensionRuntimeForDb(db: Database.Database): { css: string; js: string } {
  const enabled = (id: string): boolean => getMeta(db, `extension_pack_${id}`) === 'true';
  const css: string[] = [];
  const js: string[] = [];
  if (enabled('dark-mode')) {
    css.push(DARK_MODE_CSS);
  }
  if (enabled('reader-mode')) {
    js.push(READER_MODE_JS);
  }
  if (enabled('css-js-snippets')) {
    js.push(SNIPPET_RUNTIME_JS);
  }
  if (enabled('cookie-tools')) {
    js.push(STORAGE_TOOLS_JS);
  }
  if (enabled('request-blocker')) {
    js.push('window.__appdeckRequestBlocker = true;');
  }
  if (enabled('user-agent-switcher')) {
    js.push('window.__appdeckUserAgentSwitcher = true;');
  }
  return { css: css.join('\n'), js: js.join('\n') };
}

const DARK_MODE_CSS = `
:root { color-scheme: dark; }
html.appdeck-force-dark, html:not(.light) {
  background: #0f172a !important;
}
html.appdeck-force-dark body {
  filter: none !important;
  background: #0f172a !important;
}
`;

const READER_MODE_JS = `
(() => {
  if (window.__appdeckReaderMode) return;
  window.__appdeckReaderMode = () => {
    const article = document.querySelector('article, main, [role="main"]') || document.body;
    const clone = article.cloneNode(true);
    clone.querySelectorAll('script, style, nav, aside, iframe, form').forEach((node) => node.remove());
    document.body.replaceChildren(clone);
    document.body.style.maxWidth = '860px';
    document.body.style.margin = '32px auto';
    document.body.style.lineHeight = '1.7';
  };
})();
`;

const SNIPPET_RUNTIME_JS = `
(() => {
  window.__appdeckRunSnippet = (code) => {
    if (typeof code !== 'string' || code.length > 20000) return false;
    Function('"use strict";' + code)();
    return true;
  };
})();
`;

const STORAGE_TOOLS_JS = `
(() => {
  window.__appdeckClearStorage = async () => {
    localStorage.clear();
    sessionStorage.clear();
    if (window.caches) {
      for (const key of await caches.keys()) await caches.delete(key);
    }
    return true;
  };
})();
`;
