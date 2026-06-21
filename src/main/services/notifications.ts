import { BrowserWindow, Notification } from 'electron';
import type Database from 'better-sqlite3';
import type { FocusRules } from '../../shared/types.js';
import { getServiceInstance } from '../db/repositories/serviceInstances.js';
import { getWorkspace } from '../db/repositories/workspaces.js';
import { listWorkspaceServices } from '../db/repositories/workspaceServices.js';

export class NotificationService {
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

  show(input: { instanceId: string; title: string; body?: string; icon?: string }): void {
    if (!this.shouldNotify(input.instanceId)) {
      return;
    }
    if (!Notification.isSupported()) {
      return;
    }
    const notification = new Notification({ title: input.title, body: input.body, icon: input.icon });
    notification.on('click', () => {
      this.windowProvider()?.show();
      this.onClick(input.instanceId);
    });
    notification.show();
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
