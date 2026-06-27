import type Database from 'better-sqlite3';
import type { AutomationAction, AutomationRule, UnreadCount } from '../../shared/types.js';
import {
  listAutomations,
  markAutomationRun,
  testAutomation
} from '../db/repositories/automations.js';
import { createTask } from '../db/repositories/tasks.js';

export interface AutomationRuntimeDeps {
  db: Database.Database;
  viewManager: {
    sleep(instanceId: string): void;
    wake(instanceId: string): void;
    focus(instanceId: string): void;
  };
  sendPush: (channel: string, payload?: unknown) => void;
  sendDataChanged: () => void;
}

export interface AutomationRunSummary {
  ran: number;
  actionCount: number;
}

export class AutomationRuntime {
  private scheduleTimer: NodeJS.Timeout | null = null;

  constructor(private readonly deps: AutomationRuntimeDeps) {}

  start(): void {
    this.handleStartup();
    this.scheduleTimer = setInterval(() => this.handleSchedule(), 60_000);
    this.scheduleTimer.unref();
  }

  dispose(): void {
    if (this.scheduleTimer) {
      clearInterval(this.scheduleTimer);
      this.scheduleTimer = null;
    }
  }

  handleStartup(): AutomationRunSummary {
    return this.run({ event: 'startup' });
  }

  handleSchedule(now = Date.now()): AutomationRunSummary {
    return this.run({ event: 'schedule', now });
  }

  handleNotification(input: {
    instanceId: string;
    title: string;
    body?: string;
  }): AutomationRunSummary {
    return this.run({
      event: 'notification',
      serviceId: input.instanceId,
      title: input.title,
      body: input.body ?? ''
    });
  }

  handleUnread(input: { instanceId: string; count: UnreadCount }): AutomationRunSummary {
    return this.run({
      event: 'unreadThreshold',
      serviceId: input.instanceId,
      unread: input.count.direct + input.count.indirect
    });
  }

  private run(sample: Record<string, unknown>): AutomationRunSummary {
    let ran = 0;
    let actionCount = 0;
    for (const rule of listAutomations(this.deps.db).filter((candidate) => candidate.enabled)) {
      if (!triggerCanRunForEvent(rule, String(sample.event ?? ''))) {
        continue;
      }
      const result = testAutomation(rule, sample);
      if (!result.matched) {
        continue;
      }
      for (const action of result.actions) {
        this.executeAction(action, sample);
        actionCount += 1;
      }
      markAutomationRun(this.deps.db, rule.id);
      ran += 1;
    }
    if (ran > 0) {
      this.deps.sendDataChanged();
    }
    return { ran, actionCount };
  }

  private executeAction(action: AutomationAction, sample: Record<string, unknown>): void {
    const targetId = action.targetId ?? stringSample(sample.serviceId);
    if (action.type === 'createTask') {
      createTask(this.deps.db, action.value || taskTitle(sample));
      return;
    }
    if (action.type === 'sleepService' && targetId) {
      this.deps.viewManager.sleep(targetId);
      return;
    }
    if (action.type === 'wakeService' && targetId) {
      this.deps.viewManager.wake(targetId);
      return;
    }
    if (action.type === 'openService' && targetId) {
      this.deps.viewManager.wake(targetId);
      this.deps.viewManager.focus(targetId);
      this.deps.sendPush('event:notification-clicked', { instanceId: targetId });
      return;
    }
    if (action.type === 'openWorkspace' && action.targetId) {
      this.deps.sendPush('event:workspace-open-requested', { workspaceId: action.targetId });
      return;
    }
    if (action.type === 'setFocusMode' && action.targetId) {
      this.deps.sendPush('event:focus-mode-requested', { focusModeId: action.targetId });
    }
  }
}

function triggerCanRunForEvent(rule: AutomationRule, event: string): boolean {
  if (rule.trigger.type === 'manual') return false;
  if (rule.trigger.type === 'schedule') return event === 'schedule';
  return rule.trigger.type === event;
}

function stringSample(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function taskTitle(sample: Record<string, unknown>): string {
  const title = stringSample(sample.title);
  return title ? `Follow up: ${title}` : 'Follow up from automation';
}
