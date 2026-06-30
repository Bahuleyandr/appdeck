import { BrowserWindow, Notification } from 'electron';
import type Database from 'better-sqlite3';
import type { FocusRules } from '../../shared/types.js';
import { getServiceInstance } from '../db/repositories/serviceInstances.js';
import { getWorkspace } from '../db/repositories/workspaces.js';
import { listWorkspaceServices } from '../db/repositories/workspaceServices.js';

export const NOTIFICATION_TOAST_DEDUP_MS = 30_000;
export const NOTIFICATION_BURST_WINDOW_MS = 8_000;

interface NotificationInput {
  instanceId: string;
  title: string;
  body?: string;
  icon?: string;
}

interface BurstState {
  lastShownAt: number;
  suppressed: number;
  latest: NotificationInput | null;
  timer: NodeJS.Timeout | null;
}

export class NotificationService {
  private readonly recentToastKeys = new Map<string, number>();
  private readonly bursts = new Map<string, BurstState>();

  constructor(
    private readonly db: Database.Database,
    private readonly windowProvider: () => BrowserWindow | null,
    private readonly onClick: (instanceId: string) => void,
    private readonly isGlobalDnd: () => boolean = () => false
  ) {}

  /** Whether an OS notification should be shown for this instance right now. */
  shouldNotify(instanceId: string): boolean {
    if (this.isGlobalDnd()) {
      return false;
    }
    const instance = getServiceInstance(this.db, instanceId);
    if (!instance || instance.muted) {
      return false;
    }
    return !this.isWorkspaceDnd(instanceId);
  }

  show(input: NotificationInput): void {
    if (!this.shouldNotify(input.instanceId)) {
      return;
    }
    if (!Notification.isSupported()) {
      return;
    }
    const now = Date.now();
    this.pruneRecentToastKeys(now);
    const key = toastKey(input);
    const lastDuplicateAt = this.recentToastKeys.get(key);
    if (lastDuplicateAt !== undefined && now - lastDuplicateAt < NOTIFICATION_TOAST_DEDUP_MS) {
      return;
    }
    this.recentToastKeys.set(key, now);

    const burst = this.bursts.get(input.instanceId);
    if (burst && now - burst.lastShownAt < NOTIFICATION_BURST_WINDOW_MS) {
      burst.suppressed += 1;
      burst.latest = input;
      if (!burst.timer) {
        const remaining = NOTIFICATION_BURST_WINDOW_MS - (now - burst.lastShownAt);
        burst.timer = setTimeout(() => this.flushBurst(input.instanceId), remaining);
        burst.timer.unref?.();
      }
      return;
    }

    this.showToast(input);
    this.bursts.set(input.instanceId, {
      lastShownAt: now,
      suppressed: 0,
      latest: null,
      timer: null
    });
  }

  dispose(): void {
    for (const burst of this.bursts.values()) {
      if (burst.timer) {
        clearTimeout(burst.timer);
      }
    }
    this.bursts.clear();
    this.recentToastKeys.clear();
  }

  private showToast(input: NotificationInput, suppressedCount = 0): void {
    const serviceName = this.serviceName(input.instanceId);
    const notification = new Notification({
      title:
        suppressedCount > 0
          ? `${serviceName} · ${suppressedCount} more notification${suppressedCount === 1 ? '' : 's'}`
          : `${serviceName} · ${input.title || 'Notification'}`,
      body: suppressedCount > 0 ? notificationSummaryBody(input) : (input.body ?? ''),
      icon: input.icon
    });
    notification.on('click', () => {
      this.windowProvider()?.show();
      this.onClick(input.instanceId);
    });
    notification.show();
  }

  private flushBurst(instanceId: string): void {
    const burst = this.bursts.get(instanceId);
    if (!burst) {
      return;
    }
    burst.timer = null;
    if (!burst.latest || burst.suppressed <= 0) {
      return;
    }
    const latest = burst.latest;
    const suppressed = burst.suppressed;
    burst.latest = null;
    burst.suppressed = 0;
    if (!this.shouldNotify(instanceId) || !Notification.isSupported()) {
      return;
    }
    this.showToast(latest, suppressed);
    burst.lastShownAt = Date.now();
  }

  private serviceName(instanceId: string): string {
    return getServiceInstance(this.db, instanceId)?.display_name || 'AppDeck';
  }

  private pruneRecentToastKeys(now: number): void {
    for (const [key, lastSeenAt] of this.recentToastKeys.entries()) {
      if (now - lastSeenAt >= NOTIFICATION_TOAST_DEDUP_MS) {
        this.recentToastKeys.delete(key);
      }
    }
  }

  private isWorkspaceDnd(instanceId: string): boolean {
    const memberships = listWorkspaceServices(this.db).filter((membership) => membership.service_instance_id === instanceId);
    return memberships.some((membership) => {
      const workspace = getWorkspace(this.db, membership.workspace_id);
      if (!workspace) {
        return false;
      }
      return workspace.focus_rules.dnd === true || isWithinSchedule(workspace.focus_rules);
    });
  }
}

function toastKey(input: NotificationInput): string {
  return `${input.instanceId}\u0000${input.title}\u0000${input.body ?? ''}`;
}

function notificationSummaryBody(input: NotificationInput): string {
  const title = input.title.trim();
  const body = input.body?.trim() ?? '';
  if (title && body) {
    return `${title}: ${body}`;
  }
  return body || title || 'Open AppDeck to review.';
}

// Evaluate focus_rules.schedule windows against the current local time.
function isWithinSchedule(rules: FocusRules): boolean {
  if (!rules.schedule?.length) {
    return false;
  }
  const now = new Date();
  const day = now.getDay();
  const minutes = now.getHours() * 60 + now.getMinutes();
  return rules.schedule.some((window) => {
    if (!window.days.includes(day)) {
      return false;
    }
    const from = toMinutes(window.from);
    const to = toMinutes(window.to);
    if (from === null || to === null) {
      return false;
    }
    return from <= to ? minutes >= from && minutes < to : minutes >= from || minutes < to;
  });
}

function toMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) {
    return null;
  }
  return Number(match[1]) * 60 + Number(match[2]);
}
