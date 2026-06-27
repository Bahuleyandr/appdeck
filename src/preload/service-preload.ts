import { ipcRenderer } from 'electron';
import type {
  DeclarativeUnreadSpec,
  ResolvedRecipeForInstance,
  UnreadCount
} from '../shared/types.js';
import { execUnreadRegex } from './unread.js';

const instanceId = process.argv
  .find((arg) => arg.startsWith('--appdeck-instance='))
  ?.replace('--appdeck-instance=', '');

if (!instanceId) {
  throw new Error('Missing AppDeck service instance id');
}
const serviceInstanceId = instanceId;

let lastCount: UnreadCount = { direct: 0, indirect: 0 };

void bootstrap();

async function bootstrap(): Promise<void> {
  const resolved = (await ipcRenderer.invoke('recipe:resolveForInstance', {
    instanceId: serviceInstanceId
  })) as ResolvedRecipeForInstance;
  forwardMainWorldNotifications(serviceInstanceId);
  const report = (): void => {
    const count = readUnread(resolved);
    if (count.direct !== lastCount.direct || count.indirect !== lastCount.indirect) {
      lastCount = count;
      void ipcRenderer.invoke('unread:report', { instanceId: serviceInstanceId, count });
    }
  };
  // Coalesce mutation bursts — busy apps (Slack, WhatsApp) mutate the DOM constantly.
  let scheduled = false;
  const scheduleReport = (): void => {
    if (scheduled) return;
    scheduled = true;
    window.setTimeout(() => {
      scheduled = false;
      report();
    }, 800);
  };
  window.addEventListener('focus', () => report());
  window.addEventListener('load', () => report());
  const observer = new MutationObserver(scheduleReport);
  const attachObserver = (): void => {
    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    }
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attachObserver, { once: true });
  } else {
    attachObserver();
  }
  window.setInterval(report, resolved.pollIntervalMs);
}

// The Notification shim runs in the page's main world (injected by the main process) and posts
// each notification here; forward it to the main process, where mute/DND is applied.
function forwardMainWorldNotifications(id: string): void {
  window.addEventListener('message', (event: MessageEvent) => {
    const data = event.data as {
      __appdeck?: string;
      title?: string;
      body?: string;
      icon?: string;
    } | null;
    if (data && data.__appdeck === 'notify') {
      void ipcRenderer.invoke('notify:incoming', {
        instanceId: id,
        title: data.title ?? '',
        body: data.body ?? '',
        icon: data.icon ?? ''
      });
    }
  });
}

function readUnread(resolved: ResolvedRecipeForInstance): UnreadCount {
  if (resolved.unreadSpec) {
    return readDeclarative(resolved.unreadSpec);
  }
  switch (resolved.builtinUnreadId) {
    case 'whatsapp':
    case 'messenger':
      return readTitleLeadingCount();
    case 'gmail':
      return readGmail();
    case 'telegram':
      return readDomCounters(['.badge', '.counter', '[class*="unread"]']);
    case 'slack':
      return readDomCounters(
        ['[data-qa*="mention"]', '[class*="mention"]'],
        readTitleLeadingCount().direct
      );
    case 'discord':
      return readDomCounters(
        ['[class*="numberBadge"]', '[class*="mentionsBadge"]'],
        readTitleLeadingCount().direct
      );
    default:
      return { direct: 0, indirect: 0 };
  }
}

function readDeclarative(spec: DeclarativeUnreadSpec): UnreadCount {
  if (spec.titleRegex) {
    const match = execUnreadRegex(spec.titleRegex, document.title);
    return { direct: match?.[1] ? Number(match[1]) : 0, indirect: 0 };
  }
  if (!spec.selector) {
    return { direct: 0, indirect: 0 };
  }
  const node = document.querySelector(spec.selector);
  const raw = spec.read === 'attr' && spec.attr ? node?.getAttribute(spec.attr) : node?.textContent;
  if (!raw) {
    return { direct: 0, indirect: 0 };
  }
  const match = spec.regex ? execUnreadRegex(spec.regex, raw) : execUnreadRegex('(\\d+)', raw);
  return { direct: match?.[1] ? Number(match[1]) : 0, indirect: 0 };
}

function readTitleLeadingCount(): UnreadCount {
  const match = /^\((\d+)\)/.exec(document.title);
  return { direct: match ? Number(match[1]) : 0, indirect: 0 };
}

function readGmail(): UnreadCount {
  const match = /Inbox \((\d+)\)/.exec(document.title) ?? /^\((\d+)\)/.exec(document.title);
  return { direct: match ? Number(match[1]) : 0, indirect: 0 };
}

function readDomCounters(selectors: string[], fallback = 0): UnreadCount {
  const total = selectors
    .flatMap((selector) => Array.from(document.querySelectorAll(selector)))
    .reduce((sum, node) => {
      const parsed = Number((node.textContent ?? '').replace(/\D/g, ''));
      return Number.isFinite(parsed) ? sum + parsed : sum;
    }, 0);
  return { direct: total || fallback, indirect: 0 };
}
