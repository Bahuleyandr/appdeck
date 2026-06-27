import type { Session } from 'electron';

// Small starter blocklist of common tracker/analytics/ad hosts. Opt-in per the tracker_block
// setting; applied per service partition. Not a full EasyList — enough to be useful out of the box.
const BLOCKED_HOSTS = [
  'google-analytics.com',
  'googletagmanager.com',
  'doubleclick.net',
  'googlesyndication.com',
  'google-analytics.l.google.com',
  'connect.facebook.net',
  'facebook.com/tr',
  'scorecardresearch.com',
  'hotjar.com',
  'mixpanel.com',
  'segment.io',
  'segment.com',
  'amplitude.com',
  'fullstory.com',
  'mouseflow.com',
  'clarity.ms',
  'branch.io',
  'adservice.google.com',
  'sentry.io',
  'bugsnag.com'
];

export class TrackerBlocker {
  private enabled = false;
  private readonly applied = new WeakSet<Session>();
  private blockedTotal = 0;
  private readonly blockedByHost = new Map<string, number>();

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  apply(session: Session): void {
    if (this.applied.has(session)) {
      return;
    }
    this.applied.add(session);
    session.webRequest.onBeforeRequest({ urls: ['*://*/*'] }, (details, callback) => {
      if (this.enabled && isBlocked(details.url)) {
        this.recordBlocked(details.url);
        callback({ cancel: true });
        return;
      }
      callback({});
    });
  }

  stats(): {
    enabled: boolean;
    blockedTotal: number;
    topHosts: Array<{ host: string; count: number }>;
  } {
    return {
      enabled: this.enabled,
      blockedTotal: this.blockedTotal,
      topHosts: [...this.blockedByHost.entries()]
        .map(([host, count]) => ({ host, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
    };
  }

  private recordBlocked(url: string): void {
    this.blockedTotal += 1;
    let host = 'unknown';
    try {
      host = new URL(url).hostname;
    } catch {
      // Keep the aggregate even if parsing fails.
    }
    this.blockedByHost.set(host, (this.blockedByHost.get(host) ?? 0) + 1);
  }
}

function isBlocked(url: string): boolean {
  let host: string;
  try {
    const parsed = new URL(url);
    host = parsed.hostname;
    return BLOCKED_HOSTS.some((blocked) => {
      if (blocked.includes('/')) {
        return `${host}${parsed.pathname}`.includes(blocked);
      }
      return host === blocked || host.endsWith(`.${blocked}`);
    });
  } catch {
    return false;
  }
}
