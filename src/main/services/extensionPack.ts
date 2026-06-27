import type Database from 'better-sqlite3';
import type { LocalExtensionTemplate } from '../../shared/types.js';
import { setMeta } from '../db/repositories/meta.js';

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
