import { shell } from 'electron';
import type Database from 'better-sqlite3';
import { listServiceInstances } from '../db/repositories/serviceInstances.js';
import { listLinkRules, matchLinkRule } from '../db/repositories/linkRules.js';
import type { RecipeLoader } from '../recipes/loader.js';
import type { ServiceViewManager } from '../views/serviceViewManager.js';

export type PushSender = (channel: string, payload?: unknown) => void;

/**
 * Routes an inbound URL (from the OS, via the appdeck:// protocol or a captured external link)
 * to the matching logged-in service instance, instead of a stray browser window.
 */
export class LinkRouter {
  constructor(
    private readonly db: Database.Database,
    private readonly recipeLoader: RecipeLoader,
    private readonly viewManager: ServiceViewManager,
    private readonly sendPush: PushSender
  ) {}

  /** Returns true if the URL was routed into a service, false if opened externally. */
  route(rawUrl: string): boolean {
    const target = normalizeIncoming(rawUrl);
    if (!target) {
      return false;
    }
    const ruleTarget = this.matchRule(target);
    if (ruleTarget === 'external') {
      void shell.openExternal(target);
      return false;
    }
    if (ruleTarget) {
      this.routeTo(ruleTarget, target);
      return true;
    }
    const instanceId = this.match(target);
    if (!instanceId) {
      void shell.openExternal(target);
      return false;
    }
    this.routeTo(instanceId, target);
    return true;
  }

  private routeTo(instanceId: string, target: string): void {
    this.viewManager.routeNavigate(instanceId, target);
    this.viewManager.focus(instanceId);
    this.sendPush('event:notification-clicked', { instanceId });
  }

  private matchRule(url: string): string | 'external' | null {
    const rule = matchLinkRule(listLinkRules(this.db), url);
    if (!rule) return null;
    if (rule.target_type === 'external') return 'external';
    const services = listServiceInstances(this.db);
    if (rule.target_type === 'service') return rule.target_id;
    if (rule.target_type === 'profile') {
      return services.find((service) => service.profile_id === rule.target_id)?.id ?? null;
    }
    if (rule.target_type === 'workspace') {
      return rule.target_id ? (listServiceInstances(this.db, rule.target_id)[0]?.id ?? null) : null;
    }
    return null;
  }

  private match(url: string): string | null {
    let host: string;
    try {
      host = new URL(url).hostname;
    } catch {
      return null;
    }
    for (const instance of listServiceInstances(this.db)) {
      let resolved;
      try {
        resolved = this.recipeLoader.resolveForInstance(instance);
      } catch {
        continue;
      }
      const matches = resolved.allowedDomains.some(
        (domain) => host === domain || host.endsWith(`.${domain}`)
      );
      if (matches && !resolved.isLauncherOnly) {
        return instance.id;
      }
    }
    return null;
  }
}

// Strip our own protocol wrapper if present (appdeck://open?url=...) and accept bare https URLs.
function normalizeIncoming(raw: string): string | null {
  try {
    const parsed = new URL(raw);
    if (parsed.protocol === 'appdeck:') {
      const inner = parsed.searchParams.get('url');
      return inner && /^https?:$/.test(new URL(inner).protocol) ? inner : null;
    }
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return raw;
    }
    return null;
  } catch {
    return null;
  }
}
